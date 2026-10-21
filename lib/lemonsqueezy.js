/**
 * AutoReels Scroll — Lemon Squeezy Payment & Webhook Integration
 * 
 * Official Lemon Squeezy API v1 integration for hosted checkout and cryptographic
 * webhook signature verification.
 * 
 * SERVER-SIDE ONLY — Never expose API keys or webhook secrets to the client.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// 1. Environment & Mode Configuration
// ---------------------------------------------------------------------------

export const LEMON_SQUEEZY_MODE = (
  process.env.LEMON_SQUEEZY_MODE ||
  'test'
).toLowerCase().trim();

export const IS_TEST_MODE = LEMON_SQUEEZY_MODE === 'test';
export const IS_LIVE_MODE = LEMON_SQUEEZY_MODE === 'live' || LEMON_SQUEEZY_MODE === 'production';

// Server-side Secrets
export const LEMON_SQUEEZY_API_KEY = (process.env.LEMON_SQUEEZY_API_KEY || '').trim();
export const LEMON_SQUEEZY_STORE_ID = (process.env.LEMON_SQUEEZY_STORE_ID || '').trim();
export const LEMON_SQUEEZY_WEBHOOK_SECRET = (process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '').trim();

// Variant IDs for the 3 paid one-time plans
export const LEMON_SQUEEZY_VARIANT_MONTHLY = (process.env.LEMON_SQUEEZY_VARIANT_MONTHLY || '').trim();
export const LEMON_SQUEEZY_VARIANT_YEARLY = (process.env.LEMON_SQUEEZY_VARIANT_YEARLY || '').trim();
export const LEMON_SQUEEZY_VARIANT_LIFETIME = (process.env.LEMON_SQUEEZY_VARIANT_LIFETIME || '').trim();

// App base URL for redirects
export const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://autoreels-license-server.vercel.app'
).replace(/\/+$/, '');

// Lemon Squeezy API v1 Base URL
const LEMON_SQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';

// ---------------------------------------------------------------------------
// 2. Authoritative Plan Definitions
// ---------------------------------------------------------------------------

export const PLANS = {
  '7day': {
    id: '7day',
    title: '7-Day Free Trial',
    priceUsd: 0.00,
    days: 7,
    maxDevices: 1,
    isFree: true,
    requiresPayment: false,
    badge: 'Free Trial',
    buttonText: 'Start 7-Day Free Trial'
  },
  '30day': {
    id: '30day',
    title: '1 Month Pass',
    priceUsd: 1.49,
    days: 30,
    maxDevices: 2,
    isFree: false,
    requiresPayment: true,
    billingType: 'One-time payment',
    badge: '1 Month',
    buttonText: 'Select 1 Month Pass ($1.49)',
    getVariantId: () => (process.env.LEMON_SQUEEZY_VARIANT_MONTHLY || LEMON_SQUEEZY_VARIANT_MONTHLY || '').trim()
  },
  'yearly': {
    id: 'yearly',
    title: '1 Year Pro',
    priceUsd: 9.49,
    days: 365,
    maxDevices: 3,
    isFree: false,
    requiresPayment: true,
    billingType: 'One-time payment',
    badge: 'Most Popular',
    buttonText: 'Get 1 Year Pro ($9.49)',
    getVariantId: () => (process.env.LEMON_SQUEEZY_VARIANT_YEARLY || LEMON_SQUEEZY_VARIANT_YEARLY || '').trim()
  },
  'lifetime': {
    id: 'lifetime',
    title: 'Lifetime VIP',
    priceUsd: 19.99,
    days: null, // Lifetime (Never expires)
    maxDevices: 5,
    isFree: false,
    requiresPayment: true,
    billingType: 'One-time payment',
    badge: 'Best Value',
    buttonText: 'Select Lifetime VIP ($19.99)',
    getVariantId: () => (process.env.LEMON_SQUEEZY_VARIANT_LIFETIME || LEMON_SQUEEZY_VARIANT_LIFETIME || '').trim()
  }
};

// Aliases for compatibility
PLANS['monthly'] = PLANS['30day'];
PLANS['MONTHLY'] = PLANS['30day'];
PLANS['1month'] = PLANS['30day'];
PLANS['YEARLY'] = PLANS['yearly'];
PLANS['1year'] = PLANS['yearly'];
PLANS['LIFETIME'] = PLANS['lifetime'];

/**
 * Validates Lemon Squeezy server environment configuration.
 * @returns {{ valid: boolean, errors: string[], warnings: string[], mode: string }}
 */
