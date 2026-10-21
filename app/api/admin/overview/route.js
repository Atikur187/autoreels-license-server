/**
 * AutoReels Scroll - Admin Overview Dashboard Metrics API
 * Route: GET /api/admin/overview
 * 
 * Aggregates real database-derived statistics:
 * - Total licenses
 * - Active licenses
 * - Expired licenses
 * - Revoked licenses
 * - Confirmed purchases
 * - Active device activations
 * - Recent purchases and recent activations
 * 
 * Protected by server-side administrator authorization.
 */

import { getDb, isLiveSupabase } from '../../../../lib/supabase.js';
import { verifyAdminRequest } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';
import {
  LEMON_SQUEEZY_MODE,
  LEMON_SQUEEZY_STORE_ID,
  LEMON_SQUEEZY_API_KEY,
  LEMON_SQUEEZY_WEBHOOK_SECRET,
  getLemonSqueezyVariantId
} from '../../../../lib/lemonsqueezy.js';

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
    const db = getDb();
    const now = new Date();

    // Fetch licenses
    const { data: licensesData } = await db.from('licenses').select('*');
    const allLicenses = licensesData || [];

    // Fetch activations
    const { data: activationsData } = await db.from('activations').select('*');
    const allActivations = activationsData || [];

    // Fetch purchases
    const { data: purchasesData } = await db.from('purchases').select('*');
    const allPurchases = purchasesData || [];

    // Compute license metrics
    const totalLicenses = allLicenses.length;
    let activeLicenses = 0;
    let expiredLicenses = 0;
    let revokedLicenses = 0;

    const planCounts = {
      '7day': 0,
      '30day': 0,
      'yearly': 0,
      'lifetime': 0,
      other: 0
    };

    for (const lic of allLicenses) {
      if (lic.status === 'revoked') {
        revokedLicenses++;
      } else if (lic.status === 'expired' || (lic.expires_at && new Date(lic.expires_at) < now)) {
        expiredLicenses++;
      } else if (lic.status === 'active') {
        activeLicenses++;
      }

      const pKey = lic.plan || 'other';
      if (planCounts[pKey] !== undefined) {
        planCounts[pKey]++;
      } else {
        planCounts.other++;
      }
    }

    // Compute activation metrics
    const activeActivations = allActivations.filter((a) => a.status === 'active').length;

    // Compute purchase metrics
    const confirmedPurchases = allPurchases.filter(
      (p) => p.status === 'completed' || p.status === 'paid'
    ).length;

    const totalRevenueUsd = allPurchases
      .filter((p) => p.status === 'completed' || p.status === 'paid')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Recent purchases (top 5 sorted by date)
    const recentPurchases = [...allPurchases]
      .sort((a, b) => new Date(b.created_at || b.purchased_at || 0) - new Date(a.created_at || a.purchased_at || 0))
      .slice(0, 5)
      .map((p) => {
        const associatedLic = allLicenses.find((l) => l.id === p.license_id);
        return {
          id: p.id,
          transactionId: p.lemonsqueezy_order_id ? `LS #${p.lemonsqueezy_order_id}` : (p.paddle_transaction_id || 'N/A'),
          customerEmail: p.customer_email || 'anonymous',
          plan: p.plan,
          amount: p.amount,
          currency: p.currency || 'USD',
          status: p.status,
          date: p.created_at || p.purchased_at,
          licenseKey: associatedLic ? associatedLic.license_key : null
        };
      });

    // Recent activations (top 5 sorted by date)
    const recentActivations = [...allActivations]
      .sort((a, b) => new Date(b.activated_at || b.created_at || 0) - new Date(a.activated_at || a.created_at || 0))
      .slice(0, 5)
      .map((a) => {
        const associatedLic = allLicenses.find((l) => l.id === a.license_id);
        return {
          id: a.id,
          licenseKey: associatedLic ? associatedLic.license_key : 'unknown',
          plan: associatedLic ? associatedLic.plan : 'unknown',
          installationId: a.installation_id || a.device_id || 'N/A',
          status: a.status,
          activatedAt: a.activated_at || a.created_at,
          lastSeenAt: a.last_seen_at || a.activated_at
        };
      });

    // Diagnostic information
    const systemInfo = {
      isLiveSupabase: isLiveSupabase(),
      paymentProvider: 'lemonsqueezy',
      lemonSqueezyMode: LEMON_SQUEEZY_MODE,
      hasApiKey: Boolean(LEMON_SQUEEZY_API_KEY),
      hasStoreId: Boolean(LEMON_SQUEEZY_STORE_ID),
      hasWebhookSecret: Boolean(LEMON_SQUEEZY_WEBHOOK_SECRET),
      configuredVariants: {
        monthly: Boolean(getLemonSqueezyVariantId('30day')),
        yearly: Boolean(getLemonSqueezyVariantId('yearly')),
        lifetime: Boolean(getLemonSqueezyVariantId('lifetime'))
      }
    };

    return jsonResponse(
      {
        success: true,
        metrics: {
          totalLicenses,
          activeLicenses,
          expiredLicenses,
          revokedLicenses,
          confirmedPurchases,
          activeActivations,
          totalRevenueUsd: totalRevenueUsd.toFixed(2),
          planCounts
        },
        recentPurchases,
        recentActivations,
        system: systemInfo
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin Overview API] Exception:', err);
    return jsonResponse({ success: false, error: 'Failed to aggregate overview metrics.' }, 500, request);
  }
}
