import crypto from 'node:crypto';
import { queryAll, queryOne, execute, withTransaction } from '../../db/index.js';

const LEASE_DURATION_SECONDS = 30;
const MAX_ATTEMPTS = 5;

export async function processOutboxJobs() {
  const now = new Date();
  const nowIso = now.toISOString();

  // Find due jobs: status = PENDING OR (PROCESSING and lease_expires_at <= now)
  const dueJobs = queryAll(`
    SELECT id, tenant_id, order_id, event_version, channel, recipient, payload_json, attempts
    FROM outbox_jobs
    WHERE (status = 'PENDING' AND available_at <= ?)
       OR (status = 'PROCESSING' AND lease_expires_at <= ?)
    LIMIT 20
  `, [nowIso, nowIso]);

  if (dueJobs.length === 0) return { processed: 0 };

  let processedCount = 0;

  for (const job of dueJobs) {
    const leaseExpiresAt = new Date(Date.now() + LEASE_DURATION_SECONDS * 1000).toISOString();

    // Claim lease atomically
    const claimRes = execute(`
      UPDATE outbox_jobs
      SET status = 'PROCESSING',
          lease_expires_at = ?,
          attempts = attempts + 1
      WHERE id = ? AND (status = 'PENDING' OR lease_expires_at <= ?)
    `, [leaseExpiresAt, job.id, nowIso]);

    if (claimRes.changes === 0) {
      continue; // Claimed by another worker
    }

    const startTime = Date.now();
    let isSuccess = false;
    let errorSummary = null;

    try {
      // Stale check (Section 10):
      // Check current order version. If order has progressed past event_version, or is cancelled/expired,
      // we check if this notification is obsolete.
      const currentOrder = queryOne('SELECT id, state, version FROM orders WHERE id = ?', [job.order_id]);
      let payload = {};
      try { payload = JSON.parse(job.payload_json); } catch {}

      if (currentOrder) {
        if (payload.type === 'NEW_ORDER_ALERT_STAFF' && currentOrder.state !== 'PENDING_ACCEPTANCE') {
          // Already handled by staff, suppress stale pending sound/alert
          console.log(`[Outbox] Suppressing stale alert for order ${currentOrder.id} (already ${currentOrder.state})`);
        } else {
          // Execute notification adapter
          await dispatchNotification(job.channel, job.recipient, payload);
        }
      }

      isSuccess = true;
    } catch (err) {
      errorSummary = err.message;
      console.error(`[Outbox Job ${job.id}] Delivery failed:`, err.message);
    }

    const latencyMs = Date.now() - startTime;

    // Record attempt
    const attemptId = crypto.randomUUID();
    execute(`
      INSERT INTO notification_attempts (id, job_id, channel, status, latency_ms, error_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [attemptId, job.id, job.channel, isSuccess ? 'SUCCESS' : 'FAILED', latencyMs, errorSummary, new Date().toISOString()]);

    // Update job status
    if (isSuccess) {
      execute(`UPDATE outbox_jobs SET status = 'SENT', lease_expires_at = NULL WHERE id = ?`, [job.id]);
    } else {
      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        execute(`UPDATE outbox_jobs SET status = 'FAILED', last_error = ?, lease_expires_at = NULL WHERE id = ?`, [errorSummary, job.id]);
      } else {
        // Exponential backoff with jitter
        const delaySeconds = Math.min(300, Math.pow(2, nextAttempts) * 3 + Math.floor(Math.random() * 5));
        const nextAvailableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
        execute(`
          UPDATE outbox_jobs
          SET status = 'PENDING',
              available_at = ?,
              last_error = ?,
              lease_expires_at = NULL
          WHERE id = ?
        `, [nextAvailableAt, errorSummary, job.id]);
      }
    }

    processedCount++;
  }

  return { processed: processedCount };
}

async function dispatchNotification(channel, recipient, payload) {
  if (channel === 'TELEGRAM') {
    // Sandbox / Live Telegram Bot
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const text = `🔔 *New Order #${payload.publicRef}*\nItems: ${payload.itemCount}\nTotal: $${(payload.totalMinor / 100).toFixed(2)}\nCustomer: ${payload.customerName}`;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      });
      if (!res.ok) throw new Error(`Telegram API responded with ${res.status}`);
    } else {
      // Sandbox mode
      console.log(`[SANDBOX TELEGRAM] -> To: ${recipient} | Alert: New Order #${payload.publicRef} ($${((payload.totalMinor || 0) / 100).toFixed(2)}) for ${payload.customerName}`);
    }
  } else if (channel === 'EMAIL') {
    // Sandbox / Live Email Adapter
    console.log(`[SANDBOX EMAIL] -> To: ${recipient} | Order Status Notification: ${payload.toState || payload.type} (Ref: ${payload.publicRef || payload.orderId})`);
  }
}
