/**
 * AutoReels Scroll - Admin Logout Endpoint
 * Route: POST /api/admin/auth/logout
 * 
 * Securely destroys the administrator session.
 */

import { destroyAdminSession } from '../../../../../lib/admin-auth.js';
import { handleOptions, jsonResponse } from '../../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = request.headers.get('x-admin-token') || '';
  }

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/ars_admin_token=([^;]+)/);
    if (match) token = match[1].trim();
  }

  if (token) {
    destroyAdminSession(token);
  }

  const response = jsonResponse(
    {
      success: true,
      message: 'Logged out successfully.'
    },
    200,
    request
  );

  // Clear cookie
  response.headers.set(
    'Set-Cookie',
    'ars_admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  );

  return response;
}
