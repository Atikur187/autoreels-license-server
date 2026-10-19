/**
 * AutoReels Scroll — Subscription Status & Entitlement API
 * Route: GET /api/subscription/status?subscription_id=... or ?customer_id=... or ?email=...
 * 
 * Returns current mirrored subscription state and access decision.
 */

import { getSubscription, getCustomerSubscriptions, checkCustomerAccess } from '../../../../lib/db-service.js';
import { getSubscriptionAccessDetails } from '../../../../lib/subscription-access.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscription_id') || searchParams.get('id');
    const customerId = searchParams.get('customer_id');
    const email = searchParams.get('email');

    if (!subscriptionId && !customerId && !email) {
      return jsonResponse(
        {
          success: false,
          error: 'Please provide subscription_id, customer_id, or email.'
        },
        400,
        request
      );
    }

    if (subscriptionId) {
      const sub = await getSubscription(subscriptionId);
      const access = getSubscriptionAccessDetails(sub);
      return jsonResponse(
        {
          success: true,
          subscription: sub,
          access
        },
        200,
        request
      );
    }

    if (customerId || email) {
      const accessResult = await checkCustomerAccess(customerId || email);
      return jsonResponse(
        {
          success: true,
          ...accessResult
        },
        200,
        request
      );
    }
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: err.message || 'Internal server error.'
      },
      500,
      request
    );
  }
}
