/**
 * AutoReels Scroll - License Activation Endpoint
 * Route: POST /api/license/activate
 * 
 * Validates key, checks expiration, enforces device limits, and registers device activation.
 * Strictly adheres to Step 12 specification while retaining backwards compatibility.
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
    // 1. Rate limiting (max 15 activations per minute per client IP)
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`act-${clientIp}`, 15, 60000);
    if (!rate.allowed) {
      return jsonResponse(
        {
          valid: false,
          reason: 'RATE_LIMITED',
          success: false,
          code: 'RATE_LIMITED',
          message: `Too many requests. Please retry in ${rate.retryAfter}s.`
        },
        429,
        request
      );
    }

    // 2. Parse request payload (supports deviceId and installationId)
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          valid: false,
          reason: 'INVALID_REQUEST',
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Malformed JSON payload.'
        },
        400,
        request
      );
    }

    const { licenseKey: rawKey, deviceId: rawDeviceId, installationId } = body || {};
    const deviceId = (rawDeviceId || installationId || '').trim();

    if (!rawKey || typeof rawKey !== 'string') {
      return jsonResponse(
        {
          valid: false,
          reason: 'INVALID_LICENSE',
          error: 'INVALID_LICENSE',
          success: false,
          code: 'INVALID_LICENSE',
          message: 'License key is required.'
        },
        400,
        request
      );
    }

    if (!deviceId || deviceId.length < 6) {
      return jsonResponse(
        {
          valid: false,
          reason: 'INVALID_REQUEST',
          error: 'INVALID_REQUEST',
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Valid deviceId or installation identifier is required.'
        },
        400,
        request
      );
    }

    const licenseKey = normalizeLicenseKey(rawKey);
    if (!isValidLicenseKeyFormat(licenseKey)) {
      return jsonResponse(
        {
          valid: false,
          reason: 'INVALID_LICENSE',
          error: 'INVALID_LICENSE',
          success: false,
          code: 'INVALID_LICENSE',
          message: 'This license key is invalid.'
        },
        404,
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
        {
          valid: false,
          reason: 'INVALID_LICENSE',
          error: 'INVALID_LICENSE',
          success: false,
          code: 'INVALID_LICENSE',
          message: 'This license key is invalid.'
        },
        404,
        request
      );
    }

    // 4. Check license status (revoked, expired, active)
    if (license.status === 'revoked') {
      return jsonResponse(
        {
          valid: false,
          reason: 'REVOKED_LICENSE',
          error: 'LICENSE_REVOKED',
          success: false,
          code: 'LICENSE_REVOKED',
          message: 'This license has been revoked.'
        },
        403,
        request
      );
    }

    const now = new Date();
    if (license.expires_at && new Date(license.expires_at) < now) {
      if (license.status !== 'expired') {
        try {
          await db.from('licenses').update({ status: 'expired' }).eq('id', license.id);
        } catch {}
      }
      return jsonResponse(
        {
          valid: false,
          reason: 'EXPIRED_LICENSE',
          error: 'LICENSE_EXPIRED',
          success: false,
          code: 'LICENSE_EXPIRED',
          message: 'This license has expired.'
        },
        403,
        request
      );
    }

    if (license.status !== 'active') {
      return jsonResponse(
        {
          valid: false,
          reason: 'INVALID_LICENSE',
          error: 'INVALID_LICENSE',
          success: false,
          code: 'INVALID_LICENSE',
          message: 'License is not active.'
        },
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
        {
          valid: false,
          reason: 'SERVER_ERROR',
          success: false,
          code: 'SERVER_ERROR',
          message: 'Failed to verify activation limits.'
        },
        500,
        request
      );
    }

    const allActivations = existingActivations || [];
    const activeActivations = allActivations.filter((a) => a.status === 'active');
    
    // Check if this device is ALREADY active (by device_id or installation_id)
    const existingDeviceActivation = activeActivations.find(
      (a) => a.device_id === deviceId || a.installation_id === deviceId
    );

    const deviceLimit = license.device_limit || license.max_devices || (
      license.plan === 'lifetime' ? 5 : (license.plan === 'yearly' ? 3 : 2)
    );

    // 6. If device is ALREADY active, update last_seen_at and return success
    if (existingDeviceActivation) {
      try {
        await db
          .from('activations')
          .update({ last_seen_at: now.toISOString() })
          .eq('id', existingDeviceActivation.id);

        await db
          .from('licenses')
          .update({ last_validated_at: now.toISOString() })
          .eq('id', license.id);
      } catch {}

      return jsonResponse(
        {
          valid: true,
          plan: license.plan,
          expiresAt: license.expires_at,
          deviceLimit,
          licenseKey: license.license_key,
          success: true,
          status: 'active',
          activeDevices: activeActivations.length,
          maxDevices: deviceLimit,
          features: {
            youtube: true,
            facebook: true,
            instagram: true,
            tiktok: true
          },
          entitlement: 'premium',
          serverTime: now.toISOString()
        },
        200,
        request
      );
    }

    // 7. Enforce device limits for NEW device activations
    if (activeActivations.length >= deviceLimit) {
      console.log(`[Activate] Device limit reached for license ${licenseKey} (${activeActivations.length}/${deviceLimit})`);
      return jsonResponse(
        {
          valid: false,
          reason: 'DEVICE_LIMIT_REACHED',
          message: 'Activation limit reached. This license has reached its maximum device limit.',
          success: false,
          code: 'ACTIVATION_LIMIT',
          deviceLimit,
          activeDevices: activeActivations.length
        },
        403,
        request
      );
    }

    // 8. Register new device activation
    const newActivationPayload = {
      license_id: license.id,
      installation_id: deviceId,
      device_id: deviceId,
      status: 'active',
      activated_at: now.toISOString(),
      last_seen_at: now.toISOString()
    };

    let { error: insertErr } = await db.from('activations').insert(newActivationPayload);
    if (insertErr && insertErr.code === 'PGRST204') {
      // device_id column not yet in schema; fallback to base columns
      const basePayload = {
        license_id: license.id,
        installation_id: deviceId,
        status: 'active',
        activated_at: now.toISOString(),
        last_seen_at: now.toISOString()
      };
      const fallback = await db.from('activations').insert(basePayload);
      insertErr = fallback.error;
    }

    if (insertErr) {
      console.error('[Activate] Insert error:', insertErr);
      return jsonResponse(
        {
          valid: false,
          reason: 'SERVER_ERROR',
          success: false,
          code: 'SERVER_ERROR',
          message: 'Failed to record device activation.'
        },
        500,
        request
      );
    }

    // Increment activation count and set last_validated_at on license
    try {
      await db
        .from('licenses')
        .update({
          activation_count: activeActivations.length + 1,
          last_validated_at: now.toISOString()
        })
        .eq('id', license.id);
    } catch {}

    console.log(`[Activate] Successfully registered device ${deviceId} on license ${licenseKey} (${activeActivations.length + 1}/${deviceLimit})`);

    return jsonResponse(
      {
        valid: true,
        plan: license.plan,
        expiresAt: license.expires_at,
        deviceLimit,
        licenseKey: license.license_key,
        success: true,
        status: 'active',
        activeDevices: activeActivations.length + 1,
        maxDevices: deviceLimit,
        features: {
          youtube: true,
          facebook: true,
          instagram: true,
          tiktok: true
        },
        entitlement: 'premium',
        serverTime: now.toISOString()
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Activate] Unexpected exception:', err);
    return jsonResponse(
      {
        valid: false,
        reason: 'SERVER_ERROR',
        success: false,
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.'
      },
      500,
      request
    );
  }
}
