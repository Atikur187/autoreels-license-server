/**
 * AutoReels Scroll - Purchase Status Check API
 * Route: GET /api/purchase/status?transaction_id=... or ?id=... or ?email=... or ?license_key=...
 * 
 * Provides polling and status verification for purchases after Paddle Checkout.
 * Does NOT expose internal database credentials or secret keys.
 */

import { getDb } from '../../../../lib/supabase.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id') || searchParams.get('paddle_transaction_id') || searchParams.get('txn_id');
    const purchaseId = searchParams.get('id') || searchParams.get('purchase_id');
    const email = searchParams.get('email');
    const licenseKey = searchParams.get('license_key') || searchParams.get('key');

    if (!transactionId && !purchaseId && !email && !licenseKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Missing search parameter. Please provide transaction_id, id, email, or license_key.'
        },
        400,
        request
      );
    }

    const db = getDb();

    let targetLicenseId = null;
    if (licenseKey) {
      const { data: licRows } = await db.from('licenses').select('*').eq('license_key', licenseKey.trim().toUpperCase());
      if (licRows && licRows.length > 0) {
        targetLicenseId = licRows[0].id;
      } else {
        return jsonResponse({ success: false, error: 'License key not found.' }, 404, request);
      }
    }

    let query = db.from('purchases').select('*');
    if (transactionId) {
      query = query.eq('paddle_transaction_id', transactionId.trim());
    } else if (purchaseId) {
      query = query.eq('id', purchaseId.trim());
    } else if (email) {
      query = query.eq('customer_email', email.trim().toLowerCase()).order('created_at', { ascending: false });
    } else if (targetLicenseId) {
      query = query.eq('license_id', targetLicenseId);
    }

    const { data: purchases, error: purErr } = await query;

    if (purErr) {
      console.error('[Purchase Status] Database error:', purErr);
      return jsonResponse({ success: false, error: 'Database error fetching purchase.' }, 500, request);
    }

    if (!purchases || purchases.length === 0) {
      return jsonResponse(
        {
          success: true,
          ready: false,
          message: 'Waiting for Paddle payment confirmation webhook...'
        },
        200,
        request
      );
    }

    const purchase = purchases[0];
    let licenseData = null;

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

        licenseData = {
          license_key: lic.license_key,
          plan: lic.plan,
          status: lic.status === 'revoked' ? 'revoked' : (isExpired ? 'expired' : lic.status),
          expires_at: lic.expires_at,
          max_devices: lic.max_devices,
          activations_count: activeActs.length
        };
      }
    }

    return jsonResponse(
      {
        success: true,
        ready: !!licenseData,
        purchase: {
          id: purchase.id,
          transaction_id: purchase.paddle_transaction_id,
          customer_id: purchase.paddle_customer_id,
          customer_email: purchase.customer_email,
          plan: purchase.plan,
          amount: purchase.amount,
          currency: purchase.currency,
          status: purchase.status,
          purchased_at: purchase.purchased_at || purchase.created_at,
          paddle_subscription_id: purchase.paddle_subscription_id || null
        },
        license: licenseData
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Purchase Status] Server error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
