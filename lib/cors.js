/**
 * AutoReels Scroll - License API CORS Helper
 * Handles Chrome Extension origin requests (chrome-extension://<id>)
 * without using dangerous unrestricted wildcards where inappropriate.
 */

/**
 * Build CORS response headers based on request Origin.
 * @param {Request} request
 * @returns {Record<string, string>}
 */
export function getCorsHeaders(request) {
  const origin = (request && request.headers && request.headers.get)
    ? (request.headers.get('origin') || '')
    : '';

  // Chrome Extension origins start with chrome-extension://
  // Also allow local development servers (localhost) and production web origins
  let allowedOrigin = '*';
  if (origin && (origin.startsWith('chrome-extension://') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key, x-installation-id',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/**
 * Handle HTTP OPTIONS preflight request.
 * @param {Request} request
 * @returns {Response}
 */
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

/**
 * Helper to wrap JSON responses with CORS headers.
 * @param {any} data
 * @param {number} status
 * @param {Request} request
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, request = null) {
  const cors = request ? getCorsHeaders(request) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}
