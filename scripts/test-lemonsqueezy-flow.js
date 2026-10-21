/**
 * AutoReels Scroll - Lemon Squeezy Integration & End-to-End Test Suite
 * 
 * Verifies all 16 requirements specified in the Master Prompt:
 * 1. Checkout config & plan validation
 * 2. Server-side checkout creation & hosted checkout URL generation
 * 3. Webhook HMAC-SHA256 signature verification (valid vs invalid)
 * 4. Paid order processing -> purchase & unique ARS license generation
 * 5. Webhook idempotency (duplicate orders do not duplicate licenses)
 * 6. Customer license delivery & claim token retrieval
 * 7. Refund webhook processing -> license revocation
 * 8. Chrome extension license activation & status enforcement (revoked, expired, active)
 * 9. Admin API authorization protection
 * 10. Free trial generation & anti-abuse checks
 */

import crypto from 'crypto';
import { POST as createCheckoutPOST } from '../app/api/checkout/create/route.js';
import { GET as configGET } from '../app/api/checkout/config/route.js';
import { POST as webhookPOST } from '../app/api/lemonsqueezy/webhook/route.js';
import { GET as claimGET } from '../app/api/license/claim/route.js';
import { POST as activatePOST } from '../app/api/license/activate/route.js';
import { POST as validatePOST } from '../app/api/license/validate/route.js';
import { POST as createTrialPOST } from '../app/api/checkout/create-trial/route.js';
import { GET as adminOverviewGET } from '../app/api/admin/overview/route.js';
import { GET as adminWebhooksGET } from '../app/api/admin/webhooks/route.js';
import { getDb } from '../lib/supabase.js';

// Setup environment for testing
process.env.LEMON_SQUEEZY_MODE = 'test';
process.env.LEMON_SQUEEZY_API_KEY = 'test_api_key_sample';
process.env.LEMON_SQUEEZY_STORE_ID = '12345';
process.env.LEMON_SQUEEZY_VARIANT_MONTHLY = 'variant_m_1001';
process.env.LEMON_SQUEEZY_VARIANT_YEARLY = 'variant_y_1002';
process.env.LEMON_SQUEEZY_VARIANT_LIFETIME = 'variant_l_1003';
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = 'ls_webhook_secret_test_xyz789';
process.env.ADMIN_API_KEY = 'admin-secret-key-change-in-production';
process.env.APP_BASE_URL = 'https://autoreels-license-server.vercel.app';

