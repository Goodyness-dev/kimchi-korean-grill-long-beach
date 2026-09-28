import http from 'node:http';
import { URL } from 'node:url';
import { getStorefrontMenu, setItemAvailability } from './modules/catalog/catalogService.js';
import { calculateQuote } from './modules/pricing/pricingService.js';
import { createOrderWithIdempotency } from './modules/ordering/orderService.js';
import { getOrderStatusByCapability } from './modules/ordering/trackingService.js';
import {
  getStaffOrders,
  staffAcceptOrder,
  staffDeclineOrder,
  staffMarkReady,
  staffCompleteOrder,
  staffCancelOrder
} from './modules/fulfillment/staffFulfillmentService.js';
import { updateLocationSettings } from './modules/operations/operationsService.js';
import { authenticateStaff, verifyToken } from './modules/identity/auth.js';
import { queryOne, execute, withTransaction } from './db/index.js';

const PORT = process.env.PORT || 5050;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Capability-Token');
}

function sendJson(res, statusCode, data) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, code, message, extra = {}) {
  sendJson(res, statusCode, {
    code: code || 'ERROR',
    message: message || 'An error occurred',
    retryable: statusCode >= 500,
    ...extra
  });
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getStaffContext(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // -------------------------------------------------------------
    // Health Check
    // -------------------------------------------------------------
    if (pathname === '/v1/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'healthy', version: '1.0.0', time: new Date().toISOString() });
    }

    // -------------------------------------------------------------
    // Storefront Menu
    // -------------------------------------------------------------
    if (pathname === '/v1/storefront/menu' && method === 'GET') {
      const tenantId = parsedUrl.searchParams.get('tenantId') || 'tenant-kimchi';
      const locationId = parsedUrl.searchParams.get('locationId') || 'loc-kimchi-lb';
      const menu = getStorefrontMenu(tenantId, locationId);
      if (!menu) {
        return sendError(res, 404, 'NOT_FOUND', 'Restaurant menu not found');
      }
      return sendJson(res, 200, menu);
    }

    // -------------------------------------------------------------
    // Quotes (Price calculation & validation)
    // -------------------------------------------------------------
    if (pathname === '/v1/quotes' && method === 'POST') {
      const body = await parseBody(req);
      const tenantId = body.tenantId || 'tenant-kimchi';
      const locationId = body.locationId || 'loc-kimchi-lb';
      const quote = calculateQuote(tenantId, locationId, body.items || []);
      return sendJson(res, 200, quote);
    }

    // -------------------------------------------------------------
    // Orders (Idempotent order submission)
    // -------------------------------------------------------------
    if (pathname === '/v1/orders' && method === 'POST') {
      const idempotencyKey = req.headers['idempotency-key'];
      const body = await parseBody(req);
      const tenantId = body.tenantId || 'tenant-kimchi';
      const locationId = body.locationId || 'loc-kimchi-lb';

      const orderResult = createOrderWithIdempotency({
        tenantId,
        locationId,
        idempotencyKey,
        customer: body.customer,
        items: body.items,
        quoteToken: body.quoteToken
      });

      return sendJson(res, orderResult.isReplay ? 200 : 201, orderResult);
    }

    // -------------------------------------------------------------
    // Order Status (Capability-based customer tracking)
    // -------------------------------------------------------------
    const statusMatch = pathname.match(/^\/v1\/order-status\/([A-Za-z0-9-_]+)$/);
    if (statusMatch && method === 'GET') {
      const publicRef = statusMatch[1];
      const capabilityToken = parsedUrl.searchParams.get('token') || req.headers['x-capability-token'];
      const statusData = getOrderStatusByCapability(publicRef, capabilityToken);
      return sendJson(res, 200, statusData);
    }

    // -------------------------------------------------------------
    // Staff Auth
    // -------------------------------------------------------------
    if (pathname === '/v1/staff/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const authResult = authenticateStaff(body.username, body.password);
      if (!authResult) {
        return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid staff username or password');
      }
      return sendJson(res, 200, authResult);
    }

    // -------------------------------------------------------------
    // Staff Protected Endpoints
    // -------------------------------------------------------------
    if (pathname.startsWith('/v1/staff/')) {
      const staff = getStaffContext(req);
      if (!staff) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Staff authentication required');
      }

      const tenantId = staff.tenantId;
      const locationId = parsedUrl.searchParams.get('locationId') || 'loc-kimchi-lb';

      // 1. Get staff orders
      if (pathname === '/v1/staff/orders' && method === 'GET') {
        const filter = parsedUrl.searchParams.get('filter') || 'ACTIVE';
        const orders = getStaffOrders(tenantId, locationId, filter);
        return sendJson(res, 200, { orders });
      }

      // 2. Accept Order
      const acceptMatch = pathname.match(/^\/v1\/staff\/orders\/([A-Za-z0-9-_]+)\/accept$/);
      if (acceptMatch && method === 'POST') {
        const orderId = acceptMatch[1];
        const body = await parseBody(req);
        const result = staffAcceptOrder(tenantId, orderId, body.expectedVersion, body.pickupMinutes || 20, staff.staffId);
        return sendJson(res, 200, result);
      }

      // 3. Decline Order
      const declineMatch = pathname.match(/^\/v1\/staff\/orders\/([A-Za-z0-9-_]+)\/decline$/);
      if (declineMatch && method === 'POST') {
        const orderId = declineMatch[1];
        const body = await parseBody(req);
        const result = staffDeclineOrder(tenantId, orderId, body.expectedVersion, body.reason, staff.staffId);
        return sendJson(res, 200, result);
      }

      // 4. Mark Ready
      const readyMatch = pathname.match(/^\/v1\/staff\/orders\/([A-Za-z0-9-_]+)\/ready$/);
      if (readyMatch && method === 'POST') {
        const orderId = readyMatch[1];
        const body = await parseBody(req);
        const result = staffMarkReady(tenantId, orderId, body.expectedVersion, staff.staffId);
        return sendJson(res, 200, result);
      }

      // 5. Complete Order
      const completeMatch = pathname.match(/^\/v1\/staff\/orders\/([A-Za-z0-9-_]+)\/complete$/);
      if (completeMatch && method === 'POST') {
        const orderId = completeMatch[1];
        const body = await parseBody(req);
        const result = staffCompleteOrder(tenantId, orderId, body.expectedVersion, staff.staffId);
        return sendJson(res, 200, result);
      }

      // 6. Cancel Order
      const cancelMatch = pathname.match(/^\/v1\/staff\/orders\/([A-Za-z0-9-_]+)\/cancel$/);
      if (cancelMatch && method === 'POST') {
        const orderId = cancelMatch[1];
        const body = await parseBody(req);
        const result = staffCancelOrder(tenantId, orderId, body.expectedVersion, body.reason, staff.staffId);
        return sendJson(res, 200, result);
      }

      // 7. Menu availability toggle (86 item)
      if (pathname === '/v1/staff/availability' && method === 'PATCH') {
        const body = await parseBody(req);
        const resObj = setItemAvailability(tenantId, body.itemId, body.isAvailable);
        if (!resObj) return sendError(res, 404, 'NOT_FOUND', 'Item not found');
        return sendJson(res, 200, resObj);
      }

      // 8. Ordering settings / pause toggle
      if (pathname === '/v1/staff/ordering' && method === 'PATCH') {
        const body = await parseBody(req);
        const updated = updateLocationSettings(tenantId, locationId, {
          isPaused: body.isPaused,
          pauseReason: body.pauseReason,
          leadTimeMins: body.leadTimeMins,
          actorId: staff.staffId,
          actorRole: staff.role
        });
        return sendJson(res, 200, updated);
      }
    }

    // -------------------------------------------------------------
    // Demo Reset (Milestone A requirement)
    // -------------------------------------------------------------
    if (pathname === '/v1/demo/reset' && method === 'POST') {
      import('./seed.js');
      return sendJson(res, 200, { message: 'Demo restaurant data reset successfully' });
    }

    return sendError(res, 404, 'NOT_FOUND', `Route not found: ${method} ${pathname}`);
  } catch (err) {
    console.error(`[API Error] ${method} ${pathname}:`, err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', err.message, {
      freshQuote: err.freshQuote
    });
  }
});

server.listen(PORT, () => {
  console.log(`[API Server] Restaurant Ordering API running on http://localhost:${PORT}`);
});
