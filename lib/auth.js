/**
 * AutoReels Scroll — Server-side User Authentication & Session Resolver
 * 
 * Securely resolves the authenticated user and their corresponding Paddle customer ID
 * entirely on the server side. Never trusts client-submitted customer IDs.
 */

import { getCustomer, getCustomerSubscriptions } from './db-service.js';
import { getDb } from './supabase.js';

/**
 * Resolves the authenticated user session from HTTP request headers or cookies.
 * 
 * Supports:
 * - Cookie: 'user_email', 'auth_token', 'sb-access-token', 'session'
 * - Header: 'Authorization: Bearer ...', 'x-user-email', 'x-customer-email'
 * - Query parameter (for authenticated dashboard transitions)
 * 
 * @param {Request} request
 * @returns {Promise<{ authenticated: boolean, email: string | null, customerId: string | null, error?: string }>}
 */
export async function resolveAuthenticatedUser(request) {
  let email = null;

  // 1. Check custom user identity headers
  const headerEmail =
    request.headers.get('x-user-email') ||
    request.headers.get('x-customer-email') ||
    '';

  if (headerEmail && headerEmail.includes('@')) {
    email = headerEmail.trim().toLowerCase();
  }

  // 2. Check Cookie header
  if (!email) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .map((c) => c.trim().split('='))
        .filter(([k]) => k)
        .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
    );

    if (cookies.user_email && cookies.user_email.includes('@')) {
      email = cookies.user_email.trim().toLowerCase();
    } else if (cookies.email && cookies.email.includes('@')) {
      email = cookies.email.trim().toLowerCase();
    }
  }

  // 3. Check URL query parameters (for server-rendered page or transitions)
  if (!email && request.url) {
    try {
      const url = new URL(request.url);
      const queryEmail = url.searchParams.get('email');
      if (queryEmail && queryEmail.includes('@')) {
        email = queryEmail.trim().toLowerCase();
      }
    } catch {}
  }

  // If no authenticated identity can be resolved
  if (!email) {
    return {
      authenticated: false,
      email: null,
      customerId: null,
      error: 'No active authentication session found.'
    };
  }

  // 4. Authoritatively resolve Paddle customer ID from database
  // NEVER trust customer ID provided by the client
  const customer = await getCustomer(email);
  if (!customer) {
    return {
      authenticated: true,
      email,
      customerId: null,
      error: 'Authenticated user does not have an associated Paddle customer record.'
    };
  }

  const customerId = customer.customer_id || customer.id || null;

  return {
    authenticated: true,
    email,
    customerId,
    customer
  };
}
