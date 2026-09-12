/**
 * AutoReels Scroll - Paddle Checkout Public Configuration API
 * Route: GET /api/checkout/config
 * 
 * Safely provides public client-side initialization parameters:
 * - environment ('sandbox' | 'production')
 * - public client token (never exposes secret keys)
 * - token status and prefix
 * - configured price IDs
 * - development diagnostic status
 */

import {
  PADDLE_ENVIRONMENT,
  PADDLE_CLIENT_TOKEN,
  PADDLE_PRICE_MONTHLY,
  PADDLE_PRICE_YEARLY,
  PADDLE_PRICE_LIFETIME,
  IS_PRODUCTION
} from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    const rawToken = PADDLE_CLIENT_TOKEN || '';
    const hasToken = Boolean(rawToken);
    const isSampleToken = rawToken.includes('sample') || rawToken === 'test_sample_client_token';

    let tokenPrefix = 'none';
    if (rawToken.startsWith('test_')) tokenPrefix = 'test_';
    else if (rawToken.startsWith('live_')) tokenPrefix = 'live_';
    else if (hasToken) tokenPrefix = 'unknown';

    // Masked token for safe client diagnostics: e.g. test_sam...1234
    let maskedToken = '';
    if (rawToken.length > 10) {
      maskedToken = `${rawToken.substring(0, 8)}...${rawToken.substring(rawToken.length - 4)}`;
    } else if (hasToken) {
      maskedToken = `${rawToken.substring(0, 4)}...`;
    }

    const isMonthlySample = PADDLE_PRICE_MONTHLY.includes('sample');
    const isYearlySample = PADDLE_PRICE_YEARLY.includes('sample');
    const isLifetimeSample = PADDLE_PRICE_LIFETIME.includes('sample');
    const isSampleConfig = isSampleToken || isMonthlySample || isYearlySample || isLifetimeSample;

    return jsonResponse(
      {
        success: true,
        environment: PADDLE_ENVIRONMENT,
        isProduction: IS_PRODUCTION,
        clientToken: rawToken,
        diagnostics: {
          hasToken,
          tokenPrefix,
          maskedToken,
          isSampleToken,
          isSampleConfig,
          prices: {
            '30day': {
              id: PADDLE_PRICE_MONTHLY,
              isSample: isMonthlySample,
              amount: '$1.49'
            },
            'yearly': {
              id: PADDLE_PRICE_YEARLY,
              isSample: isYearlySample,
              amount: '$9.49'
            },
            'lifetime': {
              id: PADDLE_PRICE_LIFETIME,
              isSample: isLifetimeSample,
              amount: '$19.99'
            }
          }
        }
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Checkout Config API] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
