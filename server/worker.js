import { processOutboxJobs } from './modules/notifications/outboxService.js';
import { runExpirySweeper } from './modules/operations/operationsService.js';

let isRunning = true;

async function workerLoop() {
  console.log('[Worker] Restaurant Ordering Platform background worker started.');
  console.log('[Worker] - Transactional Outbox processor: active');
  console.log('[Worker] - Order acceptance deadline sweeper: active');

  let sweepCounter = 0;

  while (isRunning) {
    try {
      // 1. Process due outbox jobs
      const outboxRes = await processOutboxJobs();
      if (outboxRes.processed > 0) {
        console.log(`[Worker] Processed ${outboxRes.processed} outbox notification job(s)`);
      }

      // 2. Run expiry sweeper every 3rd iteration (~6-9 seconds)
      sweepCounter++;
      if (sweepCounter >= 3) {
        sweepCounter = 0;
        const sweepRes = runExpirySweeper();
        if (sweepRes.transitioned > 0) {
          console.log(`[Worker] Expiry sweeper expired ${sweepRes.transitioned} overdue order(s)`);
        }
      }
    } catch (err) {
      console.error('[Worker Error]:', err.message);
    }

    // Wait 2500ms before next cycle
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  console.log('[Worker] Stopped cleanly.');
}

process.on('SIGINT', () => {
  console.log('\n[Worker] Received SIGINT. Shutting down worker...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  console.log('\n[Worker] Received SIGTERM. Shutting down worker...');
  isRunning = false;
});

workerLoop();
