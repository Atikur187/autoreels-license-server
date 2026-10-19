/**
 * AutoReels Scroll - Admin Activations Management API
 * Routes:
 *   GET    /api/admin/activations - List all activations with associated license details
 *   POST   /api/admin/activations - Reset/deactivate an installation slot
 *   DELETE /api/admin/activations - Remove activation record
 * 
 * Protected by server-side administrator authorization.
 * Uses installation identifier without invasive fingerprinting.
 */

import { getDb } from '../../../../lib/supabase.js';
import { verifyAdminRequest } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET: List all device activations with license mapping
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
    const statusFilter = (searchParams.get('status') || '').trim();

    const db = getDb();

    // Query activations
    const { data: activations, error: actErr } = await db
      .from('activations')
      .select('*')
      .order('activated_at', { ascending: false });

    if (actErr) {
      return jsonResponse({ success: false, error: actErr.message }, 500, request);
    }

    // Query licenses for context
    const { data: licenses } = await db.from('licenses').select('id, license_key, plan, status, max_devices');
    const licenseMap = new Map((licenses || []).map((l) => [l.id, l]));

    let decorated = (activations || []).map((act) => {
      const lic = licenseMap.get(act.license_id);
      return {
        id: act.id,
        licenseId: act.license_id,
        licenseKey: lic ? lic.license_key : 'unknown',
        plan: lic ? lic.plan : 'unknown',
        licenseStatus: lic ? lic.status : 'unknown',
        maxDevices: lic ? lic.max_devices : 1,
        installationId: act.installation_id || act.device_id || 'N/A',
        deviceLabel: act.device_label || 'Chrome Extension',
        platform: act.platform || 'Chrome Desktop',
        status: act.status || 'active',
        activatedAt: act.activated_at || act.created_at,
        lastSeenAt: act.last_seen_at || act.activated_at
      };
    });

    if (statusFilter) {
      decorated = decorated.filter((a) => a.status === statusFilter);
    }

    if (searchQuery) {
      decorated = decorated.filter(
        (a) =>
          a.licenseKey.toLowerCase().includes(searchQuery) ||
          a.installationId.toLowerCase().includes(searchQuery) ||
          a.plan.toLowerCase().includes(searchQuery)
      );
    }

    return jsonResponse(
      {
        success: true,
        activations: decorated,
        total: decorated.length
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin Activations GET] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}

// POST: Reset/Deactivate a device activation slot
export async function POST(request) {
  const auth = verifyAdminRequest(request);
  if (!auth.authorized) {
    return jsonResponse(
      { success: false, error: auth.error || 'Unauthorized.' },
      auth.status || 401,
      request
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { activationId, action = 'deactivate' } = body || {};

    if (!activationId) {
      return jsonResponse({ success: false, error: 'activationId is required.' }, 400, request);
    }

    const db = getDb();

    if (action === 'delete') {
      const { error: delErr } = await db.from('activations').delete().eq('id', activationId);
      if (delErr) {
        return jsonResponse({ success: false, error: delErr.message }, 500, request);
      }
      return jsonResponse({ success: true, message: 'Activation slot removed.' }, 200, request);
    }

    // Default: mark deactivated or delete to free slot
    const { error: delErr } = await db.from('activations').delete().eq('id', activationId);
    if (delErr) {
      return jsonResponse({ success: false, error: delErr.message }, 500, request);
    }

    return jsonResponse(
      {
        success: true,
        message: 'Device slot successfully reset. The user can now activate a new device.'
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin Activations POST] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
