/**
 * AutoReels Scroll - Admin License Detail / Actions Endpoint
 * Routes:
 *   PATCH  /api/admin/licenses/[id] - Revoke or reactivate license
 *   DELETE /api/admin/licenses/[id] - Permanently delete license
 */

import { getDb } from '../../../../../lib/supabase.js';
import { verifyAdminAuth } from '../../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function PATCH(request, { params }) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized.' }, 401, request);
  }

  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const body = await request.json();
    const { status } = body || {};

    if (!['active', 'revoked', 'expired'].includes(status)) {
      return jsonResponse({ success: false, error: 'Invalid status.' }, 400, request);
    }

    const db = getDb();
    const { data: updated, error } = await db
      .from('licenses')
      .update({ status })
      .eq('id', id);

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500, request);
    }

    return jsonResponse({ success: true, license: updated ? updated[0] : null }, 200, request);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}

export async function DELETE(request, { params }) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized.' }, 401, request);
  }

  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const db = getDb();
    
    // First remove any activations tied to this license
    await db.from('activations').delete().eq('license_id', id);

    // Remove the license
    const { error } = await db.from('licenses').delete().eq('id', id);
    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500, request);
    }
    return jsonResponse({ success: true, message: 'License permanently deleted.' }, 200, request);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}
