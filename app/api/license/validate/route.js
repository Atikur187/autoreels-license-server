/**
 * AutoReels Scroll - License Validation Endpoint
 * Route: POST /api/license/validate
 * 
 * Periodically validates that a device's license is active, unexpired, and not revoked.
 * Strictly adheres to Step 14 specification.
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
    // 1. Rate limiting (max 60 checks per minute per client)
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`val-${clientIp}`, 60, 60000);
    if (!rate.allowed) {
      return jsonResponse(
        {
          valid: false,
          premium: false,
          reason: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment.'
        },
        429,
        request
      );
    }

    // 2. Parse payload (supports deviceId and installationId)
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          valid: false,
          premium: false,
          reason: 'INVALID_REQUEST',
          message: 'Malformed JSON payload.'
        },
        400,
        request
      );
    }

    const { licenseKey: rawKey, deviceId: rawDeviceId, installationId } = body || {};
    const deviceId = (rawDeviceId || installationId || '').trim();

    if (!rawKey || !deviceId) {
      return jsonResponse(
        {
          valid: false,
          premium: false,
          reason: 'INVALID_REQUEST',
          message: 'licenseKey and deviceId are required.'
        },
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
        {
          valid: false,
          premium: false,
          reason: 'INVALID_LICENSE',
          message: 'This license key is invalid.'
        },
        404,
        request
      );
    }

    // 4. Check revocation
    if (license.status === 'revoked') {
      return jsonResponse(
        {
          valid: false,
          premium: false,
          reason: 'REVOKED_LICENSE',
          message: 'This license has been revoked.'
        },
        403,
        request
      );
    }

    // 5. Check expiration
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
          premium: false,
          reason: 'EXPIRED_LICENSE',
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
          premium: false,
          reason: 'INVALID_LICENSE',
          message: 'License is not active.'
        },
        403,
        request
      );
    }

    // 6. Verify device is an active activation for this license
    const { data: activations } = await db
      .from('activations')
      .select('*')
      .eq('license_id', license.id);

    const activeList = (activations || []).filter((a) => a.status === 'active');
    const matchedActivation = activeList.find(
      (a) => a.device_id === deviceId || a.installation_id === deviceId
    );

    if (!matchedActivation) {
      return jsonResponse(
        {
          valid: false,
          premium: false,
          reason: 'DEVICE_NOT_ACTIVATED',
          message: 'This device is not activated for this license.'
        },
        403,
        request
      );
    }

    // 7. Update timestamps
    try {
      await db
        .from('activations')
        .update({ last_seen_at: now.toISOString() })
        .eq('id', matchedActivation.id);

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
        premium: true,
        success: true,
        status: 'active',
        serverTime: now.toISOString()
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Validate] Error:', err);
    return jsonResponse(
      {
        valid: false,
        premium: false,
        reason: 'SERVER_ERROR',
        message: 'Unable to verify your license. Please check your internet connection.'
      },
      500,
      request
    );
  }
}
