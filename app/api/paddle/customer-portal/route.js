/**
 * AutoReels Scroll - Paddle Customer Portal API
 * Route: POST /api/paddle/customer-portal
 * 
 * Generates an authenticated Paddle customer portal session link for customers
 * to manage their payment methods and subscriptions securely.
 */

import { getDb } from '../../../../lib/supabase.js';
import { PADDLE_API_KEY, PADDLE_ENVIRONMENT } from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customerId: rawCustomerId, email } = body;

    const db = getDb();
    let customerId = rawCustomerId;

    // Look up customer ID by email if not directly provided
    if (!customerId && email) {
      const { data: purchases } = await db
        .from('purchases')
        .select('*')
        .eq('customer_email', email.trim().toLowerCase())
        .order('created_at', { ascending: false });

      if (purchases && purchases.length > 0 && purchases[0].paddle_customer_id) {
        customerId = purchases[0].paddle_customer_id;
      }
    }

    if (!customerId) {
      return jsonResponse(
        {
          success: false,
          error: 'No active Paddle customer record found for this identifier.'
        },
        404,
        request
      );
    }

    // Call official Paddle Billing API to create customer portal session
    if (PADDLE_API_KEY && !PADDLE_API_KEY.includes('sample')) {
      const apiHost =
        PADDLE_ENVIRONMENT === 'sandbox'
          ? 'https://sandbox-api.paddle.com'
          : 'https://api.paddle.com';

      try {
        const paddleRes = await fetch(`${apiHost}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PADDLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        const paddleData = await paddleRes.json();
        if (paddleRes.ok && paddleData?.data?.urls?.general?.overview) {
          return jsonResponse(
            {
              success: true,
              portalUrl: paddleData.data.urls.general.overview
            },
            200,
            request
          );
        }
      } catch (apiErr) {
        console.warn('[Paddle Portal] API session generation error:', apiErr.message);
      }
    }

    // Fallback if API key not yet connected
    return jsonResponse(
      {
        success: true,
        message: 'To manage your subscription or payment details, please check the management link in your receipt email.',
        customerId
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Paddle Portal] Server error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
