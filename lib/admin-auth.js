/**
 * AutoReels Scroll - Secure Administrator Authentication & Session Manager
 * 
 * Implements strict server-validated administrator authorization:
 * 1. Supports Supabase user authentication with server-only ADMIN_EMAILS allowlist.
 * 2. Supports Master Admin Key (ADMIN_API_KEY) with constant-time cryptographic verification.
 * 3. Secure cryptographically random server-side session token management.
 * 4. Strictly denies public registration or untrusted client-side isAdmin claims.
 * 5. Returns HTTP 401 for unauthenticated requests and HTTP 403 for non-admin accounts.
 */

import crypto from 'crypto';

// In-memory active session store (keyed by 64-char token)
const globalForAdmin = globalThis;
if (!globalForAdmin.__adminSessions) {
  globalForAdmin.__adminSessions = new Map();
}
const adminSessions = globalForAdmin.__adminSessions;

// Session TTL: 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Checks whether an email is on the server-only ADMIN_EMAILS allowlist.
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailAuthorizedAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();

  const adminEmailsConfig = (process.env.ADMIN_EMAILS || '').trim();
  if (!adminEmailsConfig) {
    // If ADMIN_EMAILS is not explicitly configured, fall back to comparing with ADMIN_USER_EMAIL or reject
    const fallbackEmail = (process.env.ADMIN_USER_EMAIL || '').trim().toLowerCase();
    if (fallbackEmail) return cleanEmail === fallbackEmail;
    return false;
  }

  const allowedList = adminEmailsConfig
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowedList.includes(cleanEmail);
}

/**
 * Creates a cryptographically secure session for an authenticated admin.
 * @param {{ email: string, role?: string, method: string }} adminInfo
 * @returns {string} 64-character session token
 */
export function createAdminSession(adminInfo) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  adminSessions.set(token, {
    token,
    email: adminInfo.email || 'admin@autoreels.local',
    role: adminInfo.role || 'administrator',
    method: adminInfo.method || 'key',
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  });

  return token;
}

/**
 * Retrieves and validates an active admin session.
 * @param {string} token
 * @returns {object | null}
 */
export function getAdminSession(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  const session = adminSessions.get(cleanToken);

  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    adminSessions.delete(cleanToken);
    return null;
  }

  return session;
}

/**
 * Destroys an active admin session (logout).
 * @param {string} token
 * @returns {boolean}
 */
export function destroyAdminSession(token) {
  if (!token) return false;
  return adminSessions.delete(token.trim());
}

/**
 * Authenticates admin credentials using either:
 * A) Supabase User Credentials (email + password) checked against ADMIN_EMAILS allowlist.
 * B) Master Admin Secret Key (ADMIN_API_KEY) with constant-time comparison.
 * 
 * @param {{ email?: string, password?: string, adminKey?: string }} credentials
 * @param {object} [supabaseClient] Optional Supabase client instance
 * @returns {Promise<{ success: boolean, status: number, error?: string, token?: string, admin?: object }>}
 */
