/**
 * AutoReels Scroll - License Revalidation Endpoint
 * Route: POST /api/license/verify
 * Validates active activation status, license standing, and updates last_seen timestamp.
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
    // 1. Rate limiting (max 60 verifications per minute per client)
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`ver-${clientIp}`, 60, 60000);
    if (!rate.allowed) {
      return jsonResponse(
        { success: false, code: 'RATE_LIMITED', message: 'Too many requests.' },
        429,
        request
      );
    }

    // 2. Parse payload
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

    const { licenseKey: rawKey, installationId } = body || {};

    if (!rawKey || !installationId) {
      return jsonResponse(
        { success: false, code: 'INVALID_REQUEST', message: 'licenseKey and installationId are required.' },
        400,
        request
      );
    }

    const licenseKey = normalizeLicenseKey(rawKey);
    const db = getDb();

    // 3. Query license
    const { data: license, error: licErr } = await db
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey)
      .single();

    if (licErr || !license) {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'License not found.' },
        404,
        request
      );
    }

    // 4. Check revocation
    if (license.status === 'revoked') {
      return jsonResponse(
        { success: false, code: 'LICENSE_REVOKED', message: 'License has been revoked.' },
        403,
        request
      );
    }

    // 5. Check expiration
    const now = new Date();
    if (license.expires_at && new Date(license.expires_at) < now) {
      if (license.status !== 'expired') {
        await db.from('licenses').update({ status: 'expired' }).eq('id', license.id);
      }
      return jsonResponse(
        { success: false, code: 'LICENSE_EXPIRED', message: 'License has expired.' },
        403,
        request
      );
    }

    if (license.status !== 'active') {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'License is not active.' },
        403,
        request
      );
    }

    // 6. Verify installation is registered as an active activation
    const { data: activation, error: actErr } = await db
      .from('activations')
      .select('*')
      .eq('license_id', license.id)
      .eq('installation_id', installationId)
      .single();

    if (actErr || !activation || activation.status !== 'active') {
      return jsonResponse(
        {
          success: false,
          code: 'ACTIVATION_NOT_FOUND',
          message: 'Device activation not found or was deactivated.'
        },
        403,
        request
      );
    }

    // 7. Update last_seen_at
    await db
      .from('activations')
      .update({ last_seen_at: now.toISOString() })
      .eq('id', activation.id);

    return jsonResponse(
      {
        success: true,
        status: 'active',
        plan: license.plan,
        expiresAt: license.expires_at,
        serverTime: now.toISOString()
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Verify] Unexpected error:', err);
    return jsonResponse(
      { success: false, code: 'SERVER_ERROR', message: 'Server verification error.' },
      500,
      request
    );
  }
}
