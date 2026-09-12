/**
 * AutoReels Scroll - License Activation Endpoint
 * Route: POST /api/license/activate
 * Validates key, checks expiration, enforces device limits, and registers activation.
 */

import { getDb } from '../../../../lib/supabase.js';
import { isValidLicenseKeyFormat, normalizeLicenseKey } from '../../../../lib/license-generator.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rate-limit.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // 1. Rate limiting (max 15 activations per minute per client)
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`act-${clientIp}`, 15, 60000);
    if (!rate.allowed) {
      return jsonResponse(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: `Too many requests. Please retry in ${rate.retryAfter}s.`
        },
        429,
        request
      );
    }

    // 2. Parse & validate request payload
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

    if (!rawKey || typeof rawKey !== 'string') {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'License key is required.' },
        400,
        request
      );
    }

    if (!installationId || typeof installationId !== 'string' || installationId.trim().length < 8) {
      return jsonResponse(
        { success: false, code: 'INVALID_REQUEST', message: 'Valid installation identifier is required.' },
        400,
        request
      );
    }

    const licenseKey = normalizeLicenseKey(rawKey);
    if (!isValidLicenseKeyFormat(licenseKey)) {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'Invalid license key format.' },
        400,
        request
      );
    }

    const db = getDb();

    // 3. Query license from database
    const { data: license, error: licErr } = await db
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey)
      .single();

    if (licErr || !license) {
      return jsonResponse(
        { success: false, code: 'INVALID_LICENSE', message: 'Invalid license key.' },
        404,
        request
      );
    }

    // 4. Check license status
    if (license.status === 'revoked') {
      return jsonResponse(
        { success: false, code: 'LICENSE_REVOKED', message: 'This license has been revoked.' },
        403,
        request
      );
    }

    const now = new Date();
    if (license.expires_at && new Date(license.expires_at) < now) {
      // Mark as expired in DB if still active
      if (license.status !== 'expired') {
        await db.from('licenses').update({ status: 'expired' }).eq('id', license.id);
      }
      return jsonResponse(
        { success: false, code: 'LICENSE_EXPIRED', message: 'This license has expired.' },
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

    // 5. Query active activations for this license
    const { data: existingActivations, error: actErr } = await db
      .from('activations')
      .select('*')
      .eq('license_id', license.id);

    if (actErr) {
      console.error('[Activate] Activations query error:', actErr);
      return jsonResponse(
        { success: false, code: 'SERVER_ERROR', message: 'Failed to verify activation limits.' },
        500,
        request
      );
    }

    const allActivations = existingActivations || [];
    const activeActivations = allActivations.filter((a) => a.status === 'active');
    const existingDeviceActivation = activeActivations.find((a) => a.installation_id === installationId);

    // 6. If this installation is ALREADY actively registered, refresh last_seen_at and return success
    if (existingDeviceActivation) {
      await db
        .from('activations')
        .update({ last_seen_at: now.toISOString() })
        .eq('id', existingDeviceActivation.id);

      return jsonResponse(
        {
          success: true,
          status: 'active',
          plan: license.plan,
          expiresAt: license.expires_at,
          licenseKey: license.license_key,
          maxDevices: license.max_devices,
          activeDevices: activeActivations.length,
          serverTime: now.toISOString()
        },
        200,
        request
      );
    }

    // 7. Check device limit for NEW installations
    const maxDevices = license.max_devices || 1;
    if (activeActivations.length >= maxDevices) {
      return jsonResponse(
        {
          success: false,
          code: 'ACTIVATION_LIMIT',
          message: `Activation limit reached (${activeActivations.length}/${maxDevices} devices). Deactivate another device to use this license.`
        },
        403,
        request
      );
    }

    // 8. Register new activation
    const newActivationPayload = {
      license_id: license.id,
      installation_id: installationId,
      status: 'active',
      activated_at: now.toISOString(),
      last_seen_at: now.toISOString()
    };

    const { error: insertErr } = await db.from('activations').insert(newActivationPayload);
    if (insertErr) {
      console.error('[Activate] Insert error:', insertErr);
      return jsonResponse(
        { success: false, code: 'SERVER_ERROR', message: 'Failed to record activation.' },
        500,
        request
      );
    }

    return jsonResponse(
      {
        success: true,
        status: 'active',
        plan: license.plan,
        expiresAt: license.expires_at,
        licenseKey: license.license_key,
        maxDevices: license.max_devices,
        activeDevices: activeActivations.length + 1,
        serverTime: now.toISOString()
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Activate] Unexpected error:', err);
    return jsonResponse(
      { success: false, code: 'SERVER_ERROR', message: 'An internal server error occurred.' },
      500,
      request
    );
  }
}
