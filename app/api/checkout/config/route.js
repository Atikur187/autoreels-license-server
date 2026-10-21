/**
 * AutoReels Scroll — Lemon Squeezy Checkout Public Configuration API
 * Route: GET /api/checkout/config
 * 
 * Safely provides public payment configuration details (provider, mode, store status).
 * NEVER exposes server-side secrets or API keys.
 */

import {
  validateLemonSqueezyConfig,
  getVariantIdForPlan
} from '../../../../lib/lemonsqueezy.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    const validation = validateLemonSqueezyConfig();
    const mode = (process.env.LEMON_SQUEEZY_MODE || 'test').toLowerCase().trim();
    const isTestMode = mode === 'test';
    const isLiveMode = mode === 'live' || mode === 'production';
    const storeId = (process.env.LEMON_SQUEEZY_STORE_ID || '').trim();

    const monthlyVariant = getVariantIdForPlan('30day');
    const yearlyVariant = getVariantIdForPlan('yearly');
    const lifetimeVariant = getVariantIdForPlan('lifetime');

    return jsonResponse(
      {
        success: true,
        provider: 'lemonsqueezy',
        mode,
        isTestMode,
        isLiveMode,
        isConfigured: validation.valid,
        storeIdConfigured: Boolean(storeId),
        variantsConfigured: {
          monthly: Boolean(monthlyVariant),
          yearly: Boolean(yearlyVariant),
          lifetime: Boolean(lifetimeVariant)
        },
        variants: {
          '30day': monthlyVariant || null,
          'yearly': yearlyVariant || null,
          'lifetime': lifetimeVariant || null
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