// Hermetic mock for Lemon Squeezy Checkout API
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (url.includes('api.lemonsqueezy.com/v1/checkouts')) {
    return new Response(
      JSON.stringify({
        data: {
          type: 'checkouts',
          id: 'mock_chk_123',
          attributes: {
            url: 'https://autoreels.lemonsqueezy.com/checkout/buy/sample-test-checkout-url'
          }
        }
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/vnd.api+json' }
      }
    );
  }
  return originalFetch ? originalFetch(input, init) : new Response('Not found', { status: 404 });
};

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    testsPassed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 AUTOREELS SCROLL - LEMON SQUEEZY VERIFICATION SUITE');
  console.log('======================================================\n');

  // TEST 1: Checkout Config API
  console.log('--- TEST 1: Checkout Configuration Diagnostics ---');
  {
    const req = new Request('http://localhost:3000/api/checkout/config');
    const res = await configGET(req);
    const data = await res.json();
    assert(res.status === 200, 'Config endpoint returns HTTP 200');
    assert(data.provider === 'lemonsqueezy', 'Provider is Lemon Squeezy');
    assert(data.mode === 'test', 'Mode is set to test');
    assert(data.variants && data.variants['30day'] === 'variant_m_1001', 'Monthly variant mapped');
    assert(data.variants && data.variants['yearly'] === 'variant_y_1002', 'Yearly variant mapped');
    assert(data.variants && data.variants['lifetime'] === 'variant_l_1003', 'Lifetime variant mapped');
  }

  // TEST 2: Server-Side Checkout Creation
  console.log('\n--- TEST 2: Checkout Creation & Plan Validation ---');
  let claimTokenForLater = null;
  {
    // Test invalid plan
    const badReq = new Request('http://localhost:3000/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'hacked_plan_free' })
    });
    const badRes = await createCheckoutPOST(badReq);
    const badData = await badRes.json();
    assert(badRes.status === 400, 'Invalid plan returns HTTP 400 Bad Request');
    assert(badData.code === 'INVALID_PLAN', 'Error code is INVALID_PLAN');

    // Test valid monthly plan
    const goodReq = new Request('http://localhost:3000/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: '30day', email: 'test.customer@example.com' })
    });
    const goodRes = await createCheckoutPOST(goodReq);
    const goodData = await goodRes.json();
    assert(goodRes.status === 200, 'Valid plan returns HTTP 200 OK');
    assert(goodData.success === true, 'Success flag is true');
    assert(Boolean(goodData.checkoutUrl), 'Hosted checkout URL is generated');
    assert(goodData.checkoutUrl.includes('lemonsqueezy.com') || goodData.checkoutUrl.includes('checkout'), 'URL points to Lemon Squeezy checkout');
    assert(Boolean(goodData.claimToken), 'Single-use claim token is returned');
    assert(goodData.claimToken.startsWith('claim_'), 'Claim token starts with claim_');
    claimTokenForLater = goodData.claimToken;
  }

  // TEST 3: Webhook HMAC Signature Verification
  console.log('\n--- TEST 3: Webhook HMAC-SHA256 Signature Verification ---');
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const testOrderId = 'ls_ord_' + Date.now();
  const testCustomerEmail = 'buyer.' + Date.now() + '@example.com';
  const rawPayload = JSON.stringify({
    meta: {
      event_name: 'order_created',
      custom_data: {
        plan: 'yearly',
        claim_token: claimTokenForLater
      }
    },
    data: {
      id: testOrderId,
      type: 'orders',
      attributes: {
        status: 'paid',
        total: 949,
        currency: 'USD',
        user_email: testCustomerEmail,
        first_order_item: {
          variant_id: 'variant_y_1002',
          product_id: 'prod_autoreels_yearly',
          variant_name: 'Yearly Pro Pass'
        },
        test_mode: true
      }
    }
  });

  {
    // Test invalid signature
    const fakeSignature = 'bad_invalid_signature_hex_1234567890abcdef1234567890abcdef12345678';
    const invalidReq = new Request('http://localhost:3000/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': fakeSignature
      },
      body: rawPayload
    });
    const invalidRes = await webhookPOST(invalidReq);
    assert(invalidRes.status === 401, 'Invalid signature returns HTTP 401 Unauthorized');
  }

  // TEST 4: Valid Order Processing
  console.log('\n--- TEST 4: Valid Order Processing & License Issuance ---');
  let issuedLicenseKey = null;
  {
    const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    const validReq = new Request('http://localhost:3000/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': validSignature
      },
      body: rawPayload
    });

    const validRes = await webhookPOST(validReq);
    const validData = await validRes.json();
    assert(validRes.status === 200, 'Valid signed webhook returns HTTP 200 OK');
    assert(validData.success === true, 'Webhook processed successfully');
    assert(Boolean(validData.licenseKey), 'ARS License key was generated');
    assert(validData.licenseKey.startsWith('ARS-'), 'License format starts with ARS-');
    assert(validData.plan === 'yearly', 'License plan matches order (yearly)');
    issuedLicenseKey = validData.licenseKey;

    // Verify DB entry
    const db = getDb();
    const { data: purchases } = await db.from('purchases').select('*').eq('lemonsqueezy_order_id', testOrderId);
    assert(purchases && purchases.length === 1, 'Purchase stored in database with order ID');
    assert(purchases[0].customer_email === testCustomerEmail, 'Customer email recorded');
  }

  // TEST 5: Idempotency (Duplicate Order Prevention)
  console.log('\n--- TEST 5: Webhook Idempotency ---');
  {
    const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    const dupReq = new Request('http://localhost:3000/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': validSignature
      },
      body: rawPayload
    });

    const dupRes = await webhookPOST(dupReq);
    const dupData = await dupRes.json();
    assert(dupRes.status === 200, 'Duplicate webhook returns HTTP 200 OK');
    assert(dupData.idempotent === true, 'Duplicate order flagged as idempotent');
    assert(dupData.licenseKey === issuedLicenseKey, 'Returns existing license without generating a duplicate');

    const db = getDb();
    const { data: purchases } = await db.from('purchases').select('*').eq('lemonsqueezy_order_id', testOrderId);
    assert(purchases.length === 1, 'Exactly 1 purchase record exists (no duplicates created)');
  }

  // TEST 6: Customer License Claim
  console.log('\n--- TEST 6: Customer License Claim via Claim Token ---');
  {
    const claimReq = new Request(`http://localhost:3000/api/license/claim?token=${claimTokenForLater}`);
    const claimRes = await claimGET(claimReq);
    const claimData = await claimRes.json();
    assert(claimRes.status === 200, 'Claim endpoint returns HTTP 200');
    assert(claimData.success === true, 'Claim success is true');
    assert(claimData.licenseKey === issuedLicenseKey, 'Customer receives correct ARS license key');
    assert(claimData.plan === 'yearly', 'Customer receives correct plan');
  }

  // TEST 7: Extension License Activation
  console.log('\n--- TEST 7: Extension License Activation (Valid Key) ---');
  const testDeviceId = 'inst_' + Math.random().toString(36).substring(2, 12);
  {
    const actReq = new Request('http://localhost:3000/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: issuedLicenseKey,
        deviceId: testDeviceId,
        installationId: testDeviceId
      })
    });
    const actRes = await activatePOST(actReq);
    const actData = await actRes.json();
    assert(actRes.status === 200, 'Extension activation returns HTTP 200');
    assert(actData.valid === true || actData.success === true, 'License is valid and activated');
    assert(actData.plan === 'yearly', 'Activated plan is yearly');
  }

  // TEST 8: Extension License Validation
  console.log('\n--- TEST 8: Extension License Validation ---');
  {
    const valReq = new Request('http://localhost:3000/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: issuedLicenseKey,
        deviceId: testDeviceId,
        installationId: testDeviceId
      })
    });
    const valRes = await validatePOST(valReq);
    const valData = await valRes.json();
    assert(valRes.status === 200, 'Validation returns HTTP 200');
    assert(valData.valid === true, 'Entitlement confirmed valid');
  }

  // TEST 9: Order Refunded Webhook & Revocation
  console.log('\n--- TEST 9: Order Refunded Webhook & Revocation ---');
  {
    const refundPayload = JSON.stringify({
      meta: {
        event_name: 'order_refunded'
      },
      data: {
        id: testOrderId,
        type: 'orders',
        attributes: {
          status: 'refunded',
          total: 949,
          currency: 'USD',
          test_mode: true
        }
      }
    });

    const refundSignature = crypto.createHmac('sha256', secret).update(refundPayload).digest('hex');
    const refundReq = new Request('http://localhost:3000/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': refundSignature
      },
      body: refundPayload
    });

    const refundRes = await webhookPOST(refundReq);
    const refundData = await refundRes.json();
    assert(refundRes.status === 200, 'Refund webhook processed with HTTP 200 OK');
    assert(refundData.action === 'revoked', 'License entitlement was revoked');

    // Extension validation must now REJECT the revoked license
    const valReq = new Request('http://localhost:3000/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: issuedLicenseKey,
        deviceId: testDeviceId
      })
    });
    const valRes = await validatePOST(valReq);
    const valData = await valRes.json();
    assert(valData.valid === false, 'Extension validation correctly rejects revoked license');
    assert(valData.code === 'LICENSE_REVOKED', 'Rejection code is LICENSE_REVOKED');
  }

  // TEST 10: Expired License Rejection
  console.log('\n--- TEST 10: Expired License Rejection ---');
  {
    const expReq = new Request('http://localhost:3000/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: 'TEST-ARS-EXPIRED-001',
        deviceId: 'dev_exp_123'
      })
    });
    const expRes = await activatePOST(expReq);
    const expData = await expRes.json();
    assert(expData.valid === false, 'Expired license is rejected');
    assert(expData.code === 'LICENSE_EXPIRED', 'Rejection code is LICENSE_EXPIRED');
  }

  // TEST 11: Admin API Security & Protection
  console.log('\n--- TEST 11: Admin API Server-Side Security ---');
  {
    // Public user without token
    const publicReq = new Request('http://localhost:3000/api/admin/overview');
    const publicRes = await adminOverviewGET(publicReq);
    assert(publicRes.status === 401, 'Unauthenticated public request to /api/admin/overview is blocked (HTTP 401)');

    const publicWhReq = new Request('http://localhost:3000/api/admin/webhooks');
    const publicWhRes = await adminWebhooksGET(publicWhReq);
    assert(publicWhRes.status === 401, 'Unauthenticated public request to /api/admin/webhooks is blocked (HTTP 401)');

    // Authenticated admin user
    const adminReq = new Request('http://localhost:3000/api/admin/overview', {
      headers: { 'x-admin-key': process.env.ADMIN_API_KEY }
    });
    const adminRes = await adminOverviewGET(adminReq);
    const adminData = await adminRes.json();
    assert(adminRes.status === 200, 'Authorized admin request returns HTTP 200 OK');
    assert(adminData.success === true, 'Admin overview data returned');
    assert(adminData.system.paymentProvider === 'lemonsqueezy', 'System reports lemonsqueezy payment provider');

    const adminWhReq = new Request('http://localhost:3000/api/admin/webhooks', {
      headers: { 'x-admin-key': process.env.ADMIN_API_KEY }
    });
    const adminWhRes = await adminWebhooksGET(adminWhReq);
    const adminWhData = await adminWhRes.json();
    assert(adminWhRes.status === 200, 'Authorized admin request to /api/admin/webhooks returns HTTP 200');
    assert(Array.isArray(adminWhData.events), 'Webhook events list is returned for auditing');
  }

  // TEST 12: 7-Day Free Trial Creation & Abuse Protection
  console.log('\n--- TEST 12: 7-Day Free Trial Creation & Anti-Abuse ---');
  const trialEmail = `trial.${Date.now()}@example.com`;
  {
    const trialReq = new Request('http://localhost:3000/api/checkout/create-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trialEmail })
    });
    const trialRes = await createTrialPOST(trialReq);
    const trialData = await trialRes.json();
    assert(trialRes.status === 201, 'Free trial creation returns HTTP 201 Created');
    assert(trialData.success === true, 'Trial creation successful');
    assert(trialData.plan === '7day', 'Trial plan is 7day');
    assert(Boolean(trialData.licenseKey), 'Trial returns ARS license key');

    // Attempting repeat claim with same email
    const repeatReq = new Request('http://localhost:3000/api/checkout/create-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trialEmail })
    });
    const repeatRes = await createTrialPOST(repeatReq);
    const repeatData = await repeatRes.json();
    assert(repeatRes.status === 400, 'Repeat trial claim returns HTTP 400 Bad Request');
    assert(repeatData.code === 'TRIAL_ALREADY_CLAIMED', 'Anti-abuse rejects repeat email');
  }

  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Fatal Test Error:', err);
  process.exit(1);
});
