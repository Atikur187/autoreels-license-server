/**
 * AutoReels Scroll - Admin Deactivate Device Endpoint
 * Route: POST /api/admin/deactivate
 * Allows administrator to release/deactivate a specific installation remotely.
 */

import { getDb } from '../../../../lib/supabase.js';
import { verifyAdminAuth } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized.' }, 401, request);
  }

  try {
    const body = await request.json();
    const { activationId, licenseId, installationId } = body || {};

    const db = getDb();
    let query = db.from('activations').delete();

    if (activationId) {
      query = query.eq('id', activationId);
    } else if (licenseId && installationId) {
      query = query.eq('license_id', licenseId).eq('installation_id', installationId);
    } else {
      return jsonResponse({ success: false, error: 'Missing activation identifier.' }, 400, request);
    }

    const { error } = await query;
    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500, request);
    }

    return jsonResponse({ success: true, message: 'Device deactivated successfully.' }, 200, request);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}
