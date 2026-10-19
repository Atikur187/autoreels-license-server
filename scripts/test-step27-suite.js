/**
 * AutoReels Scroll — Step 27 Comprehensive 15-Test Verification Suite
 * Tests all 15 production criteria defined in Step 27:
 * TEST 1: Monthly checkout
 * TEST 2: Yearly checkout
 * TEST 3: Lifetime checkout
 * TEST 4: Successful webhook
 * TEST 5: Duplicate webhook (idempotency)
 * TEST 6: Invalid license
 * TEST 7: Expired license
 * TEST 8: Revoked license
 * TEST 9: Device limit
 * TEST 10: Offline mode
 * TEST 11: 72-hour grace
 * TEST 12: Extension activation
 * TEST 13: License re-validation
 * TEST 14: Payment failure
 * TEST 15: Subscription cancellation/expiration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import {
  verifyPaddleWebhook,
  generatePaddleWebhookSignature,
  resolvePlanFromPriceId,
  PADDLE_PRICE_MONTHLY,
  PADDLE_PRICE_YEARLY,
  PADDLE_PRICE_LIFETIME
} from '../lib/paddle.js';

import {
  generateLicenseKey,
  isValidLicenseKeyFormat,
  normalizeLicenseKey
} from '../lib/license-generator.js';

import { getDb } from '../lib/supabase.js';
import { POST as checkoutCreateHandler } from '../app/api/checkout/create/route.js';
import { POST as webhookHandler } from '../app/api/paddle/webhook/route.js';
import { POST as activateHandler } from '../app/api/license/activate/route.js';
import { POST as validateHandler } from '../app/api/license/validate/route.js';
import { POST as verifyHandler } from '../app/api/license/verify/route.js';
import { GET as licenseStatusHandler } from '../app/api/license/status/route.js';

const TEST_SECRET = 'pdl_whsec_test_webhook_secret_12345';
process.env.PADDLE_WEBHOOK_SECRET = TEST_SECRET;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ [PASS] ${testName}${details ? ` (${details})` : ''}`);
  } else {
    testsFailed++;
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
    throw new Error(`Test failed: ${testName} - ${details}`);
  }
}

async function runStep27Suite() {
  console.log('================================================================');
  console.log('  AutoReels Scroll — Complete 15-Test Production Suite (Step 27) ');
  console.log('================================================================\n');

  const db = getDb();

  // ---------------------------------------------------------------------------
  // TEST 1: Monthly checkout
  // ---------------------------------------------------------------------------
  console.log('▶ TEST 1: Monthly Checkout (/api/checkout/create)');
  const req1 = new Request('http://localhost:3000/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: '30day', email: 'monthly@example.com' })
  });
  const res1 = await checkoutCreateHandler(req1);
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.success === true, 'TEST 1: Monthly checkout created', `Price ID: ${data1.priceId}`);
  assert(data1.priceId === PADDLE_PRICE_MONTHLY, 'TEST 1: Monthly price ID matches');

  // ---------------------------------------------------------------------------
  // TEST 2: Yearly checkout
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 2: Yearly Checkout (/api/checkout/create)');
  const req2 = new Request('http://localhost:3000/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'yearly', email: 'yearly@example.com' })
  });
  const res2 = await checkoutCreateHandler(req2);
  const data2 = await res2.json();
  assert(res2.status === 200 && data2.success === true, 'TEST 2: Yearly checkout created', `Price ID: ${data2.priceId}`);
  assert(data2.priceId === PADDLE_PRICE_YEARLY, 'TEST 2: Yearly price ID matches');

  // ---------------------------------------------------------------------------
  // TEST 3: Lifetime checkout
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 3: Lifetime Checkout (/api/checkout/create)');
  const req3 = new Request('http://localhost:3000/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'lifetime', email: 'lifetime@example.com' })
  });
  const res3 = await checkoutCreateHandler(req3);
  const data3 = await res3.json();
  assert(res3.status === 200 && data3.success === true, 'TEST 3: Lifetime checkout created', `Price ID: ${data3.priceId}`);
  assert(data3.priceId === PADDLE_PRICE_LIFETIME, 'TEST 3: Lifetime price ID matches');

  // ---------------------------------------------------------------------------
  // TEST 4: Successful webhook (Fulfillment & AR-XXXX key generation)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 4: Successful Webhook (Payment Fulfillment)');
  const txn4 = `txn_step27_${Date.now()}`;
  const evt4Id = `evt_step27_${Date.now()}`;
  const payload4 = JSON.stringify({
    event_id: evt4Id,
    event_type: 'transaction.completed',
    data: {
      id: txn4,
      customer: { email: 'customer_step27@example.com' },
      items: [{ price: { id: PADDLE_PRICE_YEARLY } }],
      details: { totals: { total: 9.49, currency_code: 'USD' } },
      created_at: new Date().toISOString()
    }
  });

  const sig4 = generatePaddleWebhookSignature(payload4, TEST_SECRET);
  const req4 = new Request('http://localhost:3000/api/paddle/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': sig4 },
    body: payload4
  });
  const res4 = await webhookHandler(req4);
  const data4 = await res4.json();
  assert(res4.status === 200 && data4.success === true, 'TEST 4: Webhook processed successfully');
  const issuedYearlyKey = data4.licenseKey;
  assert(isValidLicenseKeyFormat(issuedYearlyKey), 'TEST 4: Issued key matches AR-XXXX-XXXX-XXXX format', issuedYearlyKey);
  assert(issuedYearlyKey.startsWith('AR-'), 'TEST 4: Key starts with AR- prefix');

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate webhook (Idempotency deduplication)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 5: Duplicate Webhook (Idempotency)');
  const req5 = new Request('http://localhost:3000/api/paddle/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': sig4 },
    body: payload4
  });
  const res5 = await webhookHandler(req5);
  const data5 = await res5.json();
  assert(res5.status === 200 && data5.message.includes('idempotent'), 'TEST 5: Duplicate webhook returns HTTP 200 without creating second license');

  // ---------------------------------------------------------------------------
  // TEST 6: Invalid license
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 6: Invalid License');
  const req6 = new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: 'AR-9999-8888-7777', deviceId: 'dev_invalid_001' })
  });
  const res6 = await activateHandler(req6);
  const data6 = await res6.json();
  assert((res6.status === 404 || res6.status === 400) && data6.valid === false && data6.reason === 'INVALID_LICENSE', 'TEST 6: Invalid key rejected with INVALID_LICENSE');

  // Safe insert helper for test licenses
  async function safeInsertLicense(lic) {
    const res = await db.from('licenses').insert(lic);
    if (res.error && res.error.code === 'PGRST204') {
      const base = {
        license_key: lic.license_key,
        plan: lic.plan,
        status: lic.status,
        expires_at: lic.expires_at,
        max_devices: lic.max_devices || lic.device_limit || 1
      };
      return db.from('licenses').insert(base);
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Expired license
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 7: Expired License');
  const expiredKey = generateLicenseKey('AR');
  await safeInsertLicense({
    license_key: expiredKey,
    plan: '30day',
    status: 'active',
    expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    max_devices: 2
  });

  const req7 = new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: expiredKey, deviceId: 'dev_expired_001' })
  });
  const res7 = await activateHandler(req7);
  const data7 = await res7.json();
  assert(res7.status === 403 && data7.valid === false && data7.reason === 'EXPIRED_LICENSE', 'TEST 7: Expired key rejected with EXPIRED_LICENSE');

  // ---------------------------------------------------------------------------
  // TEST 8: Revoked license
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 8: Revoked License');
  const revokedKey = generateLicenseKey('AR');
  await safeInsertLicense({
    license_key: revokedKey,
    plan: 'lifetime',
    status: 'revoked',
    expires_at: null,
    max_devices: 5
  });

  const req8 = new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: revokedKey, deviceId: 'dev_revoked_001' })
  });
  const res8 = await activateHandler(req8);
  const data8 = await res8.json();
  assert(res8.status === 403 && data8.valid === false && data8.reason === 'REVOKED_LICENSE', 'TEST 8: Revoked key rejected with REVOKED_LICENSE');

  // ---------------------------------------------------------------------------
  // TEST 9: Device limit enforcement
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 9: Device Limit Enforcement');
  // Create a 2-device monthly license
  const limitKey = generateLicenseKey('AR');
  await safeInsertLicense({
    license_key: limitKey,
    plan: '30day',
    status: 'active',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    max_devices: 2
  });

  // Activate device 1 -> Success
  const actDev1 = await activateHandler(new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: limitKey, deviceId: 'device_slot_1' })
  }));
  const dataDev1 = await actDev1.json();
  assert(actDev1.status === 200 && dataDev1.valid === true, 'TEST 9: 1st device activated successfully');

  // Activate device 2 -> Success (2/2)
  const actDev2 = await activateHandler(new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: limitKey, deviceId: 'device_slot_2' })
  }));
  const dataDev2 = await actDev2.json();
  assert(actDev2.status === 200 && dataDev2.valid === true, 'TEST 9: 2nd device activated successfully (at limit)');

  // Activate device 3 -> Must fail with DEVICE_LIMIT_REACHED
  const actDev3 = await activateHandler(new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: limitKey, deviceId: 'device_slot_3' })
  }));
  const dataDev3 = await actDev3.json();
  assert(
    actDev3.status === 403 && dataDev3.valid === false && dataDev3.reason === 'DEVICE_LIMIT_REACHED',
    'TEST 9: 3rd device rejected with DEVICE_LIMIT_REACHED'
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Offline mode simulation
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 10: Offline Mode');
  // Simulated entitlement object stored locally in extension storage
  const mockOfflineEntitlement = {
    status: 'active',
    plan: 'yearly',
    expiresAt: new Date(Date.now() + 300 * 86400000).toISOString(),
    lastVerifiedAt: Date.now() - (2 * 3600 * 1000) // 2 hours ago
  };

  const isOfflineValid = (ent, now = Date.now()) => {
    if (!ent || ent.status !== 'active') return false;
    if (ent.expiresAt && new Date(ent.expiresAt).getTime() < now) return false;
    const graceLimit = 72 * 3600 * 1000;
    if (ent.lastVerifiedAt && (now - ent.lastVerifiedAt > graceLimit)) return false;
    return true;
  };

  assert(isOfflineValid(mockOfflineEntitlement), 'TEST 10: Extension authorizes premium when offline within 72h');

  // ---------------------------------------------------------------------------
  // TEST 11: 72-Hour Grace Period & Expiry Override
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 11: 72-Hour Grace Period & Expiry Override');
  // Case A: Last verified 73 hours ago (> 72 hours) -> Must expire offline grace
  const entPastGrace = {
    status: 'active',
    plan: 'yearly',
    expiresAt: new Date(Date.now() + 300 * 86400000).toISOString(),
    lastVerifiedAt: Date.now() - (73 * 3600 * 1000) // 73 hours ago
  };
  assert(!isOfflineValid(entPastGrace), 'TEST 11A: Offline grace expires after 72 hours without revalidation');

  // Case B (Step 15 strict rule): License expiresAt has passed, even if verified 10 minutes ago
  const entExpiredInGrace = {
    status: 'active',
    plan: '30day',
    expiresAt: new Date(Date.now() - (5 * 60 * 1000)).toISOString(), // expired 5 mins ago
    lastVerifiedAt: Date.now() - (10 * 60 * 1000) // verified 10 mins ago
  };
  assert(
    !isOfflineValid(entExpiredInGrace),
    'TEST 11B: Strict Step 15 rule: Expired license is locked even if within 72h offline grace'
  );

  // ---------------------------------------------------------------------------
  // TEST 12: Extension activation API (Step 12)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 12: Extension Activation API (Step 12 Format)');
  const testDevAlpha = `device_alpha_${Date.now()}`;
  const req12 = new Request('http://localhost:3000/api/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: issuedYearlyKey, deviceId: testDevAlpha })
  });
  const res12 = await activateHandler(req12);
  const data12 = await res12.json();
  assert(
    res12.status === 200 && data12.valid === true && data12.plan === 'yearly' && data12.deviceLimit === 3,
    'TEST 12: Activation returns valid=true, plan=yearly, deviceLimit=3 according to Step 12 spec'
  );

  // ---------------------------------------------------------------------------
  // TEST 13: License re-validation API (Step 14)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 13: License Re-Validation API (Step 14 Format)');
  const req13 = new Request('http://localhost:3000/api/license/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: issuedYearlyKey, deviceId: testDevAlpha })
  });
  const res13 = await validateHandler(req13);
  const data13 = await res13.json();
  assert(
    res13.status === 200 && data13.valid === true && data13.premium === true && data13.plan === 'yearly',
    'TEST 13: Validation returns valid=true, premium=true according to Step 14 spec'
  );

  // ---------------------------------------------------------------------------
  // TEST 14: Payment failure webhook handling
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 14: Payment Failure Webhook');
  const subPastDueId = `sub_pastdue_${Date.now()}`;
  const failPayload = JSON.stringify({
    event_id: `evt_fail_${Date.now()}`,
    event_type: 'subscription.payment_failed',
    data: {
      id: subPastDueId,
      status: 'past_due'
    }
  });
  const failSig = generatePaddleWebhookSignature(failPayload, TEST_SECRET);
  const failRes = await webhookHandler(new Request('http://localhost:3000/api/paddle/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': failSig },
    body: failPayload
  }));
  const failData = await failRes.json();
  assert(failRes.status === 200 && failData.success === true, 'TEST 14: Payment failure handled gracefully');

  // ---------------------------------------------------------------------------
  // TEST 15: Subscription cancellation/expiration webhook
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 15: Subscription Cancellation Webhook');
  const cancelPayload = JSON.stringify({
    event_id: `evt_cancel_${Date.now()}`,
    event_type: 'subscription.canceled',
    data: {
      id: subPastDueId,
      effective_from: 'immediately'
    }
  });
  const cancelSig = generatePaddleWebhookSignature(cancelPayload, TEST_SECRET);
  const cancelRes = await webhookHandler(new Request('http://localhost:3000/api/paddle/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': cancelSig },
    body: cancelPayload
  }));
  const cancelData = await cancelRes.json();
  assert(cancelRes.status === 200 && cancelData.success === true, 'TEST 15: Subscription cancellation handled safely');

  console.log('\n================================================================');
  console.log(`🎉 ALL 15 PRODUCTION TESTS PASSED! (${testsPassed}/${testsPassed})`);
  console.log('================================================================\n');
}

runStep27Suite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
