/**
 * AutoReels Scroll - Admin Authentication Login Endpoint
 * Route: POST /api/admin/auth/login
 * 
 * Securely verifies administrator credentials:
 * - Method 1: Master Admin Key (ADMIN_API_KEY) with timing-safe comparison
 * - Method 2: Supabase Email & Password with server-only ADMIN_EMAILS allowlist check
 * 
 * Returns HTTP 401 for invalid credentials.
 * Returns HTTP 403 for authenticated users not on the administrator allowlist.
 */

import { authenticateAdminCredentials } from '../../../../../lib/admin-auth.js';
import { getSupabaseAuthClient } from '../../../../../lib/supabase.js';
import { handleOptions, jsonResponse } from '../../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, adminKey } = body || {};

    const supabaseAuth = getSupabaseAuthClient();
    const result = await authenticateAdminCredentials(
      { email, password, adminKey },
      supabaseAuth ? { auth: supabaseAuth } : null
    );

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: result.error || 'Authentication failed.'
        },
        result.status || 401,
        request
      );
    }

    // Set secure cookie and return token
    const response = jsonResponse(
      {
        success: true,
        token: result.token,
        admin: result.admin,
        message: 'Admin authorization successful.'
      },
      200,
      request
    );

    // Set HTTP-only secure cookie for web sessions
    response.headers.set(
      'Set-Cookie',
      `ars_admin_token=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
    );

    return response;
  } catch (err) {
    console.error('[Admin Login API] Exception:', err);
    return jsonResponse(
      {
        success: false,
        error: 'Internal server error during authentication.'
      },
      500,
      request
    );
  }
}
