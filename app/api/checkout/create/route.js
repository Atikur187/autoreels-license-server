/**
 * AutoReels Scroll — Create Lemon Squeezy Checkout API
 * Route: POST /api/checkout/create
 * 
 * Creates an official Lemon Squeezy hosted checkout session.
 * Uses authoritative server-side plan mapping and cryptographically secure claim tokens.
 * NEVER trusts client-submitted prices or amounts.
 */

import crypto from 'crypto';
import {
  PLANS,
  getVariantIdForPlan,
  createLemonSqueezyCheckout,
  LEMON_SQUEEZY_MODE,
  APP_BASE_URL
} from '../../../../lib/lemonsqueezy.js';
import { getDb } from '../../../../lib/supabase.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { plan: rawPlan, email = '' } = body;

    const requestedPlan = (rawPlan || '').toString().toLowerCase().trim();

    if (!requestedPlan || !PLANS[requestedPlan]) {
      return jsonResponse(
        {
          success: false,
          code: 'INVALID_PLAN',
          error: 'Invalid plan selected. Please choose 1 Month Pass, 1 Year Pro, or Lifetime VIP.'
        },
        400,
        request
      );
    }

    const planConfig = PLANS[requestedPlan];

    if (!planConfig.requiresPayment) {
      return jsonResponse(
        {
          success: false,
          error: 'Free trial does not require payment checkout. Use /api/checkout/create-trial.'
        },
        400,
        request
      );
    }

    const variantId = getVariantIdForPlan(planConfig.id);
    if (!variantId) {
      return jsonResponse(
        {
          success: false,
          error: `Lemon Squeezy Variant ID for plan "${planConfig.title}" is not configured in server environment.`
        },
        503,
        request
      );
    }

    // Generate cryptographically secure random single-use claim token
    const claimToken = `claim_${crypto.randomBytes(24).toString('hex')}`;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    // Record pending checkout reference for secure correlation
    const db = getDb();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    try {
      await db.from('pending_checkouts').insert({
        claim_token: claimToken,
        plan: planConfig.id,
        customer_email: cleanEmail || null,
        status: 'pending',
        expires_at: expiresAt
      });
    } catch (dbErr) {
      console.warn('[Create Checkout] Note: pending_checkouts insert warning:', dbErr.message);
    }

    const redirectUrl = `${APP_BASE_URL}/checkout/success?claim_token=${encodeURIComponent(claimToken)}`;

    // Call official Lemon Squeezy API
    const checkoutResult = await createLemonSqueezyCheckout({
      planId: planConfig.id,
      email: cleanEmail,
      claimToken,
      redirectUrl
    });

    if (!checkoutResult.success || !checkoutResult.checkoutUrl) {
      console.error('[Create Checkout] Lemon Squeezy API failure:', checkoutResult.error);
      return jsonResponse(
        {
          success: false,
          error: checkoutResult.error || 'Failed to initialize Lemon Squeezy checkout. Please verify server credentials.'
        },
        502,
        request
      );
    }

    return jsonResponse(
      {
        success: true,
        plan: planConfig.id,
        title: planConfig.title,
        priceUsd: planConfig.priceUsd,
        url: checkoutResult.checkoutUrl,
        checkoutUrl: checkoutResult.checkoutUrl,
        claimToken,
        mode: LEMON_SQUEEZY_MODE
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Create Checkout API] Exception:', err);
    return jsonResponse(
      {
        success: false,
        error: 'An internal server error occurred while creating checkout.'
      },
      500,
      request
    );
  }
}
