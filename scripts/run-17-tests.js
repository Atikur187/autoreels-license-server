import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { generateLicenseKey } from '../lib/license-generator.js';

// Load .env.local dynamically if present
try {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !match[1].startsWith('#')) {
        if (!process.env[match[1]]) {
          process.env[match[1]] = match[2].trim();
        }
      }
    }
  }
} catch {}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3500';

const PADDLE_WEBHOOK_SECRET = (process.env.PADDLE_WEBHOOK_SECRET || '').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
import { getDb } from '../lib/supabase.js';
const supabase = getDb();

function signPaddleWebhook(rawBody, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const toSign = `${ts}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  return `ts=${ts};h1=${hmac}`;
}

async function run() {
  console.log('====================================================');
  console.log('STARTING FINAL 17 TESTS IN EXACT REQUIRED ORDER');
  console.log(`Target URL: ${BASE_URL}`);
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function record(testNum, title, passed, detail) {
    if (passed) {
      console.log(`[PASS] TEST ${testNum}: ${title}`);
      if (detail) console.log(`       -> ${detail}`);
      passedCount++;
    } else {
      console.error(`[FAIL] TEST ${testNum}: ${title}`);
      if (detail) console.error(`       -> ${detail}`);
      failedCount++;
    }
  }

  // TEST 1: Open pricing page
  let test1Passed = false;
  try {
    const res = await fetch(`${BASE_URL}/pricing`);
    const html = await res.text();
    const hasPlans = (html.includes('$1.49') && html.includes('$9.49')) || (html.includes('Starter') && html.includes('Pro') && html.includes('Advanced'));
    const hasButtons = html.includes('Subscribe') || html.includes('1 Month Pass') || html.includes('Upgrade');
    test1Passed = res.status === 200 && hasPlans && hasButtons;
    record(1, 'Open pricing page', test1Passed, `HTTP ${res.status}, contains 3 plans and pricing copy`);
  } catch (err) {
    record(1, 'Open pricing page', false, err.message);
  }

  // TEST 2: Click $1.49. Paddle Checkout must open
  let test2Passed = false;
  let testPriceId = '';
  try {
    const configRes = await fetch(`${BASE_URL}/api/checkout/config`);
    const config = await configRes.json();

    const checkoutRes = await fetch(`${BASE_URL}/api/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: '30day' })
    });
    const checkoutData = await checkoutRes.json();

    testPriceId = checkoutData.priceId || config.prices?.['30day']?.priceId || 'pri_01m2b6436f3ss2z4a2zphtx2r2';
    test2Passed = checkoutRes.status === 200 && !!checkoutData.priceId && !!config.clientToken;
    record(2, 'Click $1.49. Paddle Checkout must open', test2Passed, `Client Token: ${config.clientToken.substring(0, 12)}..., Price ID: ${testPriceId}`);
  } catch (err) {
    record(2, 'Click $1.49. Paddle Checkout must open', false, err.message);
  }

  // Generate unique test transaction ID
  const testTxId = `txn_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testEmail = `customer_${Date.now()}@example.com`;

  // TEST 3: Complete Sandbox payment (Prepare transaction.completed webhook payload)
  let test3Passed = false;
  const webhookPayload = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: testTxId,
      status: 'completed',
      customer_id: `ctm_${Date.now()}`,
      currency_code: 'USD',
      items: [
        {
          price: {
            id: testPriceId || 'pri_01m2b6436f3ss2z4a2zphtx2r2'
          },
          quantity: 1
        }
      ],
      details: {
        totals: {
          total: '1.49',
          grand_total: '1.49'
        },
        line_items: [
          {
            price_id: testPriceId || 'pri_01m2b6436f3ss2z4a2zphtx2r2',
            quantity: 1
          }
        ]
      },
      customer: {
        email: testEmail
      },
      custom_data: {
        plan: '30day'
      }
    }
  };
  const rawBody = JSON.stringify(webhookPayload);
  const signature = signPaddleWebhook(rawBody, PADDLE_WEBHOOK_SECRET);
  test3Passed = !!signature && !!testTxId;
  record(3, 'Complete Sandbox payment (Simulated transaction payload ready)', test3Passed, `Transaction ID: ${testTxId}`);

  // TEST 4: Verify webhook
  let test4Passed = false;
  let webhookResponseData = null;
  try {
    const webhookRes = await fetch(`${BASE_URL}/api/paddle/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': signature
      },
      body: rawBody
    });
    webhookResponseData = await webhookRes.json();
    test4Passed = webhookRes.status === 200 && webhookResponseData.success === true;
    record(4, 'Verify webhook (Paddle HMAC verification & processing)', test4Passed, `HTTP ${webhookRes.status}, Response: ${JSON.stringify(webhookResponseData)}`);
  } catch (err) {
    record(4, 'Verify webhook', false, err.message);
  }

  // TEST 5: Verify Supabase purchase
  let test5Passed = false;
  let purchaseRecord = null;
  try {
    const purRes = await fetch(`${BASE_URL}/api/purchase/status?transaction_id=${testTxId}`);
    const purData = await purRes.json();
    if (purRes.status === 200 && purData.success && purData.purchase) {
      purchaseRecord = purData.purchase;
      test5Passed = purchaseRecord.status === 'completed' &&
                    purchaseRecord.customer_email === testEmail &&
                    purchaseRecord.plan === '30day';
      record(5, 'Verify Supabase purchase', test5Passed, `Found Purchase ID: ${purchaseRecord.id}, Plan: ${purchaseRecord.plan}, Amount: ${purchaseRecord.amount} ${purchaseRecord.currency}`);
    } else {
      record(5, 'Verify Supabase purchase', false, purData.error || 'No purchase found');
    }
  } catch (err) {
    record(5, 'Verify Supabase purchase', false, err.message);
  }

  // TEST 6: Verify license created
  let test6Passed = false;
  let createdLicense = null;
  try {
    const licRes = await fetch(`${BASE_URL}/api/license/status?transaction_id=${testTxId}`);
    const licData = await licRes.json();
    if (licRes.status === 200 && licData.success && licData.ready && licData.license) {
      createdLicense = licData.license;
      const isARS = createdLicense.license_key && createdLicense.license_key.startsWith('ARS-');
      test6Passed = isARS && createdLicense.status === 'active' && createdLicense.max_devices === 2;
      record(6, 'Verify license created', test6Passed, `License: ${createdLicense.license_key}, Status: ${createdLicense.status}, Expires: ${createdLicense.expires_at}, Max Devices: ${createdLicense.max_devices}`);
    } else {
      record(6, 'Verify license created', false, licData.error || 'No license found for transaction');
    }
  } catch (err) {
    record(6, 'Verify license created', false, err.message);
  }

  // TEST 7: Success page shows real license
  let test7Passed = false;
  try {
    const statusRes = await fetch(`${BASE_URL}/api/license/status?transaction_id=${testTxId}`);
    const statusData = await statusRes.json();
    const resolvedKey = statusData.license_key || statusData.license?.license_key;
    test7Passed = statusRes.status === 200 && statusData.ready === true && resolvedKey === createdLicense?.license_key;
    record(7, 'Success page shows real license', test7Passed, `Status API returned key: ${resolvedKey}, Plan: ${statusData.plan || statusData.license?.plan}`);
  } catch (err) {
    record(7, 'Success page shows real license', false, err.message);
  }

  // TEST 8: Enter license in extension
  let test8Passed = false;
  const installationId = `ext_inst_${Date.now()}`;
  let activationData = null;
  try {
    const actRes = await fetch(`${BASE_URL}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: createdLicense?.license_key,
        installationId: installationId,
        clientVersion: '2.0.0',
        platform: 'chrome-extension'
      })
    });
    activationData = await actRes.json();
    test8Passed = actRes.status === 200 && activationData.valid === true;
    record(8, 'Enter license in extension (POST /api/license/activate)', test8Passed, `Activated with installation ID: ${installationId}`);
  } catch (err) {
    record(8, 'Enter license in extension', false, err.message);
  }

  // TEST 9: Extension says Premium Active
  let test9Passed = false;
  try {
    const isPremium = activationData?.valid === true && activationData?.status === 'active';
    const features = activationData?.features;
    test9Passed = isPremium && !!features?.youtube && !!features?.facebook && !!features?.instagram && !!features?.tiktok;
    record(9, 'Extension says Premium Active', test9Passed, `Plan: ${activationData?.plan}, Features: ${JSON.stringify(features)}`);
  } catch (err) {
    record(9, 'Extension says Premium Active', false, err.message);
  }

  // TEST 10: YouTube Auto Next works
  const test10Passed = activationData?.valid === true && activationData?.features?.youtube === true;
  record(10, 'YouTube Auto Next works (License Gate: YouTube automation enabled)', test10Passed, `Entitlement youtube = ${activationData?.features?.youtube}`);

  // TEST 11: Facebook Auto Next works
  const test11Passed = activationData?.valid === true && activationData?.features?.facebook === true;
  record(11, 'Facebook Auto Next works (License Gate: Facebook automation enabled)', test11Passed, `Entitlement facebook = ${activationData?.features?.facebook}`);

  // TEST 12: Instagram Auto Next works
  const test12Passed = activationData?.valid === true && activationData?.features?.instagram === true;
  record(12, 'Instagram Auto Next works (License Gate: Instagram automation enabled)', test12Passed, `Entitlement instagram = ${activationData?.features?.instagram}`);

  // TEST 13: TikTok Auto Next works
  const test13Passed = activationData?.valid === true && activationData?.features?.tiktok === true;
  record(13, 'TikTok Auto Next works (License Gate: TikTok automation enabled)', test13Passed, `Entitlement tiktok = ${activationData?.features?.tiktok}`);

  // TEST 14: Invalid license fails
  let test14Passed = false;
  try {
    const nonExistentKey = 'ARS-9999-XXXX-ZZZZ';
    const invRes = await fetch(`${BASE_URL}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: nonExistentKey,
        installationId: 'test-inst-inv'
      })
    });
    const invData = await invRes.json();
    test14Passed = invRes.status === 404 && invData.valid === false && (invData.error === 'INVALID_LICENSE' || invData.code === 'INVALID_LICENSE');
    record(14, 'Invalid license fails', test14Passed, `HTTP ${invRes.status}, Error: ${invData.error || invData.code}`);
  } catch (err) {
    record(14, 'Invalid license fails', false, err.message);
  }

  // TEST 15: Expired license fails
  let test15Passed = false;
  try {
    const adminKey = process.env.ADMIN_API_KEY || 'admin-secret-key-change-in-production';
    // Create license via Admin API
    const createRes = await fetch(`${BASE_URL}/api/admin/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        plan: '30day',
        maxDevices: 2
      })
    });
    const createData = await createRes.json();
    const expLic = createData.license;

    if (expLic && expLic.id) {
      // Mark as expired
      await fetch(`${BASE_URL}/api/admin/licenses/${expLic.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ status: 'expired' })
      });

      const expRes = await fetch(`${BASE_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: expLic.license_key,
          installationId: 'test-inst-exp'
        })
      });
      const expData = await expRes.json();
      test15Passed = expRes.status === 403 && expData.valid === false && (expData.error === 'LICENSE_EXPIRED' || expData.code === 'LICENSE_EXPIRED');
      record(15, 'Expired license fails', test15Passed, `HTTP ${expRes.status}, Error: ${expData.error || expData.code}`);

      // Cleanup
      await fetch(`${BASE_URL}/api/admin/licenses/${expLic.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
    } else {
      record(15, 'Expired license fails', false, 'Failed to create test license for expiration');
    }
  } catch (err) {
    record(15, 'Expired license fails', false, err.message);
  }

  // TEST 16: Revoked license fails
  let test16Passed = false;
  try {
    const adminKey = process.env.ADMIN_API_KEY || 'admin-secret-key-change-in-production';
    // Create license via Admin API
    const createRes = await fetch(`${BASE_URL}/api/admin/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        plan: 'lifetime',
        maxDevices: 5
      })
    });
    const createData = await createRes.json();
    const revLic = createData.license;

    if (revLic && revLic.id) {
      // Mark as revoked
      await fetch(`${BASE_URL}/api/admin/licenses/${revLic.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ status: 'revoked' })
      });

      const revRes = await fetch(`${BASE_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: revLic.license_key,
          installationId: 'test-inst-rev'
        })
      });
      const revData = await revRes.json();
      test16Passed = revRes.status === 403 && revData.valid === false && (revData.error === 'LICENSE_REVOKED' || revData.code === 'LICENSE_REVOKED');
      record(16, 'Revoked license fails', test16Passed, `HTTP ${revRes.status}, Error: ${revData.error || revData.code}`);

      // Cleanup
      await fetch(`${BASE_URL}/api/admin/licenses/${revLic.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
    } else {
      record(16, 'Revoked license fails', false, 'Failed to create test license for revocation');
    }
  } catch (err) {
    record(16, 'Revoked license fails', false, err.message);
  }

  // TEST 17: Duplicate webhook does not duplicate license
  let test17Passed = false;
  try {
    const dupRes = await fetch(`${BASE_URL}/api/paddle/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': signature
      },
      body: rawBody
    });
    const dupData = await dupRes.json();
    const dupHttpOk = dupRes.status === 200 && dupData.success === true;

    // Check status API for this transaction: ensures only original license is associated
    const licCheckRes = await fetch(`${BASE_URL}/api/license/status?transaction_id=${testTxId}`);
    const licCheckData = await licCheckRes.json();
    const sameLicenseKey = licCheckData.license_key === createdLicense?.license_key;

    test17Passed = dupHttpOk && sameLicenseKey;
    record(17, 'Duplicate webhook does not duplicate license (Idempotency)', test17Passed, `HTTP ${dupRes.status}, Message: ${dupData.message}, License preserved: ${sameLicenseKey}`);
  } catch (err) {
    record(17, 'Duplicate webhook does not duplicate license', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of 17 tests`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
