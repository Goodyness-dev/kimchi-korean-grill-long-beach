import crypto from 'node:crypto';
import { queryOne, queryAll } from '../../db/index.js';

export function getOrderStatusByCapability(publicRef, capabilityToken) {
  if (!publicRef || !capabilityToken) {
    const err = new Error('Order reference and capability access token are required');
    err.statusCode = 400;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(capabilityToken).digest('hex');

  const order = queryOne(`
    SELECT o.id, o.tenant_id, o.location_id, o.public_ref, o.state, o.version, o.currency,
           o.subtotal_minor, o.tax_minor, o.total_minor, o.acceptance_deadline,
           o.estimated_pickup_at, o.decline_reason, o.cancel_reason,
           o.customer_name, o.created_at, o.updated_at,
           l.name as location_name, l.address as location_address, l.phone as location_phone,
           l.pickup_instructions
    FROM orders o
    JOIN locations l ON o.location_id = l.id
    WHERE o.public_ref = ? AND o.capability_token_hash = ?
  `, [publicRef, tokenHash]);

  if (!order) {
    const err = new Error('Order not found or invalid capability token');
    err.statusCode = 404;
    throw err;
  }

  const items = queryAll(`
    SELECT id, item_name, base_price_minor, quantity, subtotal_minor, options_snapshot_json
    FROM order_items
    WHERE order_id = ?
  `, [order.id]);

  const parsedItems = items.map(it => {
    let options = [];
    try {
      options = JSON.parse(it.options_snapshot_json || '[]');
    } catch {
      options = [];
    }
    return {
      id: it.id,
      name: it.item_name,
      basePriceMinor: it.base_price_minor,
      quantity: it.quantity,
      subtotalMinor: it.subtotal_minor,
      options
    };
  });

  return {
    publicRef: order.public_ref,
    state: order.state,
    version: order.version,
    currency: order.currency,
    subtotalMinor: order.subtotal_minor,
    taxMinor: order.tax_minor,
    totalMinor: order.total_minor,
    acceptanceDeadline: order.acceptance_deadline,
    estimatedPickupAt: order.estimated_pickup_at,
    declineReason: order.decline_reason,
    cancelReason: order.cancel_reason,
    customerName: order.customer_name,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    location: {
      name: order.location_name,
      address: order.location_address,
      phone: order.location_phone,
      pickupInstructions: order.pickup_instructions
    },
    items: parsedItems
  };
}
