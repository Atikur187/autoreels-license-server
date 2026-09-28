/**
 * AutoReels Scroll - Paddle Billing Integration Helper
 * Provides server-side Paddle configuration, plan mapping, and cryptographic
 * webhook signature verification using native Node.js crypto.
 * 
 * NEVER expose secret keys or webhook secrets to the client/frontend.
 */

import crypto from 'crypto';

// Environment configuration
export const PADDLE_ENVIRONMENT = (
  process.env.PADDLE_ENV ||
  process.env.PADDLE_ENVIRONMENT ||
  'sandbox'
).toLowerCase().trim();

export const IS_PRODUCTION = PADDLE_ENVIRONMENT === 'production' || PADDLE_ENVIRONMENT === 'live';

// Secret keys (Server-side ONLY - never commit secrets to git)
export const PADDLE_API_KEY = (process.env.PADDLE_API_KEY || '').trim();
export const PADDLE_WEBHOOK_SECRET = (process.env.PADDLE_WEBHOOK_SECRET || '').trim();
export const PADDLE_BILLING_TYPE_MONTHLY = (process.env.PADDLE_BILLING_TYPE_MONTHLY || 'onetime').trim();

// Active Paddle Sandbox Price IDs (configured in Paddle Sandbox dashboard)
const DEFAULT_SANDBOX_PRICE_MONTHLY = 'pri_01m2b6436f3ss2z4a2zphtx2r2';
const DEFAULT_SANDBOX_PRICE_YEARLY = 'pri_01m2b649m3xr3rey1zepakqza8';
const DEFAULT_SANDBOX_PRICE_LIFETIME = 'pri_01m2b649zy4hemgsgazma491fj';
const DEFAULT_SANDBOX_CLIENT_TOKEN = 'test_22abe763cbc6f5b7f432db48a97';

// Price IDs configured in Paddle Dashboard (starts with pri_)
export const PADDLE_PRICE_MONTHLY = (
  process.env.PADDLE_PRICE_MONTHLY ||
  (!IS_PRODUCTION ? DEFAULT_SANDBOX_PRICE_MONTHLY : '')
).trim();

export const PADDLE_PRICE_YEARLY = (
  process.env.PADDLE_PRICE_YEARLY ||
  (!IS_PRODUCTION ? DEFAULT_SANDBOX_PRICE_YEARLY : '')
).trim();

export const PADDLE_PRICE_LIFETIME = (
  process.env.PADDLE_PRICE_LIFETIME ||
  (!IS_PRODUCTION ? DEFAULT_SANDBOX_PRICE_LIFETIME : '')
).trim();

// Public client-side token for Paddle.js overlay checkout
// Accepts either PADDLE_CLIENT_TOKEN or NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
export const PADDLE_CLIENT_TOKEN = (
  process.env.PADDLE_CLIENT_TOKEN ||
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
  (!IS_PRODUCTION ? DEFAULT_SANDBOX_CLIENT_TOKEN : '')
).trim();

export const NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = PADDLE_CLIENT_TOKEN;

/**
 * Validates Paddle credentials and environment consistency.
 * Prevents mixing sandbox and live credentials.
 */
