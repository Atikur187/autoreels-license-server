/**
 * AutoReels Scroll - Admin Purchases API
 * Route: GET /api/admin/purchases
 * 
 * Shows real verified purchase data stored in Supabase:
 * - Transaction reference
 * - Customer email
 * - Purchased plan
 * - Amount and currency
 * - Verified payment status
 * - Purchase date
 * - Associated license key
 * 
 * Strictly server-protected. Sensitive payment cards/CVV are never stored or exposed.
 */

import { getDb } from '../../../../lib/supabase.js';
import { verifyAdminRequest } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

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

  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();
    const planFilter = (searchParams.get('plan') || '').trim();
    const statusFilter = (searchParams.get('status') || '').trim();

    const db = getDb();

    // Query purchases
    const { data: purchases, error: purErr } = await db
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false });

    if (purErr) {
      return jsonResponse({ success: false, error: purErr.message }, 500, request);
    }

    // Query licenses to join license_key
    const { data: licenses } = await db.from('licenses').select('id, license_key, plan, status');
    const licenseMap = new Map((licenses || []).map((l) => [l.id, l]));

    let filtered = (purchases || []).map((p) => {
      const lic = p.license_id ? licenseMap.get(p.license_id) : null;
      return {
        id: p.id,
        transactionId: p.paddle_transaction_id || 'N/A',
        customerEmail: p.customer_email || 'anonymous',
        plan: p.plan,
        amount: parseFloat(p.amount) || 0.00,
        currency: p.currency || 'USD',
        status: p.status || 'completed',
        purchasedAt: p.purchased_at || p.created_at,
        licenseId: p.license_id,
        licenseKey: lic ? lic.license_key : null,
        licenseStatus: lic ? lic.status : null
      };
    });

    if (planFilter) {
      filtered = filtered.filter((p) => p.plan === planFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.transactionId.toLowerCase().includes(searchQuery) ||
          p.customerEmail.toLowerCase().includes(searchQuery) ||
          (p.licenseKey && p.licenseKey.toLowerCase().includes(searchQuery))
      );
    }

    return jsonResponse(
      {
        success: true,
        purchases: filtered,
        total: filtered.length
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin Purchases API] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
