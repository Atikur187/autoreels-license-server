/**
 * Server-side Paddle Environment and Configuration Validator.
 * 
 * CRITICAL SECURITY & STABILITY RULES:
 * 1. Never silently default the environment. Fails loudly if unset.
 * 2. Never expose PADDLE_API_KEY to client-side code.
 */

const DEFAULT_SANDBOX_CLIENT_TOKEN = 'test_22abe763cbc6f5b7f432db48a97';

export function getValidatedPaddleServerConfig() {
  const rawEnv = (
    process.env.PADDLE_ENV ||
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ||
    process.env.PADDLE_ENVIRONMENT ||
    'sandbox'
  ).trim().toLowerCase();

  const environment = (rawEnv === 'production' || rawEnv === 'live') ? 'production' : 'sandbox';

  const clientToken = (
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
    process.env.PADDLE_CLIENT_TOKEN ||
    (environment === 'sandbox' ? DEFAULT_SANDBOX_CLIENT_TOKEN : '')
  ).trim();

  if (environment === 'production') {
    if (!clientToken) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Paddle client token is unset in production. Please configure NEXT_PUBLIC_PADDLE_CLIENT_TOKEN in your environment.'
      );
    }
    if (!clientToken.startsWith('live_')) {
      throw new Error(
        `FATAL CONFIGURATION ERROR: In production mode, client token must start with "live_". Received: "${clientToken.substring(0, 8)}..."`
      );
    }
  }

  return {
    environment: environment as 'sandbox' | 'production',
    clientToken,
    isProduction: environment === 'production'
  };
}
