/**
 * AutoReels Scroll — Dynamic Paddle Webhook IP Allowlist Validator
 * 
 * Fetches current authoritative Paddle delivery IP ranges from https://api.paddle.com/ips
 * (data.ipv4_cidrs) and validates incoming requests against the dynamic list.
 * Caches IP CIDRs in memory with automated daily refresh to prevent static hardcoding.
 */

let cachedIps = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches authoritative IPv4 CIDRs from Paddle's live API endpoint.
 * @returns {Promise<string[]>}
 */
export async function getAuthoritativePaddleIps() {
  const now = Date.now();
  if (cachedIps && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedIps;
  }

  try {
    const res = await fetch('https://api.paddle.com/ips', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 }
    });

    if (res.ok) {
      const json = await res.json();
      const cidrs = json?.data?.ipv4_cidrs || [];
      if (Array.isArray(cidrs) && cidrs.length > 0) {
        cachedIps = cidrs;
        lastFetchTime = now;
        return cidrs;
      }
    }
  } catch (err) {
    console.warn('[PADDLE IP ALLOWLIST] Warning fetching https://api.paddle.com/ips:', err.message);
  }

  // Fallback to last known Paddle CIDRs if network fetch fails temporarily
  if (cachedIps) return cachedIps;

  return [
    '34.237.3.244/32',
    '34.195.105.136/32',
    '34.232.58.13/32',
    '35.155.119.135/32',
    '34.212.5.7/32',
    '52.11.166.252/32'
  ];
}

/**
 * Checks whether an incoming IPv4 address falls within a given CIDR notation.
 * 
 * @param {string} ip
 * @param {string} cidr
 * @returns {boolean}
 */
export function isIpInCidr(ip, cidr) {
  if (!ip || !cidr) return false;
  const cleanIp = ip.replace(/^::ffff:/, '').trim();

  const [range, bits = '32'] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipToInt = (addr) =>
    addr
      .split('.')
      .reduce((int, octet) => ((int << 8) + parseInt(octet, 10)) >>> 0, 0);

  try {
    return (ipToInt(cleanIp) & mask) === (ipToInt(range) & mask);
  } catch {
    return cleanIp === range;
  }
}

/**
 * Validates whether an incoming HTTP request originates from an allowed Paddle IP.
 * In production, strictly enforces Paddle CIDRs.
 * In sandbox / testing, allows local traffic and logged sandbox IPs.
 * 
 * @param {Request} request
 * @param {string} environment - 'production' | 'sandbox'
 * @returns {Promise<{ allowed: boolean, clientIp: string, reason?: string }>}
 */
export async function validatePaddleWebhookIp(request, environment = 'production') {
  // Extract client IP from standard proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const cfConnectingIp = request.headers.get('cf-connecting-ip') || '';

  const clientIp = (
    cfConnectingIp ||
    (forwardedFor ? forwardedFor.split(',')[0].trim() : '') ||
    realIp ||
    '127.0.0.1'
  ).replace(/^::ffff:/, '').trim();

  // In sandbox or local development, allow localhost/testing traffic
  if (environment !== 'production') {
    if (clientIp === '127.0.0.1' || clientIp === 'localhost' || clientIp === '::1') {
      return { allowed: true, clientIp };
    }
  }

  // Fetch authoritative CIDRs from https://api.paddle.com/ips
  const allowedCidrs = await getAuthoritativePaddleIps();

  const isAllowed = allowedCidrs.some((cidr) => isIpInCidr(clientIp, cidr));

  if (!isAllowed) {
    // If running in sandbox mode, permit non-matching IP with warning for developer ease
    if (environment === 'sandbox') {
      console.warn(`[PADDLE IP ALLOWLIST] Sandbox notice: IP ${clientIp} not in live CIDRs (allowed in sandbox).`);
      return { allowed: true, clientIp };
    }

    return {
      allowed: false,
      clientIp,
      reason: `Client IP ${clientIp} is not in Paddle's authoritative CIDRs (${allowedCidrs.join(', ')}).`
    };
  }

  return { allowed: true, clientIp };
}
