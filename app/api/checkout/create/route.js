/**
 * AutoReels Scroll - Create Paddle Checkout Intent API
 * Route: POST /api/checkout/create
 * 
 * Returns the authoritative server-configured Paddle Price ID and public client token.
 * Never trusts client-submitted prices or amounts.
 */

import {
  PLANS,
  PADDLE_ENVIRONMENT,
  PADDLE_CLIENT_TOKEN,
  IS_PRODUCTION,
  validateEnvironmentConfig
} from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { plan: requestedPlan, email = '' } = body;

    if (!requestedPlan || !PLANS[requestedPlan]) {
      return jsonResponse({ success: false, error: 'Invalid plan selected.' }, 400, request);
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

    // Verify server environment configuration
    const validation = validateEnvironmentConfig();
    if (IS_PRODUCTION && !validation.valid) {
      console.error('[Create Checkout API] Production config error:', validation.errors);
      return jsonResponse(
        {
          success: false,
          error: 'Checkout configuration error in production: ' + validation.errors.join('; ')
        },
        500,
        request
      );
    }

    if (!PADDLE_CLIENT_TOKEN) {
      return jsonResponse(
        {
          success: false,
          error: 'Paddle Client Token is not configured. Please set PADDLE_CLIENT_TOKEN in server configuration.'
        },
        503,
        request
      );
    }

    if (!planConfig.priceId) {
      return jsonResponse(
        {
          success: false,
          error: `Paddle Price ID for plan "${requestedPlan}" is not configured.`
        },
        503,
        request
      );
    }

    return jsonResponse(
      {
        success: true,
        plan: planConfig.id,
        title: planConfig.title,
        priceUsd: planConfig.priceUsd,
        priceId: planConfig.priceId,
        billingType: planConfig.billingType,
        environment: PADDLE_ENVIRONMENT,
        clientToken: PADDLE_CLIENT_TOKEN,
        customerEmail: email ? email.trim().toLowerCase() : null
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Create Checkout API] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
