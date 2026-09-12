/**
 * AutoReels Scroll - Admin Licenses Management Endpoint
 * Routes:
 *   GET  /api/admin/licenses - List and search licenses
 *   POST /api/admin/licenses - Generate new license key
 *
 * Strictly protected by x-admin-key header.
 */

import { getDb } from '../../../../lib/supabase.js';
import { generateLicenseKey } from '../../../../lib/license-generator.js';
import { verifyAdminAuth } from '../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET: List licenses with search & device counts
export async function GET(request) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized: Invalid admin key.' }, 401, request);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';

    const db = getDb();
    let query = db.from('licenses').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('license_key', `%${search}%`);
    }

    const { data: licenses, error: licErr } = await query;
    if (licErr) {
      return jsonResponse({ success: false, error: licErr.message }, 500, request);
    }

    // Fetch all activations to populate device counts
    const { data: activations } = await db.from('activations').select('*');
    const allActivations = activations || [];

    const decorated = (licenses || []).map((lic) => {
      const licActs = allActivations.filter((a) => a.license_id === lic.id);
      const activeActs = licActs.filter((a) => a.status === 'active');
      return {
        ...lic,
        activeDevices: activeActs.length,
        totalActivations: licActs.length,
        activations: licActs
      };
    });

    return jsonResponse({ success: true, licenses: decorated }, 200, request);
  } catch (err) {
    console.error('[Admin GET Licenses] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}

// POST: Generate and store a new license
export async function POST(request) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized: Invalid admin key.' }, 401, request);
  }

  try {
    const body = await request.json();
    const {
      plan = 'lifetime',
      customDays = null,
      maxDevices = 1,
      customerEmail = null
    } = body || {};

    const validPlans = ['7day', '30day', '90day', 'yearly', 'lifetime'];
    if (!validPlans.includes(plan)) {
      return jsonResponse({ success: false, error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` }, 400, request);
    }

    const devices = Math.max(1, parseInt(maxDevices, 10) || 1);

    // Calculate expiration timestamp
    let expiresAt = null;
    const now = new Date();

    if (plan === 'lifetime') {
      expiresAt = null;
    } else if (plan === '7day') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    } else if (plan === '30day') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    } else if (plan === '90day') {
      expiresAt = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();
    } else if (plan === 'yearly') {
      expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
    } else if (customDays && parseInt(customDays, 10) > 0) {
      expiresAt = new Date(now.getTime() + parseInt(customDays, 10) * 24 * 3600 * 1000).toISOString();
    }

    const licenseKey = generateLicenseKey('ARS');
    const db = getDb();

    const newRecord = {
      license_key: licenseKey,
      plan,
      status: 'active',
      expires_at: expiresAt,
      max_devices: devices
    };

    const { data: inserted, error: insErr } = await db.from('licenses').insert(newRecord);
    if (insErr) {
      console.error('[Admin Create License] Insert error:', insErr);
      return jsonResponse({ success: false, error: 'Database insert failed.' }, 500, request);
    }

    const createdLicense = inserted && inserted[0] ? inserted[0] : newRecord;

    // Optional: map to customer if email provided
    if (customerEmail && customerEmail.includes('@')) {
      await db.from('customers').insert({
        email: customerEmail.trim().toLowerCase(),
        license_id: createdLicense.id || null
      });
    }

    return jsonResponse(
      {
        success: true,
        message: 'License key generated successfully.',
        license: {
          ...createdLicense,
          license_key: licenseKey,
          activeDevices: 0
        }
      },
      201,
      request
    );
  } catch (err) {
    console.error('[Admin POST License] Error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}

// DELETE: Bulk delete licenses or clean test keys
export async function DELETE(request) {
  if (!verifyAdminAuth(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized: Invalid admin key.' }, 401, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { ids, type } = body || {};

    const db = getDb();

    // Clean all sample test keys (TEST-ARS-*)
    if (type === 'test') {
      const { data: allLicenses } = await db.from('licenses').select('*');
      const targetLicenses = (allLicenses || []).filter(
        (l) => l.license_key && l.license_key.startsWith('TEST-ARS-')
      );

      for (const lic of targetLicenses) {
        await db.from('activations').delete().eq('license_id', lic.id);
        await db.from('licenses').delete().eq('id', lic.id);
      }

      return jsonResponse(
        {
          success: true,
          count: targetLicenses.length,
          message: `Successfully cleaned up ${targetLicenses.length} demo test keys.`
        },
        200,
        request
      );
    }

    // Clean expired keys
    if (type === 'expired') {
      const { data: allLicenses } = await db.from('licenses').select('*');
      const now = new Date();
      const targetLicenses = (allLicenses || []).filter(
        (l) => l.status === 'expired' || (l.expires_at && new Date(l.expires_at) < now)
      );

      for (const lic of targetLicenses) {
        await db.from('activations').delete().eq('license_id', lic.id);
        await db.from('licenses').delete().eq('id', lic.id);
      }

      return jsonResponse(
        {
          success: true,
          count: targetLicenses.length,
          message: `Successfully deleted ${targetLicenses.length} expired licenses.`
        },
        200,
        request
      );
    }

    // Bulk delete specific IDs
    if (!Array.isArray(ids) || ids.length === 0) {
      return jsonResponse({ success: false, error: 'No license IDs provided for deletion.' }, 400, request);
    }

    for (const id of ids) {
      await db.from('activations').delete().eq('license_id', id);
      await db.from('licenses').delete().eq('id', id);
    }

    return jsonResponse(
      {
        success: true,
        count: ids.length,
        message: `Successfully deleted ${ids.length} license(s).`
      },
      200,
      request
    );
  } catch (err) {
    console.error('[Admin DELETE Licenses] Error:', err);
    return jsonResponse({ success: false, error: err.message || 'Internal server error.' }, 500, request);
  }
}

