/**
 * AutoReels Scroll - License Deactivation Endpoint
 * Route: POST /api/license/deactivate
 * Releases the device activation slot in database so it can be reused on another browser/device.
 */

import { getDb } from '../../../../lib/supabase.js';
import { normalizeLicenseKey } from '../../../../lib/license-generator.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rate-limit.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`deact-${clientIp}`, 15, 60000);
    if (!rate.allowed) {
      return jsonResponse(
        { success: false, code: 'RATE_LIMITED', message: 'Too many requests.' },
        429,
        request
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, code: 'INVALID_REQUEST', message: 'Malformed JSON payload.' },
        400,
        request
      );
    }

    const { licenseKey: rawKey, deviceId: rawDeviceId, installationId } = body || {};
    const deviceId = (rawDeviceId || installationId || '').trim();

    if (!rawKey || !deviceId) {
      return jsonResponse(
        { success: false, code: 'INVALID_REQUEST', message: 'licenseKey and deviceId are required.' },
        400,
        request
      );
    }

    const licenseKey = normalizeLicenseKey(rawKey);
    const db = getDb();

    // 1. Find license
    const { data: license } = await db
      .from('licenses')
      .select('id, activation_count')
      .eq('license_key', licenseKey)
      .single();

    if (!license) {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'License not found.' },
        404,
        request
      );
    }

    // 2. Remove / deactivate activation record
    const { error: delErr } = await db
      .from('activations')
      .delete()
      .eq('license_id', license.id)
      .eq('installation_id', deviceId);

    try {
      const remainingCount = Math.max(0, (license.activation_count || 1) - 1);
      await db.from('licenses').update({ activation_count: remainingCount }).eq('id', license.id);
    } catch {}

    if (delErr) {
      console.error('[Deactivate] Delete error:', delErr);
      return jsonResponse(
        { success: false, code: 'SERVER_ERROR', message: 'Failed to release device activation.' },
        500,
        request
      );
    }

    return jsonResponse(
      { success: true, message: 'Device successfully deactivated.' },
      200,
      request
    );
  } catch (err) {
    console.error('[Deactivate] Unexpected error:', err);
    return jsonResponse(
      { success: false, code: 'SERVER_ERROR', message: 'An internal server error occurred.' },
      500,
      request
    );
  }
}
