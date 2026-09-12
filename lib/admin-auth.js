/**
 * AutoReels Scroll - Admin Authentication Helper
 * Protects administrative API routes against unauthorized access.
 */

import crypto from 'crypto';

/**
 * Verify administrative authorization header.
 * @param {Request} request
 * @returns {boolean}
 */
export function verifyAdminAuth(request) {
  const adminSecret = process.env.ADMIN_API_KEY || 'admin-secret-key-change-in-production';

  const providedKey = request.headers.get('x-admin-key') || '';
  if (!providedKey) return false;

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(providedKey.trim());
    const b = Buffer.from(adminSecret.trim());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
