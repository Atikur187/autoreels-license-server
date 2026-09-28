/**
 * AutoReels Scroll — Customer Portal Session Minting API
 * Route: POST /api/portal/session & GET /api/portal/session
 * 
 * Verifies authentication first, authoritatively resolves customer ID from server session,
 * queries subscriptions, and mints an authenticated Paddle Customer Portal session.
 */

import { resolveAuthenticatedUser } from '../../../../lib/auth.js';
import { getCustomerSubscriptions } from '../../../../lib/db-service.js';
import { getPaddleNodeClient } from '../../../../lib/paddle-node.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  return handleMintPortalSession(request);
}

export async function GET(request) {
  return handleMintPortalSession(request);
}

async function handleMintPortalSession(request) {
  try {
    // 1. Authenticate user server-side FIRST
    // NEVER trust a customer ID supplied by the client
    const authResult = await resolveAuthenticatedUser(request);

    if (!authResult.authenticated || !authResult.email) {
      return jsonResponse(
        {
          success: false,
          error: 'Unauthorized: You must be signed in to access the customer portal.'
        },
        401,
        request
      );
    }

    if (!authResult.customerId) {
      return jsonResponse(
        {
          success: false,
          error: 'No active Paddle customer billing record found for your account.'
        },
        404,
        request
      );
    }

    const customerId = authResult.customerId;

    // 2. Look up customer's subscriptions from subscriptions table
    const subscriptions = await getCustomerSubscriptions(customerId);
    const subscriptionIds = subscriptions
      .map((s) => s.subscription_id || s.id)
      .filter(Boolean);

    // 3. Mint session with Paddle Node SDK
    // Reads API key and environment from env vars via getPaddleNodeClient()
    const paddle = getPaddleNodeClient();
    
    // In Paddle Node SDK: paddle.customerPortalSessions.create(customerId, subscriptionIds)
    const portalSession = await paddle.customerPortalSessions.create(
      customerId,
      subscriptionIds.length > 0 ? subscriptionIds : undefined
    );

    const portalUrl =
      portalSession?.urls?.general?.overview ||
      portalSession?.urls?.general?.subscriptions ||
      portalSession?.urls?.general?.paymentMethods ||
      null;

    if (!portalUrl) {
      throw new Error('Paddle did not return a valid customer portal URL.');
    }

    // If request has header Accept: text/html or GET request from browser, redirect directly
    const acceptHeader = request.headers.get('accept') || '';
    if (request.method === 'GET' && acceptHeader.includes('text/html')) {
      return Response.redirect(portalUrl, 303);
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
    console.error('[PADDLE CUSTOMER PORTAL] Error creating session:', err);
    return jsonResponse(
      {
        success: false,
        error: `Failed to create customer portal session: ${err.message}`
      },
      500,
      request
    );
  }
}
