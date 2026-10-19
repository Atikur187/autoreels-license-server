/**
 * AutoReels Scroll - Admin Session Validation Endpoint
 * Route: GET /api/admin/auth/session
 * 
 * Validates the caller's active admin session or authorization header.
 * Returns HTTP 401 if unauthenticated.
 */

import { verifyAdminRequest } from '../../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  const auth = verifyAdminRequest(request);

  if (!auth.authorized) {
    return jsonResponse(
      {
        success: false,
        authenticated: false,
        error: auth.error || 'Unauthorized: No active admin session.'
      },
      auth.status || 401,
      request
    );
  }

  return jsonResponse(
    {
      success: true,
      authenticated: true,
      admin: auth.admin
    },
    200,
    request
  );
}