export function validateLemonSqueezyConfig() {
  const errors = [];
  const warnings = [];

  const apiKey = (process.env.LEMON_SQUEEZY_API_KEY || LEMON_SQUEEZY_API_KEY || '').trim();
  const storeId = (process.env.LEMON_SQUEEZY_STORE_ID || LEMON_SQUEEZY_STORE_ID || '').trim();
  const monthlyVar = (process.env.LEMON_SQUEEZY_VARIANT_MONTHLY || LEMON_SQUEEZY_VARIANT_MONTHLY || '').trim();
  const yearlyVar = (process.env.LEMON_SQUEEZY_VARIANT_YEARLY || LEMON_SQUEEZY_VARIANT_YEARLY || '').trim();
  const lifetimeVar = (process.env.LEMON_SQUEEZY_VARIANT_LIFETIME || LEMON_SQUEEZY_VARIANT_LIFETIME || '').trim();
  const webhookSecret = (process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || LEMON_SQUEEZY_WEBHOOK_SECRET || '').trim();
  const mode = (process.env.LEMON_SQUEEZY_MODE || LEMON_SQUEEZY_MODE || 'test').toLowerCase().trim();

  if (!apiKey) {
    errors.push('LEMON_SQUEEZY_API_KEY is not set.');
  }

  if (!storeId) {
    errors.push('LEMON_SQUEEZY_STORE_ID is not set.');
  }

  if (!monthlyVar) {
    warnings.push('LEMON_SQUEEZY_VARIANT_MONTHLY is not set.');
  }
  if (!yearlyVar) {
    warnings.push('LEMON_SQUEEZY_VARIANT_YEARLY is not set.');
  }
  if (!lifetimeVar) {
    warnings.push('LEMON_SQUEEZY_VARIANT_LIFETIME is not set.');
  }

  if (!webhookSecret) {
    warnings.push('LEMON_SQUEEZY_WEBHOOK_SECRET is not set.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    mode
  };
}

/**
 * Maps a plan identifier to its authoritative server-side variant ID.
 * @param {string} planId
 * @returns {string | null}
 */
export function getVariantIdForPlan(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.requiresPayment || typeof plan.getVariantId !== 'function') {
    return null;
  }
  return plan.getVariantId() || null;
}

export const getLemonSqueezyVariantId = getVariantIdForPlan;

/**
 * Authoritatively resolves plan ID strictly from a verified Lemon Squeezy Variant ID.
 * @param {string | number} variantId
 * @returns {string | null} '30day' | 'yearly' | 'lifetime' or null
 */
export function resolvePlanFromVariantId(variantId) {
  if (!variantId) return null;
  const vid = String(variantId).trim();

  const monthlyVar = (process.env.LEMON_SQUEEZY_VARIANT_MONTHLY || LEMON_SQUEEZY_VARIANT_MONTHLY || '').trim();
  const yearlyVar = (process.env.LEMON_SQUEEZY_VARIANT_YEARLY || LEMON_SQUEEZY_VARIANT_YEARLY || '').trim();
  const lifetimeVar = (process.env.LEMON_SQUEEZY_VARIANT_LIFETIME || LEMON_SQUEEZY_VARIANT_LIFETIME || '').trim();

  if (monthlyVar && vid === monthlyVar) {
    return '30day';
  }
  if (yearlyVar && vid === yearlyVar) {
    return 'yearly';
  }
  if (lifetimeVar && vid === lifetimeVar) {
    return 'lifetime';
  }

  return null;
}

/**
 * Calculates expiration timestamp for a given plan.
 * @param {string} planId
 * @param {Date} [baseDate=new Date()]
 * @returns {string | null} ISO timestamp or null for lifetime
 */
