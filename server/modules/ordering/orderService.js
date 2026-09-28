import crypto from 'node:crypto';
import { queryOne, execute, withTransaction } from '../../db/index.js';
import { calculateQuote, verifyQuoteToken } from '../pricing/pricingService.js';
import { ORDER_STATES } from './orderFsm.js';

function computeRequestHash(payload) {
  const normalized = JSON.stringify({
    tenantId: payload.tenantId,
    locationId: payload.locationId,
    customer: {
      name: payload.customer?.name?.trim(),
      email: payload.customer?.email?.trim().toLowerCase(),
      phone: payload.customer?.phone?.trim(),
      notes: payload.customer?.notes?.trim()
    },
    items: (payload.items || []).map(i => ({
      itemId: i.itemId,
      quantity: i.quantity,
      selectedOptionIds: (i.selectedOptionIds || []).sort(),
      customerNotes: i.customerNotes?.trim()
    }))
  });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function createOrderWithIdempotency({
  tenantId,
  locationId,
  idempotencyKey,
  customer,
  items,
  quoteToken
}) {
  if (!idempotencyKey) {
    const err = new Error('Idempotency-Key header is required');
    err.statusCode = 400;
    throw err;
  }

  if (!customer?.name?.trim() || !customer?.email?.trim()) {
    const err = new Error('Customer name and email are required');
    err.statusCode = 422;
    throw err;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customer.email.trim())) {
    const err = new Error('A valid customer email is required for order confirmation');
    err.statusCode = 422;
    throw err;
  }

  const keyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
  const requestHash = computeRequestHash({ tenantId, locationId, customer, items });

  return withTransaction(() => {
    // Check existing idempotency record
    const existingKeyRecord = queryOne(
      'SELECT id, key_hash, request_hash, order_id, response_json, expires_at FROM idempotency_records WHERE tenant_id = ? AND location_id = ? AND key_hash = ?',
      [tenantId, locationId, keyHash]
    );

    if (existingKeyRecord) {
      if (existingKeyRecord.request_hash !== requestHash) {
        const err = new Error('409 IDEMPOTENCY_KEY_REUSED: This idempotency key was previously submitted with a different order payload.');
        err.statusCode = 409;
        throw err;
      }
      // Replay original response
      try {
        const cachedResponse = JSON.parse(existingKeyRecord.response_json);
        return { ...cachedResponse, isReplay: true };
      } catch {
        // Fallback to fetch order
      }
    }

    // Check location admission and paused state
    const location = queryOne(
      'SELECT id, name, is_paused, pause_reason, max_concurrent_orders, acceptance_window_mins FROM locations WHERE id = ? AND tenant_id = ?',
      [locationId, tenantId]
    );
    if (!location) {
      const err = new Error('Location not found');
      err.statusCode = 404;
      throw err;
    }
    if (location.is_paused) {
      const err = new Error(`Ordering is temporarily paused: ${location.pause_reason || 'Kitchen at maximum capacity'}`);
      err.statusCode = 503;
      throw err;
    }

    // Check active kitchen capacity
    const activeOrders = queryOne(
      `SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND location_id = ? AND state IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'READY')`,
      [tenantId, locationId]
    );
    const currentActiveCount = activeOrders?.count || 0;
    if (currentActiveCount >= location.max_concurrent_orders) {
      const err = new Error('Kitchen is currently at maximum capacity. Please try again shortly.');
      err.statusCode = 503;
      throw err;
    }

    // Recompute quote authoritatively
    const quote = calculateQuote(tenantId, locationId, items);

    // Verify quote token
    const isQuoteValid = verifyQuoteToken(
      tenantId,
      locationId,
      quote.subtotalMinor,
      quote.taxMinor,
      quote.totalMinor,
      quoteToken
    );
    if (!isQuoteValid) {
      const err = new Error('Quote has expired or menu prices were modified. Please review updated totals.');
      err.statusCode = 409;
      err.freshQuote = quote;
      throw err;
    }

    const orderId = crypto.randomUUID();
    const publicRef = 'TK-' + crypto.randomInt(1000, 9999);
    const capabilityToken = crypto.randomBytes(24).toString('base64url');
    const capabilityTokenHash = crypto.createHash('sha256').update(capabilityToken).digest('hex');

    const acceptanceWindowMins = location.acceptance_window_mins || 15;
    const now = new Date();
    const acceptanceDeadline = new Date(now.getTime() + acceptanceWindowMins * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    // 1. Insert order
    execute(`
      INSERT INTO orders (
        id, tenant_id, location_id, public_ref, capability_token_hash,
        state, version, currency, subtotal_minor, tax_minor, total_minor,
        acceptance_deadline, customer_name, customer_email, customer_phone, customer_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId, tenantId, locationId, publicRef, capabilityTokenHash,
      ORDER_STATES.PENDING_ACCEPTANCE, quote.currency,
      quote.subtotalMinor, quote.taxMinor, quote.totalMinor,
      acceptanceDeadline, customer.name.trim(), customer.email.trim(),
      customer.phone?.trim() || null, customer.notes?.trim() || null,
      nowIso, nowIso
    ]);

    // 2. Insert immutable order items snapshots
    for (const line of quote.items) {
      const orderItemId = crypto.randomUUID();
      execute(`
        INSERT INTO order_items (
          id, tenant_id, order_id, item_id, item_name, base_price_minor, quantity, subtotal_minor, options_snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderItemId, tenantId, orderId, line.itemId, line.name,
        line.basePriceMinor, line.quantity, line.lineTotalMinor,
        JSON.stringify(line.selectedOptions)
      ]);
    }

    // 3. Insert initial order event
    const eventId = crypto.randomUUID();
    execute(`
      INSERT INTO order_events (id, tenant_id, order_id, sequence, from_state, to_state, actor_type, actor_id, reason, created_at)
      VALUES (?, ?, ?, 1, NULL, ?, 'CUSTOMER', NULL, 'Order submitted via storefront', ?)
    `, [eventId, tenantId, orderId, ORDER_STATES.PENDING_ACCEPTANCE, nowIso]);

    // 4. Insert transactional outbox jobs (both Customer Email & Staff Telegram Alert)
    const emailJobId = crypto.randomUUID();
    execute(`
      INSERT INTO outbox_jobs (id, tenant_id, order_id, event_version, channel, recipient, payload_json, status, available_at, created_at)
      VALUES (?, ?, ?, 1, 'EMAIL', ?, ?, 'PENDING', ?, ?)
    `, [
      emailJobId, tenantId, orderId, customer.email.trim(),
      JSON.stringify({
        type: 'ORDER_SUBMITTED_CUSTOMER',
        orderId,
        publicRef,
        customerName: customer.name.trim(),
        totalMinor: quote.totalMinor,
        acceptanceDeadline
      }),
      nowIso, nowIso
    ]);

    const telegramJobId = crypto.randomUUID();
    execute(`
      INSERT INTO outbox_jobs (id, tenant_id, order_id, event_version, channel, recipient, payload_json, status, available_at, created_at)
      VALUES (?, ?, ?, 1, 'TELEGRAM', 'STAFF_CHANNEL', ?, 'PENDING', ?, ?)
    `, [
      telegramJobId, tenantId, orderId,
      JSON.stringify({
        type: 'NEW_ORDER_ALERT_STAFF',
        orderId,
        publicRef,
        itemCount: quote.items.length,
        totalMinor: quote.totalMinor,
        customerName: customer.name.trim()
      }),
      nowIso, nowIso
    ]);

    const responseData = {
      orderId,
      publicRef,
      capabilityToken,
      state: ORDER_STATES.PENDING_ACCEPTANCE,
      version: 1,
      currency: quote.currency,
      subtotalMinor: quote.subtotalMinor,
      taxMinor: quote.taxMinor,
      totalMinor: quote.totalMinor,
      acceptanceDeadline,
      trackingUrl: `/order-status/${publicRef}?token=${capabilityToken}`,
      createdAt: nowIso
    };

    // 5. Store idempotency record (24 hour retention)
    const idempotencyId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    execute(`
      INSERT INTO idempotency_records (id, tenant_id, location_id, key_hash, request_hash, order_id, response_json, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      idempotencyId, tenantId, locationId, keyHash, requestHash, orderId,
      JSON.stringify(responseData), nowIso, expiresAt
    ]);

    return responseData;
  });
}
