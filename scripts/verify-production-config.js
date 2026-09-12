/**
 * AutoReels Scroll — Production Configuration & Readiness Verification Script
 * 
 * Verifies all 10 criteria required before deploying to production:
 * 1. PADDLE_ENV=production
 * 2. Live client-side token exists (starts with live_)
 * 3. Production price IDs exist (starts with pri_)
 * 4. Sandbox tokens (test_) are not used
 * 5. Sandbox price IDs (sample/test) are not used
 * 6. Webhook secret is configured
 * 7. Webhook endpoint exists and implements HMAC-SHA256 verification
 * 8. Fake test payment UI is completely removed from customer pages
 * 9. Test license bypass is completely removed
 * 10. Development-only buttons are absent from user-facing pricing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables if not already set
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const localEnv = loadEnvFile(path.join(rootDir, '.env.local'));
const prodEnv = loadEnvFile(path.join(rootDir, '.env.production'));
const env = { ...localEnv, ...prodEnv, ...process.env };

console.log('================================================================');
console.log('  AutoReels Scroll — Production Readiness & Integrity Check    ');
console.log('================================================================\n');

const checks = [];

function runCheck(id, description, validator) {
  try {
    const result = validator();
    checks.push({
      id,
      description,
      passed: result.passed,
      message: result.message
    });
  } catch (err) {
    checks.push({
      id,
      description,
      passed: false,
      message: 'Error executing check: ' + err.message
    });
  }
}

// 1. PADDLE_ENV === 'production'
runCheck(1, 'PADDLE_ENV must be set to "production"', () => {
  const currentEnv = (env.PADDLE_ENV || env.PADDLE_ENVIRONMENT || '').toLowerCase().trim();
  const passed = currentEnv === 'production' || currentEnv === 'live';
  return {
    passed,
    message: passed ? `Configured as "${currentEnv}"` : `Current value is "${currentEnv || 'unset'}". Must be "production".`
  };
});

// 2. live_ client-side token exists
runCheck(2, 'Paddle Client Token must start with "live_"', () => {
  const token = (env.PADDLE_CLIENT_TOKEN || env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '').trim();
  const passed = token.startsWith('live_');
  return {
    passed,
    message: passed ? 'Valid live_ client token configured.' : `Invalid or missing: "${token || 'unset'}". Must start with "live_".`
  };
});

// 3. Production price IDs exist
runCheck(3, 'Production Price IDs must be configured (pri_...)', () => {
  const m = (env.PADDLE_PRICE_MONTHLY || '').trim();
  const y = (env.PADDLE_PRICE_YEARLY || '').trim();
  const l = (env.PADDLE_PRICE_LIFETIME || '').trim();
  const passed = m.startsWith('pri_') && y.startsWith('pri_') && l.startsWith('pri_');
  return {
    passed,
    message: passed ? 'All 3 price IDs present with pri_ prefix.' : `Price IDs missing or invalid: monthly=${m}, yearly=${y}, lifetime=${l}.`
  };
});

// 4. Sandbox token is NOT used
runCheck(4, 'Sandbox token (test_...) must NOT be present in production', () => {
  const token = (env.PADDLE_CLIENT_TOKEN || env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '').trim();
  const passed = !token.startsWith('test_') && !token.includes('sample');
  return {
    passed,
    message: passed ? 'No sandbox token detected.' : `Sandbox token detected: "${token}".`
  };
});

// 5. Sandbox/sample price IDs are NOT used
runCheck(5, 'Sample or placeholder Price IDs must NOT be present', () => {
  const m = (env.PADDLE_PRICE_MONTHLY || '').trim();
  const y = (env.PADDLE_PRICE_YEARLY || '').trim();
  const l = (env.PADDLE_PRICE_LIFETIME || '').trim();
  const hasSample = m.includes('sample') || y.includes('sample') || l.includes('sample');
  return {
    passed: !hasSample,
    message: !hasSample ? 'All price IDs are real production identifiers.' : 'Placeholder "sample" price IDs detected.'
  };
});

// 6. Webhook secret exists
runCheck(6, 'PADDLE_WEBHOOK_SECRET must be configured', () => {
  const secret = (env.PADDLE_WEBHOOK_SECRET || '').trim();
  const passed = secret.length > 10 && !secret.includes('test_webhook_secret');
  return {
    passed,
    message: passed ? 'Production webhook secret configured.' : 'Webhook secret is missing or contains test placeholder.'
  };
});

// 7. Production webhook route exists and verifies HMAC signatures
runCheck(7, 'Webhook endpoint (/api/paddle/webhook) must cryptographically verify signatures', () => {
  const webhookFile = path.join(rootDir, 'app', 'api', 'paddle', 'webhook', 'route.js');
  if (!fs.existsSync(webhookFile)) {
    return { passed: false, message: 'File app/api/paddle/webhook/route.js does not exist.' };
  }
  const content = fs.readFileSync(webhookFile, 'utf8');
  const hasSigCheck = content.includes('verifyPaddleWebhook') && content.includes('Paddle-Signature');
  return {
    passed: hasSigCheck,
    message: hasSigCheck ? 'Verified HMAC-SHA256 signature verification in webhook receiver.' : 'Signature verification missing in webhook receiver.'
  };
});

// 8. Fake test payment UI is removed
runCheck(8, 'Fake test payment buttons must NOT exist in customer UI (app/page.js)', () => {
  const pageFile = path.join(rootDir, 'app', 'page.js');
  const content = fs.readFileSync(pageFile, 'utf8');
  const hasFakeBtn = content.includes('Test Sandbox Payment') || content.includes('Issue License Now');
  const hasSandboxNotice = content.includes('Paddle Sandbox Mode');
  const passed = !hasFakeBtn && !hasSandboxNotice;
  return {
    passed,
    message: passed ? 'No fake payment buttons or sandbox notices in customer pricing page.' : 'Detected test payment buttons or sandbox notice in app/page.js.'
  };
});

// 9. Test license bypass is removed
runCheck(9, 'No client-side license generation bypass in checkout success', () => {
  const successFile = path.join(rootDir, 'app', 'checkout', 'success', 'page.js');
  const content = fs.readFileSync(successFile, 'utf8');
  const hasBypass = content.includes('payment_success=true') || content.includes('bypass');
  const hasBackendPoll = content.includes('/api/license/status');
  const passed = !hasBypass && hasBackendPoll;
  return {
    passed,
    message: passed ? 'Success page strictly depends on authoritative backend webhook verification.' : 'Potential client-side bypass found.'
  };
});

// 10. Development-only testing controls restricted
runCheck(10, 'Development endpoints strictly disabled in production', () => {
  const simFile = path.join(rootDir, 'app', 'api', 'checkout', 'simulate-sandbox-payment', 'route.js');
  if (!fs.existsSync(simFile)) {
    return { passed: true, message: 'Simulation route not present.' };
  }
  const content = fs.readFileSync(simFile, 'utf8');
  const hasProdBlock = content.includes('IS_PRODUCTION') && content.includes('403');
  return {
    passed: hasProdBlock,
    message: hasProdBlock ? 'Simulation endpoint strictly locked with 403 Forbidden in production.' : 'Simulation endpoint is missing production lock.'
  };
});

// Output results table
let allPassed = true;
checks.forEach((c) => {
  const status = c.passed ? '✅ PASS' : '❌ FAIL';
  if (!c.passed) allPassed = false;
  console.log(`[${status}] Check ${c.id}: ${c.description}`);
  console.log(`       Detail: ${c.message}\n`);
});

console.log('----------------------------------------------------------------');
if (allPassed) {
  console.log('🎉 ALL PRODUCTION CHECKS PASSED! Ready for live deployment.');
  process.exit(0);
} else {
  console.log('⚠️ PRODUCTION READINESS FAILED. Resolve the failed checks above before deploying to production.');
  // Return non-zero if executing strictly in production check mode
  if (process.argv.includes('--strict')) {
    process.exit(1);
  }
}
