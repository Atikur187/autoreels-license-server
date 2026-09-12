/**
 * AutoReels Scroll - Sandbox Payment Simulation API
 * Route: POST /api/checkout/simulate-sandbox-payment
 * 
 * Allows instant sandbox testing of the end-to-end payment flow:
 * 1. Generates a realistic Paddle transaction.completed event
 * 2. Cryptographically signs it with HMAC-SHA256 using PADDLE_WEBHOOK_SECRET
 * 3. Sends it through the real authoritative /api/paddle/webhook handler
 * 4. Records purchase and generates real ARS license in Supabase
 * 
 * This enables full testing in local development without waiting for live Paddle approval.
 */

import {
  PLANS,
  PADDLE_WEBHOOK_SECRET,
  generatePaddleWebhookSignature,
  PADDLE_PRICE_MONTHLY,
  PADDLE_PRICE_YEARLY,
  PADDLE_PRICE_LIFETIME,
  IS_PRODUCTION
} from '../../../../lib/paddle.js';
import { verifyAdminAuth } from '../../../../lib/admin-auth.js';
import { POST as webhookHandler } from '../../paddle/webhook/route.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // Strictly forbid in production
    if (IS_PRODUCTION || process.env.NODE_ENV === 'production') {
      return jsonResponse(
        { success: false, error: 'Forbidden: Sandbox testing tools are strictly disabled in production.' },
        403,
        request
      );
    }

    // Require admin authentication even in development
    if (!verifyAdminAuth(request)) {
      return jsonResponse(
        { success: false, error: 'Unauthorized: Admin authentication required for developer testing tools.' },
        401,
        request
      );
    }

    const body = await request.json().catch(() => ({}));
    const { plan: planId = '30day', email = 'customer@example.com' } = body;

    const planConfig = PLANS[planId] || PLANS['30day'];
    let priceId = PADDLE_PRICE_MONTHLY;
    if (planId === 'yearly') priceId = PADDLE_PRICE_YEARLY;
    if (planId === 'lifetime') priceId = PADDLE_PRICE_LIFETIME;

    const cleanEmail = (email && email.includes('@')) ? email.trim().toLowerCase() : 'atikurtohman483@gmail.com';
    const transactionId = `txn_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Build authentic Paddle Billing event payload
    const eventPayload = {
      event_id: `evt_sb_${Date.now()}`,
      event_type: 'transaction.completed',
      occurred_at: new Date().toISOString(),
      data: {
        id: transactionId,
        status: 'completed',
        customer_id: `ctm_sb_${Date.now()}`,
        customer: { email: cleanEmail },
        customer_details: { email: cleanEmail },
        items: [
          {
            price: { id: priceId },
            price_id: priceId,
            quantity: 1
          }
        ],
        details: {
          totals: {
            total: planConfig.priceUsd,
            grand_total: planConfig.priceUsd,
            currency_code: 'USD'
          }
        },
        billed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    };

    const rawBody = JSON.stringify(eventPayload);
    const secret = process.env.PADDLE_WEBHOOK_SECRET || PADDLE_WEBHOOK_SECRET || 'pdl_whsec_test_webhook_secret_12345';
    const signature = generatePaddleWebhookSignature(rawBody, secret);

    // Invoke real webhook receiver
    const webhookReq = new Request('http://localhost:3500/api/paddle/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': signature
      },
      body: rawBody
    });

    const webhookRes = await webhookHandler(webhookReq);
    const webhookData = await webhookRes.json();

    if (!webhookRes.ok || !webhookData.success) {
      return jsonResponse(
        { success: false, error: webhookData.error || 'Webhook execution failed.' },
        webhookRes.status,
        request
      );
    }

    return jsonResponse(
      {
        success: true,
        transactionId,
        licenseKey: webhookData.licenseKey,
        plan: webhookData.plan,
        redirectUrl: `/checkout/success?transaction_id=${encodeURIComponent(transactionId)}`
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Simulate Sandbox Payment] Error:', err);
    return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500, request);
  }
}
