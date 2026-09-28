/**
 * Server-side Paddle Environment and Configuration Validator.
 * 
 * CRITICAL SECURITY & STABILITY RULES:
 * 1. Never silently default the environment. Fails loudly if unset.
 * 2. Never expose PADDLE_API_KEY to client-side code.
 */

export function getValidatedPaddleServerConfig() {
  const rawEnv = (
    process.env.PADDLE_ENV ||
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ||
    process.env.PADDLE_ENVIRONMENT ||
    ''
  ).trim();

  if (!rawEnv) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Paddle environment variable (PADDLE_ENV or NEXT_PUBLIC_PADDLE_ENVIRONMENT) is unset. ' +
      'It must be explicitly defined as "sandbox" or "production" to prevent accidental transactions on the wrong account.'
    );
  }

  const environment = rawEnv.toLowerCase();
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error(
      `FATAL CONFIGURATION ERROR: Invalid Paddle environment "${rawEnv}". Must be strictly "sandbox" or "production".`
    );
  }

  const clientToken = (
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
    process.env.PADDLE_CLIENT_TOKEN ||
    ''
  ).trim();

  if (!clientToken) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Paddle client token (PADDLE_CLIENT_TOKEN or NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) is unset.'
    );
  }

  if (environment === 'sandbox' && !clientToken.startsWith('test_')) {
    throw new Error(
      `FATAL CONFIGURATION ERROR: In sandbox mode, client token must start with "test_". Received: "${clientToken.substring(0, 8)}..."`
    );
  }

  if (environment === 'production' && !clientToken.startsWith('live_')) {
    throw new Error(
      `FATAL CONFIGURATION ERROR: In production mode, client token must start with "live_". Received: "${clientToken.substring(0, 8)}..."`
    );
  }

  return {
    environment: environment as 'sandbox' | 'production',
    clientToken,
    isProduction: environment === 'production'
  };
}
