/**
 * AutoReels Scroll - Public Checkout Security Guard
 * Route: POST /api/checkout
 * 
 * SECURITY NOTICE: Direct simulated checkouts are permanently disabled.
 * All paid licenses MUST originate from cryptographically verified Paddle webhooks
 * (POST /api/paddle/webhook) or the 7-day trial creation endpoint (/api/checkout/create-trial).
 */

import { handleOptions, jsonResponse } from '../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  return jsonResponse(
    {
      success: false,
      code: 'DIRECT_CHECKOUT_DISABLED',
      error:
        'Direct checkout simulation is disabled. All paid licenses must be processed through official Paddle Checkout and authorized via verified Paddle webhooks.'
    },
    403,
    request
  );
}
