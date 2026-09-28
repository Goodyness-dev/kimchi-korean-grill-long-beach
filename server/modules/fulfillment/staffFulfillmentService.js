import { queryAll, queryOne } from '../../db/index.js';
import { transitionOrder, ORDER_STATES } from '../ordering/orderFsm.js';

export function getStaffOrders(tenantId, locationId, statusFilter = 'ACTIVE') {
  let stateClause = `state IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'READY')`;
  if (statusFilter === 'ALL') {
    stateClause = '1=1';
  } else if (statusFilter === 'HISTORY') {
    stateClause = `state IN ('COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED')`;
  } else if (statusFilter === 'PENDING') {
    stateClause = `state = 'PENDING_ACCEPTANCE'`;
  }

  const orders = queryAll(`
    SELECT id, tenant_id, location_id, public_ref, state, version, currency,
           subtotal_minor, tax_minor, total_minor, acceptance_deadline,
           estimated_pickup_at, decline_reason, cancel_reason,
           customer_name, customer_email, customer_phone, customer_notes,
           created_at, updated_at
    FROM orders
    WHERE tenant_id = ? AND location_id = ? AND ${stateClause}
    ORDER BY
      CASE
        WHEN state = 'PENDING_ACCEPTANCE' THEN 1
        WHEN state = 'ACCEPTED' THEN 2
        WHEN state = 'READY' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 100
  `, [tenantId, locationId]);

  // Load items for each order
  const orderIds = orders.map(o => o.id);
  const itemsByOrder = {};
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const items = queryAll(`
      SELECT id, order_id, item_name, base_price_minor, quantity, subtotal_minor, options_snapshot_json
      FROM order_items
      WHERE order_id IN (${placeholders})
    `, orderIds);

    for (const it of items) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      let opts = [];
      try {
        opts = JSON.parse(it.options_snapshot_json || '[]');
      } catch {
        opts = [];
      }
      itemsByOrder[it.order_id].push({
        id: it.id,
        name: it.item_name,
        basePriceMinor: it.base_price_minor,
        quantity: it.quantity,
        subtotalMinor: it.subtotal_minor,
        options: opts
      });
    }
  }

  return orders.map(o => ({
    ...o,
    items: itemsByOrder[o.id] || []
  }));
}

export function staffAcceptOrder(tenantId, orderId, expectedVersion, pickupMinutes = 20, actorId) {
  const pickupMins = parseInt(pickupMinutes, 10) || 20;
  const estimatedPickupAt = new Date(Date.now() + pickupMins * 60 * 1000).toISOString();

  return transitionOrder({
    tenantId,
    orderId,
    expectedVersion,
    targetState: ORDER_STATES.ACCEPTED,
    actorType: 'STAFF',
    actorId,
    estimatedPickupAt
  });
}

export function staffDeclineOrder(tenantId, orderId, expectedVersion, reason, actorId) {
  return transitionOrder({
    tenantId,
    orderId,
    expectedVersion,
    targetState: ORDER_STATES.DECLINED,
    actorType: 'STAFF',
    actorId,
    reason: reason || 'Kitchen unable to fulfill order at this time'
  });
}

export function staffMarkReady(tenantId, orderId, expectedVersion, actorId) {
  return transitionOrder({
    tenantId,
    orderId,
    expectedVersion,
    targetState: ORDER_STATES.READY,
    actorType: 'STAFF',
    actorId
  });
}

export function staffCompleteOrder(tenantId, orderId, expectedVersion, actorId) {
  return transitionOrder({
    tenantId,
    orderId,
    expectedVersion,
    targetState: ORDER_STATES.COMPLETED,
    actorType: 'STAFF',
    actorId
  });
}

export function staffCancelOrder(tenantId, orderId, expectedVersion, reason, actorId) {
  return transitionOrder({
    tenantId,
    orderId,
    expectedVersion,
    targetState: ORDER_STATES.CANCELLED,
    actorType: 'STAFF',
    actorId,
    reason: reason || 'Cancelled by restaurant staff'
  });
}
