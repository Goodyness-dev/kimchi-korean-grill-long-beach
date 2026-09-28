import crypto from 'node:crypto';
import { execute, queryOne } from '../../db/index.js';

export const ORDER_STATES = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  READY: 'READY',
  COMPLETED: 'COMPLETED'
};

export const ALLOWED_TRANSITIONS = {
  [ORDER_STATES.PENDING_ACCEPTANCE]: [
    ORDER_STATES.ACCEPTED,
    ORDER_STATES.DECLINED,
    ORDER_STATES.EXPIRED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.ACCEPTED]: [
    ORDER_STATES.READY,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.READY]: [
    ORDER_STATES.COMPLETED,
    ORDER_STATES.CANCELLED
  ],
  // Terminal states cannot transition further
  [ORDER_STATES.DECLINED]: [],
  [ORDER_STATES.EXPIRED]: [],
  [ORDER_STATES.CANCELLED]: [],
  [ORDER_STATES.COMPLETED]: []
};

export function canTransition(fromState, toState) {
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
}

/**
 * Executes an atomic conditional state mutation.
 * Enforces optimistic concurrency (expectedVersion) and tenant isolation.
 */
export function transitionOrder({
  tenantId,
  orderId,
  expectedVersion,
  targetState,
  actorType, // 'CUSTOMER', 'STAFF', 'SYSTEM_SWEEPER'
  actorId = null,
  reason = null,
  estimatedPickupAt = null,
  nowIso = new Date().toISOString()
}) {
  // Fetch current order to check rules
  const current = queryOne(
    'SELECT id, tenant_id, state, version, acceptance_deadline FROM orders WHERE id = ? AND tenant_id = ?',
    [orderId, tenantId]
  );

  if (!current) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  // Version check (optimistic concurrency)
  if (expectedVersion !== undefined && expectedVersion !== null && current.version !== Number(expectedVersion)) {
    const err = new Error(`Concurrency Conflict: Order is currently at version ${current.version}, expected ${expectedVersion}. Please refresh.`);
    err.statusCode = 409;
    err.currentOrder = current;
    throw err;
  }

  // Permitted transition check
  if (!canTransition(current.state, targetState)) {
    const err = new Error(`Illegal state transition from ${current.state} to ${targetState}`);
    err.statusCode = 409;
    throw err;
  }

  // Deadline check for acceptance
  if (targetState === ORDER_STATES.ACCEPTED) {
    const deadlineMs = new Date(current.acceptance_deadline).getTime();
    const nowMs = new Date(nowIso).getTime();
    if (nowMs >= deadlineMs) {
      const err = new Error('Acceptance deadline has expired. This order can no longer be accepted.');
      err.statusCode = 409;
      throw err;
    }
    if (!estimatedPickupAt) {
      const err = new Error('Accepted orders require an estimated pickup time');
      err.statusCode = 400;
      throw err;
    }
  }

  // Perform conditional atomic update
  let updateSql = `
    UPDATE orders
    SET state = ?,
        version = version + 1,
        updated_at = ?
  `;
  const params = [targetState, nowIso];

  if (targetState === ORDER_STATES.ACCEPTED) {
    updateSql += `, estimated_pickup_at = ?`;
    params.push(estimatedPickupAt);
  } else if (targetState === ORDER_STATES.DECLINED) {
    updateSql += `, decline_reason = ?`;
    params.push(reason || 'Declined by kitchen');
  } else if (targetState === ORDER_STATES.CANCELLED) {
    updateSql += `, cancel_reason = ?`;
    params.push(reason || 'Cancelled');
  }

  updateSql += ` WHERE id = ? AND tenant_id = ? AND version = ? AND state = ?`;
  params.push(orderId, tenantId, current.version, current.state);

  const res = execute(updateSql, params);
  if (res.changes === 0) {
    const err = new Error('Failed to update order state: concurrent modification occurred. Please refresh.');
    err.statusCode = 409;
    throw err;
  }

  const nextVersion = current.version + 1;

  // Insert event record
  const eventId = crypto.randomUUID();
  const nextSeq = (queryOne('SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM order_events WHERE order_id = ?', [orderId])?.seq) || 1;

  execute(`
    INSERT INTO order_events (id, tenant_id, order_id, sequence, from_state, to_state, actor_type, actor_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [eventId, tenantId, orderId, nextSeq, current.state, targetState, actorType, actorId, reason, nowIso]);

  // Insert outbox notification intent
  const outboxId = crypto.randomUUID();
  execute(`
    INSERT INTO outbox_jobs (id, tenant_id, order_id, event_version, channel, recipient, payload_json, status, available_at, created_at)
    VALUES (?, ?, ?, ?, 'EMAIL', 'CUSTOMER', ?, 'PENDING', ?, ?)
  `, [
    outboxId,
    tenantId,
    orderId,
    nextVersion,
    JSON.stringify({ orderId, toState: targetState, reason, estimatedPickupAt }),
    nowIso,
    nowIso
  ]);

  return {
    orderId,
    fromState: current.state,
    toState: targetState,
    version: nextVersion,
    updatedAt: nowIso
  };
}
