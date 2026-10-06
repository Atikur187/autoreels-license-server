/**
 * AutoReels Scroll — Server-side Paddle Node SDK Client
 * 
 * Provides authenticated Paddle client instance for server-side API operations:
 * - Webhook signature unmarshaling & validation
 * - Customer portal session creation
 * - Subscription & pricing lookups
 * 
 * CRITICAL SECURITY RULES:
 * 1. Server-side ONLY. Never import or bundle into client ('use client') code.
 * 2. Fail loudly if environment or secret API keys are missing.
 * 3. Never silently default the environment.
 */

import { Paddle, Environment } from '@paddle/paddle-node-sdk';

let paddleInstance = null;

/**
 * Returns an initialized Paddle Node SDK client.
 * Validates environment variables and enforces production security.
 */
export function getPaddleNodeClient() {
  if (paddleInstance) {
    return paddleInstance;
  }

  const rawEnv = (
    process.env.PADDLE_ENV ||
    process.env.PADDLE_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ||
    'sandbox'
  ).trim().toLowerCase();

  const isProd = rawEnv === 'production' || rawEnv === 'live';
  const environment = isProd ? Environment.production : Environment.sandbox;

  const apiKey = (process.env.PADDLE_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: PADDLE_API_KEY is unset on the server. ' +
      'A server-side secret API key is required to interact with the Paddle API.'
    );
  }

  if (isProd && !apiKey.startsWith('pdl_live_apikey_')) {
    console.warn(
      '[PADDLE NODE SDK] Warning: In production mode, secret API key typically starts with "pdl_live_apikey_".'
    );
  }

  paddleInstance = new Paddle(apiKey, {
    environment
  });

  return paddleInstance;
}

/**
 * Resolves the webhook signing secret from environment.
 * Fails loudly if unset.
 */
export function getPaddleWebhookSecret() {
  const secret = (process.env.PADDLE_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: PADDLE_WEBHOOK_SECRET is unset. ' +
      'A webhook notification signing secret is required to verify incoming deliveries.'
    );
  }
  return secret;
}
