/**
 * AutoReels Scroll - License & Payment Status Check API
 * Route: GET /api/license/status?transaction_id=... or ?license_key=... or ?email=...
 * 
 * Safely returns current entitlement, license key, device limits, and purchase details.
 * Does not expose internal database IDs or secret keys.
 */

import { getDb } from '../../../../lib/supabase.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id') || searchParams.get('txn_id') || searchParams.get('paddle_transaction_id');
    const licenseKey = searchParams.get('license_key') || searchParams.get('key');
    const email = searchParams.get('email');

    const db = getDb();

    // -------------------------------------------------------------------------
    // 1. Query by Paddle Transaction ID (Used by checkout success page polling)
    // -------------------------------------------------------------------------
    if (transactionId) {
      const { data: purchases, error: purErr } = await db
        .from('purchases')
        .select('*')
        .eq('paddle_transaction_id', transactionId.trim());

      if (purErr) {
        return jsonResponse({ success: false, error: 'Database error.' }, 500, request);
      }

      if (!purchases || purchases.length === 0) {
        // Webhook hasn't completed yet
        return jsonResponse(
          {
            success: true,
            ready: false,
            message: 'Waiting for verified Paddle payment webhook...'
          },
          200,
          request
        );
      }

      const purchase = purchases[0];

      // Retrieve associated license
      if (purchase.license_id) {
        const { data: licenses } = await db
          .from('licenses')
          .select('*')
          .eq('id', purchase.license_id);

        if (licenses && licenses.length > 0) {
          const lic = licenses[0];
          const isExpired = lic.expires_at && new Date(lic.expires_at) < new Date();

          // Query active activations
          const { data: acts } = await db.from('activations').select('*').eq('license_id', lic.id);
          const activeActs = (acts || []).filter((a) => a.status === 'active');

          return jsonResponse(
            {
              success: true,
              ready: true,
              license: {
                license_key: lic.license_key,
                plan: lic.plan,
                status: lic.status === 'revoked' ? 'revoked' : (isExpired ? 'expired' : lic.status),
                expires_at: lic.expires_at,
                max_devices: lic.max_devices,
                activations_count: activeActs.length
              },
              purchase: {
                transaction_id: purchase.paddle_transaction_id,
                amount: purchase.amount,
                currency: purchase.currency,
                status: purchase.status,
                purchased_at: purchase.purchased_at || purchase.created_at,
                paddle_subscription_id: purchase.paddle_subscription_id || null
              }
            },
            200,
            request
          );
        }
      }

      return jsonResponse(
        {
          success: true,
          ready: false,
          message: 'Purchase recorded, issuing license...'
        },
        200,
        request
      );
    }

    // -------------------------------------------------------------------------
    // 2. Query by License Key (Used by customer dashboard and direct lookup)
    // -------------------------------------------------------------------------
    if (licenseKey) {
      const cleanKey = licenseKey.trim().toUpperCase();
      const { data: licenses, error: licErr } = await db
        .from('licenses')
        .select('*')
        .eq('license_key', cleanKey);

      if (licErr || !licenses || licenses.length === 0) {
        return jsonResponse(
          {
            success: false,
            ready: false,
            error: 'License key not found.'
          },
          404,
          request
        );
      }

      const lic = licenses[0];
      const isExpired = lic.expires_at && new Date(lic.expires_at) < new Date();

      // Retrieve associated purchase details if available
      let purchaseData = null;
      const { data: purchases } = await db
        .from('purchases')
        .select('*')
        .eq('license_id', lic.id);

      if (purchases && purchases.length > 0) {
        const p = purchases[0];
        purchaseData = {
          transaction_id: p.paddle_transaction_id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          purchased_at: p.purchased_at || p.created_at,
          paddle_subscription_id: p.paddle_subscription_id || null
        };
      }

      // Query active activations
      const { data: acts } = await db.from('activations').select('*').eq('license_id', lic.id);
      const activeActs = (acts || []).filter((a) => a.status === 'active');

      return jsonResponse(
        {
          success: true,
          ready: true,
          license: {
            license_key: lic.license_key,
            plan: lic.plan,
            status: lic.status === 'revoked' ? 'revoked' : (isExpired ? 'expired' : lic.status),
            expires_at: lic.expires_at,
            max_devices: lic.max_devices,
            activations_count: activeActs.length
          },
          purchase: purchaseData
        },
        200,
        request
      );
    }

    // -------------------------------------------------------------------------
    // 3. Query by Email (Used by customer dashboard to find their license)
    // -------------------------------------------------------------------------
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: purchases } = await db
        .from('purchases')
        .select('*')
        .eq('customer_email', cleanEmail)
        .order('created_at', { ascending: false });

      if (purchases && purchases.length > 0 && purchases[0].license_id) {
        const p = purchases[0];
        const { data: licenses } = await db
          .from('licenses')
          .select('*')
          .eq('id', p.license_id);

        if (licenses && licenses.length > 0) {
          const lic = licenses[0];
          const isExpired = lic.expires_at && new Date(lic.expires_at) < new Date();

          const { data: acts } = await db.from('activations').select('*').eq('license_id', lic.id);
          const activeActs = (acts || []).filter((a) => a.status === 'active');

          return jsonResponse(
            {
              success: true,
              ready: true,
              license: {
                license_key: lic.license_key,
                plan: lic.plan,
                status: lic.status === 'revoked' ? 'revoked' : (isExpired ? 'expired' : lic.status),
                expires_at: lic.expires_at,
                max_devices: lic.max_devices,
                activations_count: activeActs.length
              },
              purchase: {
                transaction_id: p.paddle_transaction_id,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                purchased_at: p.purchased_at || p.created_at,
                paddle_subscription_id: p.paddle_subscription_id || null
              }
            },
            200,
            request
          );
        }
      }

      return jsonResponse({ success: false, ready: false, error: 'No active license found for this email.' }, 404, request);
    }

    return jsonResponse(
      {
        success: false,
        error: 'Please provide transaction_id, license_key, or email.'
      },
      400,
      request
    );
  } catch (err) {
    console.error('[License Status API] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
