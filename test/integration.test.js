import assert from 'node:assert';
import crypto from 'node:crypto';
import { calculateQuote } from '../server/modules/pricing/pricingService.js';
import { createOrderWithIdempotency } from '../server/modules/ordering/orderService.js';
import { getOrderStatusByCapability } from '../server/modules/ordering/trackingService.js';
import {
  staffAcceptOrder,
  staffMarkReady,
  staffCompleteOrder,
  staffDeclineOrder
} from '../server/modules/fulfillment/staffFulfillmentService.js';
import { transitionOrder, ORDER_STATES } from '../server/modules/ordering/orderFsm.js';
import { processOutboxJobs } from '../server/modules/notifications/outboxService.js';
import { runExpirySweeper } from '../server/modules/operations/operationsService.js';
import { queryOne, execute } from '../server/db/index.js';

console.log('--- RUNNING KIMCHI KOREAN GRILL INTEGRATION TEST SUITE ---');

const tenantId = 'tenant-kimchi';
const locationId = 'loc-kimchi-lb';

async function runTests() {
  // Test 1: Pricing & Quote Calculation
  console.log('âœ“ Test 1: Pricing & Quote Calculation for Korean BBQ');
  const basket = [
    {
      itemId: 'item-bulgogi',
      quantity: 2,
      selectedOptionIds: ['opt-rice-cauli', 'opt-sp-med', 'opt-side-egg'], // +250, +150
      customerNotes: 'Extra sesame seeds please'
    },
    {
      itemId: 'item-milkis',
      quantity: 1,
      selectedOptionIds: []
    }
  ];

  const quote = calculateQuote(tenantId, locationId, basket);
  assert.strictEqual(quote.currency, 'USD');
  // Bulgogi base = 1950 + 250 + 150 = 2350 * 2 = 4700
  // Milkis = 350 * 1 = 350
  // Subtotal = 5050 ($50.50)
  assert.strictEqual(quote.subtotalMinor, 5050, `Expected 5050, got ${quote.subtotalMinor}`);
  // Tax @ 10.25% (1025 bps) = Math.round(5050 * 1025 / 10000) = Math.round(517.625) = 518
  assert.strictEqual(quote.taxMinor, 518, `Expected 518 tax, got ${quote.taxMinor}`);
  assert.strictEqual(quote.totalMinor, 5568, `Expected 5568 total, got ${quote.totalMinor}`);
  assert.ok(quote.quoteToken, 'Quote token must be generated');

  // Test 2: Idempotent Order Creation
  console.log('âœ“ Test 2: Idempotent Order Creation & Persistence');
  const testIdempotencyKey = 'idem-kimchi-' + crypto.randomUUID();
  const customer = {
    name: 'Jun Park',
    email: 'jun.park@example.com',
    phone: '562-555-1033',
    notes: 'Pick up in 25 mins'
  };

  const orderRes = createOrderWithIdempotency({
    tenantId,
    locationId,
    idempotencyKey: testIdempotencyKey,
    customer,
    items: basket,
    quoteToken: quote.quoteToken
  });

  assert.ok(orderRes.orderId);
  assert.ok(orderRes.publicRef.startsWith('TK-'));
  assert.strictEqual(orderRes.state, ORDER_STATES.PENDING_ACCEPTANCE);
  assert.strictEqual(orderRes.version, 1);
  assert.strictEqual(orderRes.totalMinor, 5568);

  // Test 3: Idempotency Replay (Identical Key & Payload)
  console.log('âœ“ Test 3: Idempotency Replay returns original order without duplicates');
  const replayRes = createOrderWithIdempotency({
    tenantId,
    locationId,
    idempotencyKey: testIdempotencyKey,
    customer,
    items: basket,
    quoteToken: quote.quoteToken
  });

  assert.strictEqual(replayRes.orderId, orderRes.orderId);
  assert.strictEqual(replayRes.publicRef, orderRes.publicRef);
  assert.strictEqual(replayRes.isReplay, true);

  // Test 4: Idempotency Key Reused with Different Payload (409 Conflict)
  console.log('âœ“ Test 4: Idempotency Key Reused with altered payload throws 409 Conflict');
  let conflictCaught = false;
  try {
    createOrderWithIdempotency({
      tenantId,
      locationId,
      idempotencyKey: testIdempotencyKey,
      customer: { ...customer, name: 'Different Customer' },
      items: basket,
      quoteToken: quote.quoteToken
    });
  } catch (err) {
    conflictCaught = true;
    assert.strictEqual(err.statusCode, 409);
    assert.ok(err.message.includes('IDEMPOTENCY_KEY_REUSED'));
  }
  assert.strictEqual(conflictCaught, true, 'Must reject altered payload with reused key');

  // Test 5: Capability-based Customer Tracking
  console.log('âœ“ Test 5: Capability-based Customer Tracking');
  const trackingData = getOrderStatusByCapability(orderRes.publicRef, orderRes.capabilityToken);
  assert.strictEqual(trackingData.publicRef, orderRes.publicRef);
  assert.strictEqual(trackingData.state, ORDER_STATES.PENDING_ACCEPTANCE);
  assert.strictEqual(trackingData.items.length, 2);

  // Capability token check failure on invalid token
  let tokenRejected = false;
  try {
    getOrderStatusByCapability(orderRes.publicRef, 'forged-token-xyz');
  } catch (err) {
    tokenRejected = true;
    assert.strictEqual(err.statusCode, 404);
  }
  assert.strictEqual(tokenRejected, true, 'Forged capability token must be rejected');

  // Test 6: Order State Machine & Optimistic Concurrency
  console.log('âœ“ Test 6: Order FSM Transitions & Concurrency Guards');
  // Staff accepts order (expected version 1)
  const acceptRes = staffAcceptOrder(tenantId, orderRes.orderId, 1, 25, 'staff-kitchen');
  assert.strictEqual(acceptRes.toState, ORDER_STATES.ACCEPTED);
  assert.strictEqual(acceptRes.version, 2);

  // Stale version mutation attempt (expecting version 1 instead of 2) -> 409 CONFLICT
  let staleConflict = false;
  try {
    staffAcceptOrder(tenantId, orderRes.orderId, 1, 20, 'staff-another');
  } catch (err) {
    staleConflict = true;
    assert.strictEqual(err.statusCode, 409);
    assert.ok(err.message.includes('Concurrency Conflict'));
  }
  assert.strictEqual(staleConflict, true, 'Stale version must throw 409 concurrency conflict');

  // Mark ready (version 2 -> 3)
  const readyRes = staffMarkReady(tenantId, orderRes.orderId, 2, 'staff-kitchen');
  assert.strictEqual(readyRes.toState, ORDER_STATES.READY);
  assert.strictEqual(readyRes.version, 3);

  // Mark complete (version 3 -> 4)
  const completeRes = staffCompleteOrder(tenantId, orderRes.orderId, 3, 'staff-kitchen');
  assert.strictEqual(completeRes.toState, ORDER_STATES.COMPLETED);
  assert.strictEqual(completeRes.version, 4);

  // Terminal state protection: attempt to cancel completed order -> 409 Conflict
  let terminalConflict = false;
  try {
    staffDeclineOrder(tenantId, orderRes.orderId, 4, 'Too late', 'staff-kitchen');
  } catch (err) {
    terminalConflict = true;
    assert.strictEqual(err.statusCode, 409);
    assert.ok(err.message.includes('Illegal state transition'));
  }
  assert.strictEqual(terminalConflict, true, 'Terminal states cannot reopen or transition');

  // Test 7: Outbox Processor
  console.log('âœ“ Test 7: Transactional Outbox Job Processing');
  const outboxRes = await processOutboxJobs();
  assert.ok(outboxRes.processed >= 1, 'Should have processed outbox jobs');

  // Test 8: Expiry Sweeper
  console.log('âœ“ Test 8: Acceptance Deadline Expiry Sweeper');
  const expiredOrderId = crypto.randomUUID();
  const pastDeadline = new Date(Date.now() - 60 * 1000).toISOString();
  const pastRef = 'TK-KIMCHI-' + crypto.randomUUID().substring(0, 6);
  execute(`
    INSERT INTO orders (
      id, tenant_id, location_id, public_ref, capability_token_hash,
      state, version, currency, subtotal_minor, tax_minor, total_minor,
      acceptance_deadline, customer_name, customer_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'hash', 'PENDING_ACCEPTANCE', 1, 'USD', 1000, 103, 1103, ?, 'Test Expired', 'test@example.com', ?, ?)
  `, [expiredOrderId, tenantId, locationId, pastRef, pastDeadline, pastDeadline, pastDeadline]);

  const sweeperRes = runExpirySweeper();
  assert.ok(sweeperRes.transitioned >= 1, 'Sweeper must transition overdue order to EXPIRED');

  const checkExpired = queryOne('SELECT state FROM orders WHERE id = ?', [expiredOrderId]);
  assert.strictEqual(checkExpired.state, ORDER_STATES.EXPIRED);

  console.log('\n======================================================');
  console.log('ðŸŽ‰ ALL 8 KIMCHI KOREAN GRILL TEST SUITES PASSED 100%!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('âŒ Test suite failed:', err);
  process.exit(1);
});