/**
 * AutoReels Scroll — Paddle Customer Portal API
 * Route: POST /api/paddle/customer-portal
 * 
 * Verifies authentication server-side, queries subscriptions, and mints
 * an authenticated Paddle customer portal session link via @paddle/paddle-node-sdk.
 */

import { resolveAuthenticatedUser } from '../../../../lib/auth.js';
import { getCustomerSubscriptions } from '../../../../lib/db-service.js';
import { getPaddleNodeClient } from '../../../../lib/paddle-node.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // 1. Authenticate user server-side FIRST
    // Never trust client-supplied customer ID
    const auth = await resolveAuthenticatedUser(request);

    if (!auth.authenticated || !auth.email) {
      return jsonResponse(
        {
          success: false,
          error: 'Unauthorized: Authentication required to access billing portal.'
        },
        401,
        request
      );
    }

    if (!auth.customerId) {
      return jsonResponse(
        {
          success: false,
          error: 'No active Paddle billing customer found for your account.'
        },
        404,
        request
      );
    }

    const customerId = auth.customerId;
    const subscriptions = await getCustomerSubscriptions(customerId);
    const subscriptionIds = subscriptions
      .map((s) => s.subscription_id || s.id)
      .filter(Boolean);

    // 2. Mint session with Paddle Node SDK
    const paddle = getPaddleNodeClient();
    const session = await paddle.customerPortalSessions.create(
      customerId,
      subscriptionIds.length > 0 ? subscriptionIds : undefined
    );

    const portalUrl =
      session?.urls?.general?.overview ||
      session?.urls?.general?.subscriptions ||
      session?.urls?.general?.paymentMethods ||
      null;

    if (!portalUrl) {
      throw new Error('Failed to retrieve portal URL from Paddle response.');
    }

    return jsonResponse(
      {
        success: true,
        portalUrl,
        customerId
      },
      200,
      request
    );
  } catch (err) {
    console.error('[PADDLE CUSTOMER PORTAL] Error:', err);
    return jsonResponse(
      {
        success: false,
        error: err.message || 'Internal server error creating portal session.'
      },
      500,
      request
    );
  }
}
