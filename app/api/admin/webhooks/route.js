/**
 * AutoReels Scroll - Admin Webhook Events & Failure Auditing API
 * Route: GET /api/admin/webhooks
 * 
 * Returns recorded webhook events, idempotency logs, and processing failures.
 * Protected by server-side administrator authorization.
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
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const db = getDb();
    let query = db.from('webhook_events').select('*');

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (typeof query.order === 'function') {
      query = query.order('created_at', { ascending: false });
    }

    if (typeof query.limit === 'function') {
      query = query.limit(limit);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[Admin Webhooks API] Error fetching events:', error);
      return jsonResponse({ success: false, error: error.message }, 500, request);
    }

    const items = (events || []).map((e) => ({
      id: e.id,
      eventId: e.event_id,
      eventType: e.event_type || e.event_name,
      status: e.status,
      errorMessage: e.error_message || null,
      receivedAt: e.received_at || e.created_at,
      processedAt: e.processed_at,
      payloadSummary: e.payload_summary || (e.payload ? {
        orderId: e.payload?.data?.id || e.payload?.meta?.custom_data?.order_id,
        userEmail: e.payload?.data?.attributes?.user_email,
        totalFormatted: e.payload?.data?.attributes?.total_formatted
      } : null)
    }));

    const failureCount = items.filter((e) => e.status === 'failed' || e.status === 'error').length;

    return jsonResponse(
      {
        success: true,
        count: items.length,
        failures: failureCount,
        events: items
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin Webhooks API] Exception:', err);
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}
