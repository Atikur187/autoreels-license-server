/**
 * AutoReels Scroll - Admin Products & Plans API
 * Route: GET /api/admin/products
 * 
 * Provides configured plan parameters, active durations, device limits,
 * and current Paddle Price ID bindings.
 */

import { verifyAdminRequest } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';
import {
  PLANS,
  PADDLE_ENVIRONMENT,
  PADDLE_PRICE_MONTHLY,
  PADDLE_PRICE_YEARLY,
  PADDLE_PRICE_LIFETIME
} from '../../../../lib/paddle.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  const auth = verifyAdminRequest(request);
  if (!auth.authorized) {
    return jsonResponse(
      { success: false, error: auth.error || 'Unauthorized.' },
      auth.status || 401,
      request
    );
  }

  const productList = [
    {
      id: '7day',
      name: '7-Day Free Trial',
      plan: '7day',
      price: '$0.00',
      duration: '7 Days',
      maxDevices: 1,
      requiresPayment: false,
      paddlePriceId: 'N/A (Backend provisioned)',
      badge: 'Free Trial',
      status: 'Active'
    },
    {
      id: '30day',
      name: '1 Month Pass',
      plan: '30day',
      price: '$1.49',
      duration: '30 Days',
      maxDevices: 2,
      requiresPayment: true,
      billingType: 'One-time payment',
      paddlePriceId: PADDLE_PRICE_MONTHLY,
      isConfigured: Boolean(PADDLE_PRICE_MONTHLY && !PADDLE_PRICE_MONTHLY.includes('sample')),
      badge: '1 Month',
      status: 'Active'
    },
    {
      id: 'yearly',
      name: '1 Year Pro',
      plan: 'yearly',
      price: '$9.49',
      duration: '365 Days',
      maxDevices: 3,
      requiresPayment: true,
      billingType: 'One-time payment',
      paddlePriceId: PADDLE_PRICE_YEARLY,
      isConfigured: Boolean(PADDLE_PRICE_YEARLY && !PADDLE_PRICE_YEARLY.includes('sample')),
      badge: 'Most Popular',
      status: 'Active'
    },
    {
      id: 'lifetime',
      name: 'Lifetime VIP',
      plan: 'lifetime',
      price: '$19.99',
      duration: 'Never Expires',
      maxDevices: 5,
      requiresPayment: true,
      billingType: 'One-time payment',
      paddlePriceId: PADDLE_PRICE_LIFETIME,
      isConfigured: Boolean(PADDLE_PRICE_LIFETIME && !PADDLE_PRICE_LIFETIME.includes('sample')),
      badge: 'Best Value',
      status: 'Active'
    }
  ];

  return jsonResponse(
    {
      success: true,
      environment: PADDLE_ENVIRONMENT,
      products: productList
    },
    200,
    request
  );
}