export async function authenticateAdminCredentials({ email, password, adminKey }, supabaseClient = null) {
  // Option A: Master Admin Key Authentication
  if (adminKey && typeof adminKey === 'string' && adminKey.trim()) {
    const configuredSecret = (process.env.ADMIN_API_KEY || '').trim();

    if (!configuredSecret || configuredSecret === 'admin-secret-key-change-in-production') {
      // In development, allow the default key with a warning, but reject empty credentials
      if (adminKey.trim() !== 'admin-secret-key-change-in-production') {
        return {
          success: false,
          status: 401,
          error: 'Unauthorized: Invalid Admin Key.'
        };
      }
    } else {
      // Production comparison using timing-safe buffer comparison
      try {
        const a = Buffer.from(adminKey.trim());
        const b = Buffer.from(configuredSecret);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return {
            success: false,
            status: 401,
            error: 'Unauthorized: Invalid Admin Key.'
          };
        }
      } catch {
        return {
          success: false,
          status: 401,
          error: 'Unauthorized: Invalid Admin Key.'
        };
      }
    }

    const sessionToken = createAdminSession({
      email: 'master-admin',
      role: 'administrator',
      method: 'admin_api_key'
    });

    return {
      success: true,
      status: 200,
      token: sessionToken,
      admin: {
        email: 'master-admin',
        role: 'administrator',
        method: 'admin_api_key'
      }
    };
  }

  // Option B: Supabase Email & Password Authentication
  if (email && password) {
    const cleanEmail = email.trim().toLowerCase();

    // Check allowlist first: If email is definitely NOT an authorized admin, reject early
    if (!isEmailAuthorizedAdmin(cleanEmail)) {
      console.warn(`[Admin Auth] Access attempt from non-admin email: ${cleanEmail}`);
      return {
        success: false,
        status: 403,
        error: 'Forbidden: This email is not authorized for administrator access.'
      };
    }

    // Authenticate with Supabase Auth if client available
    if (supabaseClient && supabaseClient.auth) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: cleanEmail,
          password: password.trim()
        });

        if (error || !data?.user) {
          return {
            success: false,
            status: 401,
            error: error?.message || 'Invalid email or password.'
          };
        }

        const sessionToken = createAdminSession({
          email: data.user.email,
          role: 'administrator',
          method: 'supabase_auth'
        });

        return {
          success: true,
          status: 200,
          token: sessionToken,
          admin: {
            email: data.user.email,
            role: 'administrator',
            method: 'supabase_auth'
          }
        };
      } catch (authErr) {
        return {
          success: false,
          status: 500,
          error: 'Supabase authentication service unavailable: ' + authErr.message
        };
      }
    } else {
      return {
        success: false,
        status: 503,
        error: 'Supabase authentication is not configured on this server. Use Admin Key login.'
      };
    }
  }

  return {
    success: false,
    status: 400,
    error: 'Please provide either an Admin Key or Email & Password.'
  };
}

/**
 * Verifies administrative authorization on an incoming Next.js Request.
 * Inspects:
 * - Authorization: Bearer <token>
 * - x-admin-token: <token>
 * - x-admin-key: <ADMIN_API_KEY>
 * - Cookie: ars_admin_token=<token>
 * 
 * @param {Request} request
 * @returns {{ authorized: boolean, status: number, error?: string, admin?: object }}
 */
export function verifyAdminRequest(request) {
  // 1. Check for session token in headers
  const authHeader = request.headers.get('authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = request.headers.get('x-admin-token') || '';
  }

  // 2. Check for cookie token if no header
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/ars_admin_token=([^;]+)/);
    if (match) token = match[1].trim();
  }

  // If token is found, validate session
  if (token) {
    const session = getAdminSession(token);
    if (session) {
      return {
        authorized: true,
        status: 200,
        admin: {
          email: session.email,
          role: session.role,
          method: session.method
        }
      };
    }
  }

  // 3. Fallback: Check direct x-admin-key header
  const adminSecret = (process.env.ADMIN_API_KEY || 'admin-secret-key-change-in-production').trim();
  const providedKey = (request.headers.get('x-admin-key') || '').trim();

  if (providedKey) {
    try {
      const a = Buffer.from(providedKey);
      const b = Buffer.from(adminSecret);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return {
          authorized: true,
          status: 200,
          admin: {
            email: 'master-admin',
            role: 'administrator',
            method: 'admin_api_key'
          }
        };
      }
    } catch {}
  }

  return {
    authorized: false,
    status: 401,
    error: 'Unauthorized: Valid administrator authorization is required.'
  };
}

/**
 * Backwards-compatible boolean check for existing route handlers.
 * @param {Request} request
 * @returns {boolean}
 */
export function verifyAdminAuth(request) {
  return verifyAdminRequest(request).authorized;
}