export function validateEnvironmentConfig() {
  const errors = [];

  if (IS_PRODUCTION) {
    if (!PADDLE_CLIENT_TOKEN) {
      errors.push('PADDLE_CLIENT_TOKEN is required in production.');
    } else if (PADDLE_CLIENT_TOKEN.startsWith('test_')) {
      errors.push('CRITICAL: Sandbox client token (starts with test_) cannot be used when PADDLE_ENV=production. You must use a live_ token.');
    } else if (!PADDLE_CLIENT_TOKEN.startsWith('live_')) {
      errors.push('Production PADDLE_CLIENT_TOKEN must start with "live_".');
    }

    if (!PADDLE_PRICE_MONTHLY || PADDLE_PRICE_MONTHLY.includes('sample')) {
      errors.push('PADDLE_PRICE_MONTHLY must be configured with a real production Paddle Price ID.');
    }
    if (!PADDLE_PRICE_YEARLY || PADDLE_PRICE_YEARLY.includes('sample')) {
      errors.push('PADDLE_PRICE_YEARLY must be configured with a real production Paddle Price ID.');
    }
    if (!PADDLE_PRICE_LIFETIME || PADDLE_PRICE_LIFETIME.includes('sample')) {
      errors.push('PADDLE_PRICE_LIFETIME must be configured with a real production Paddle Price ID.');
    }

    if (!PADDLE_WEBHOOK_SECRET || PADDLE_WEBHOOK_SECRET.includes('test_webhook_secret')) {
      errors.push('PADDLE_WEBHOOK_SECRET must be configured with your live Paddle notification destination secret.');
    }
  } else {
    // Sandbox validation
    if (PADDLE_CLIENT_TOKEN && PADDLE_CLIENT_TOKEN.startsWith('live_')) {
      errors.push('CRITICAL: Live production client token cannot be used when PADDLE_ENV=sandbox. Use a test_ token or set PADDLE_ENV=production.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    environment: IS_PRODUCTION ? 'production' : 'sandbox'
  };
}

/**
 * Plan definitions and entitlement rules.
 * Client-submitted prices or plans are NEVER trusted; these server rules are authoritative.
 */
export const PLANS = {
  '7day': {
    id: '7day',
    title: '7-Day Free Trial',
    priceUsd: 0.00,
    days: 7,
    maxDevices: 1,
    isFree: true,
    requiresPayment: false
  },
  '30day': {
    id: '30day',
    title: '1 Month Pass',
    priceUsd: 1.49,
    days: 30,
    maxDevices: 2,
    priceId: PADDLE_PRICE_MONTHLY,
    billingType: PADDLE_BILLING_TYPE_MONTHLY,
    requiresPayment: true
  },
  'yearly': {
    id: 'yearly',
    title: '1 Year Pro',
    priceUsd: 9.49,
    days: 365,
    maxDevices: 3,
    priceId: PADDLE_PRICE_YEARLY,
    billingType: 'onetime', // configurable for recurring subscription if desired
    requiresPayment: true
  },
  'lifetime': {
    id: 'lifetime',
    title: 'Lifetime VIP',
    priceUsd: 19.99,
    days: null, // Lifetime access (Never expires)
    maxDevices: 5,
    priceId: PADDLE_PRICE_LIFETIME,
    billingType: 'onetime',
    requiresPayment: true
  }
};

// Plan aliases for checkout compatibility
PLANS['monthly'] = PLANS['30day'];
PLANS['MONTHLY'] = PLANS['30day'];
PLANS['1month'] = PLANS['30day'];
PLANS['YEARLY'] = PLANS['yearly'];
PLANS['1year'] = PLANS['yearly'];
PLANS['LIFETIME'] = PLANS['lifetime'];

/**
 * Maps a plan identifier ('30day', 'yearly', 'lifetime') to its Paddle Price ID.
 */
export function getPriceIdForPlan(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.requiresPayment) return null;
  return plan.priceId;
}

/**
 * Authoritatively resolves plan ID strictly from a verified Paddle Price ID.
 * NEVER trusts client-submitted customData or browser strings.
 * 
 * @param {string} priceId - Verified Paddle Price ID from transaction items
 * @param {Array} [dbProducts] - Optional products list from Supabase
 * @returns {string | null} '30day' | 'yearly' | 'lifetime' or null if unmapped
 */
export function resolvePlanFromPriceId(priceId, dbProducts = []) {
  if (!priceId || typeof priceId !== 'string') return null;
  const cleanPriceId = priceId.trim();

  // 1. Check against active products loaded from database
  if (Array.isArray(dbProducts) && dbProducts.length > 0) {
    const matched = dbProducts.find(
      (p) => p.paddle_price_id && p.paddle_price_id.trim() === cleanPriceId && p.active !== false
    );
    if (matched && PLANS[matched.plan]) {
      return matched.plan;
    }
  }

  // 2. Check against environment-configured Price IDs and Sandbox defaults
  if (cleanPriceId === PADDLE_PRICE_MONTHLY || cleanPriceId === DEFAULT_SANDBOX_PRICE_MONTHLY) return '30day';
  if (cleanPriceId === PADDLE_PRICE_YEARLY || cleanPriceId === DEFAULT_SANDBOX_PRICE_YEARLY) return 'yearly';
  if (cleanPriceId === PADDLE_PRICE_LIFETIME || cleanPriceId === DEFAULT_SANDBOX_PRICE_LIFETIME) return 'lifetime';

  return null;
}

/**
 * Resolves plan ID authoritatively from a Paddle Price ID and optional DB products.
 * STRICT SECURITY RULE: NEVER allows client-submitted customData to override or default to a paid plan.
 * Returns null if the price ID cannot be mapped authoritatively.
 * 
 * @param {string} priceId - Verified Paddle Price ID
 * @param {object} [customData] - Ignored for authorization
 * @param {Array} [dbProducts] - Active products from database
 * @returns {string | null} Plan ID or null if unmapped
 */
export function resolvePlanFromEvent(priceId, customData = {}, dbProducts = []) {
  const planFromPrice = resolvePlanFromPriceId(priceId, dbProducts);
  if (planFromPrice) {
    return planFromPrice;
  }

  // Strictly log warning and return null if price ID is unmapped
  console.warn(`[Paddle Billing] Webhook received unmapped Paddle Price ID: "${priceId}". Refusing to grant unverified plan.`);
  return null;
}

/**
 * Calculates expiration ISO timestamp based on plan ID.
 */
export function calculateExpirationDate(planId, baseDate = new Date()) {
  const plan = PLANS[planId];
  if (!plan || plan.days === null) {
    return null; // Lifetime: Never expires
  }
  const date = new Date(baseDate.getTime() + plan.days * 24 * 3600 * 1000);
  return date.toISOString();
}

/**
 * Verifies Paddle Billing webhook signature.
 * Header format: ts=1671537234;h1=hash12345...
 * Signed payload: `${ts}:${rawBody}`
 * 
 * @param {string} rawBody - Raw unparsed JSON string of the request body
 * @param {string} signatureHeader - Value of 'Paddle-Signature' header
 * @param {string} [secretOverride] - Optional webhook secret override
 * @returns {{ valid: boolean, error?: string, timestamp?: number }}
 */
export function verifyPaddleWebhook(rawBody, signatureHeader, secretOverride = null) {
  const secret = secretOverride || process.env.PADDLE_WEBHOOK_SECRET || PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    return { valid: false, error: 'PADDLE_WEBHOOK_SECRET is not configured on server.' };
  }

  if (!signatureHeader) {
    return { valid: false, error: 'Missing Paddle-Signature header.' };
  }

  // Parse ts and h1 values from header (e.g. "ts=1671537234;h1=69064c...")
  const parts = signatureHeader.split(';');
  let ts = null;
  const hashes = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'ts') {
      ts = value;
    } else if (key === 'h1') {
      hashes.push(value);
    }
  }

  if (!ts || hashes.length === 0) {
    return { valid: false, error: 'Invalid Paddle-Signature header format.' };
  }

  const timestampNumber = parseInt(ts, 10);
  if (isNaN(timestampNumber)) {
    return { valid: false, error: 'Invalid timestamp in Paddle-Signature header.' };
  }

  // Check timestamp freshness (within 10 minutes = 600s) to prevent replay attacks
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestampNumber) > 600) {
    return { valid: false, error: 'Webhook timestamp expired or out of tolerance range.' };
  }

  // Compute expected HMAC-SHA256 signature: ts + ":" + rawBody
  const payloadToSign = `${ts}:${rawBody}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  // Secure timing-safe comparison
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  const isValid = hashes.some((incomingHash) => {
    try {
      const incomingBuffer = Buffer.from(incomingHash, 'hex');
      return (
        expectedBuffer.length === incomingBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, incomingBuffer)
      );
    } catch {
      return false;
    }
  });

  if (!isValid) {
    return { valid: false, error: 'Signature hash mismatch.' };
  }

  return { valid: true, timestamp: timestampNumber };
}

/**
 * Utility to generate a valid Paddle Billing webhook signature header for testing.
 */
export function generatePaddleWebhookSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const payloadToSign = `${timestamp}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}
