import crypto from 'node:crypto';
import { queryAll, queryOne, execute, withTransaction } from '../../db/index.js';
import { transitionOrder, ORDER_STATES } from '../ordering/orderFsm.js';

export function runExpirySweeper() {
  const nowIso = new Date().toISOString();
  const expiredOrders = queryAll(`
    SELECT id, tenant_id, version, state
    FROM orders
    WHERE state = 'PENDING_ACCEPTANCE' AND acceptance_deadline <= ?
    LIMIT 50
  `, [nowIso]);

  let transitionedCount = 0;
  for (const ord of expiredOrders) {
    try {
      withTransaction(() => {
        transitionOrder({
          tenantId: ord.tenant_id,
          orderId: ord.id,
          expectedVersion: ord.version,
          targetState: ORDER_STATES.EXPIRED,
          actorType: 'SYSTEM_SWEEPER',
          actorId: 'CRON_EXPIRY_SWEEPER',
          reason: 'Acceptance deadline passed without staff confirmation',
          nowIso
        });
      });
      transitionedCount++;
    } catch (err) {
      // If concurrent acceptance occurred, conflict is expected and safe
    }
  }

  return { scanned: expiredOrders.length, transitioned: transitionedCount };
}

export function updateLocationSettings(tenantId, locationId, { isPaused, pauseReason, leadTimeMins, actorId, actorRole }) {
  const location = queryOne('SELECT id, is_paused, lead_time_mins FROM locations WHERE id = ? AND tenant_id = ?', [locationId, tenantId]);
  if (!location) {
    const err = new Error('Location not found');
    err.statusCode = 404;
    throw err;
  }

  const updates = [];
  const params = [];

  if (typeof isPaused === 'boolean') {
    updates.push('is_paused = ?');
    params.push(isPaused ? 1 : 0);
    if (pauseReason !== undefined) {
      updates.push('pause_reason = ?');
      params.push(pauseReason ? pauseReason.trim() : null);
    }
  }

  if (leadTimeMins !== undefined) {
    const lt = parseInt(leadTimeMins, 10);
    if (!isNaN(lt) && lt >= 5 && lt <= 180) {
      updates.push('lead_time_mins = ?');
      params.push(lt);
    }
  }

  if (updates.length > 0) {
    params.push(locationId, tenantId);
    execute(`UPDATE locations SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);

    // Write audit log
    const auditId = crypto.randomUUID();
    execute(`
      INSERT INTO audit_log (id, tenant_id, actor_id, actor_role, operation, target_entity, target_id, details_json, created_at)
      VALUES (?, ?, ?, ?, 'UPDATE_LOCATION_SETTINGS', 'locations', ?, ?, ?)
    `, [
      auditId, tenantId, actorId || 'SYSTEM', actorRole || 'STAFF', locationId,
      JSON.stringify({ isPaused, pauseReason, leadTimeMins }),
      new Date().toISOString()
    ]);
  }

  return queryOne('SELECT id, is_paused, pause_reason, lead_time_mins FROM locations WHERE id = ? AND tenant_id = ?', [locationId, tenantId]);
}