export function calculateExpirationDate(planId, baseDate = new Date()) {
  const plan = PLANS[planId];
  if (!plan || plan.days === null) {
    return null; // Lifetime: never expires
  }
  const date = new Date(baseDate.getTime() + plan.days * 24 * 3600 * 1000);
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// 3. Official Lemon Squeezy Checkout API
// ---------------------------------------------------------------------------

/**
 * Creates a Lemon Squeezy hosted checkout session using the official JSON:API schema.
 * 
 * @param {object} params
 * @param {string} params.planId - '30day' | 'yearly' | 'lifetime'
 * @param {string} [params.email] - Optional pre-filled customer email
 * @param {string} params.claimToken - Secure claim correlation token
 * @param {string} [params.redirectUrl] - Custom redirect URL
 * @returns {Promise<{ success: boolean, checkoutUrl?: string, error?: string }>}
 */
export async function createLemonSqueezyCheckout({ planId, email = '', claimToken, redirectUrl = '' }) {
  const plan = PLANS[planId];
  if (!plan || !plan.requiresPayment) {
    return { success: false, error: 'Invalid plan selected for payment.' };
  }

  const variantId = getVariantIdForPlan(plan.id);
  if (!variantId) {
    return {
      success: false,
      error: `Lemon Squeezy Variant ID for plan "${plan.title}" is not configured on the server.`
    };
  }

  const storeId = (process.env.LEMON_SQUEEZY_STORE_ID || LEMON_SQUEEZY_STORE_ID || '').trim();
  if (!storeId) {
    return {
      success: false,
      error: 'LEMON_SQUEEZY_STORE_ID is not configured on the server.'
    };
  }

  const apiKey = (process.env.LEMON_SQUEEZY_API_KEY || LEMON_SQUEEZY_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'LEMON_SQUEEZY_API_KEY is not configured on the server.'
    };
  }

  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || APP_BASE_URL || 'https://autoreels-license-server.vercel.app').replace(/\/+$/, '');
  const finalRedirectUrl = redirectUrl || `${baseUrl}/checkout/success?claim_token=${encodeURIComponent(claimToken)}`;

  // Construct official JSON:API payload
  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: email ? email.trim().toLowerCase() : undefined,
          custom: {
            plan: plan.id,
            claim_token: claimToken
          }
        },
        product_options: {
          redirect_url: finalRedirectUrl,
          receipt_button_text: 'Activate AutoReels License',
          receipt_link_url: finalRedirectUrl
        },
        checkout_options: {
          dark: true
        }
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: String(storeId).trim()
          }
        },
        variant: {
          data: {
            type: 'variants',
            id: String(variantId).trim()
          }
        }
      }
    }
  };

  try {
    const res = await fetch(`${LEMON_SQUEEZY_API_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || `Lemon Squeezy API returned status ${res.status}`;
      console.error('[Lemon Squeezy API Error]', res.status, data);
      return { success: false, error: errorMsg };
    }

    const checkoutUrl = data?.data?.attributes?.url;
    if (!checkoutUrl) {
      return { success: false, error: 'Checkout URL missing from Lemon Squeezy API response.' };
    }

    return {
      success: true,
      checkoutUrl
    };
  } catch (err) {
    console.error('[Lemon Squeezy Fetch Exception]', err);
    return {
      success: false,
      error: 'Failed to communicate with Lemon Squeezy API: ' + (err.message || 'Unknown network error')
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Webhook Cryptographic Signature Verification
// ---------------------------------------------------------------------------

/**
 * Cryptographically verifies a Lemon Squeezy webhook signature.
 * Lemon Squeezy calculates HMAC SHA256 of the exact raw request body using the webhook secret,
 * and sends it as a lowercase hex string in the X-Signature header.
 * 
 * Uses constant-time comparison to prevent timing attacks.
 * 
 * @param {string} rawBody - Exact unparsed request body string
 * @param {string} signatureHeader - Value of 'x-signature' header
 * @param {string} [secretOverride] - Optional secret override for testing
 * @returns {{ valid: boolean, error?: string }}
 */
export function verifyLemonSqueezyWebhook(rawBody, signatureHeader, secretOverride = null) {
  const secret = secretOverride || (process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || LEMON_SQUEEZY_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return { valid: false, error: 'LEMON_SQUEEZY_WEBHOOK_SECRET is not configured on the server.' };
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, error: 'Missing X-Signature header.' };
  }

  if (typeof rawBody !== 'string') {
    return { valid: false, error: 'rawBody must be a raw string.' };
  }

  const cleanSignature = signatureHeader.trim().toLowerCase();

  // Compute HMAC SHA256 of the raw body
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Convert both to buffers for constant-time comparison
  const signatureBuffer = Buffer.from(cleanSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  // Check buffer lengths first to avoid timingSafeEqual throw
  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Signature length mismatch.' };
  }

  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  if (!isValid) {
    return { valid: false, error: 'Signature hash mismatch.' };
  }

  return { valid: true };
}

/**
 * Utility helper to generate a valid Lemon Squeezy signature header for testing.
 * @param {string} rawBody
 * @param {string} secret
 * @returns {string} Hex HMAC SHA256 signature
 */
export function generateLemonSqueezyWebhookSignature(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}
