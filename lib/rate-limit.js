/**
 * AutoReels Scroll - Sliding Window In-Memory Rate Limiter
 * Protects activation, verification, and deactivation endpoints from brute force and DoS attacks.
 */

const requestCounts = new Map();

// Periodic cleanup of stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 300000);

/**
 * Check if a client has exceeded their request limit.
 * @param {string} identifier IP address or client identifier
 * @param {number} [limit=30] Max allowed requests within window
 * @param {number} [windowMs=60000] Window length in milliseconds (default 1 minute)
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(identifier, limit = 30, windowMs = 60000) {
  const key = identifier || 'unknown-client';
  const now = Date.now();
  const record = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    requestCounts.set(key, record);
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (record.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count += 1;
  requestCounts.set(key, record);
  return { allowed: true, remaining: limit - record.count, retryAfter: 0 };
}

/**
 * Extract client IP or identifier from Next.js Request.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIdentifier(request) {
  if (!request || !request.headers) return 'unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'anonymous';
}
