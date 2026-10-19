/**
 * AutoReels Scroll — Customer & Subscription State Persistence Service
 * 
 * Provides idempotent database persistence for Paddle customers and subscriptions,
 * gracefully adapting to live Supabase PostgreSQL schema and local in-memory fallback.
 */

import { getDb, isLiveSupabase } from './supabase.js';
import { hasSubscriptionAccess, getSubscriptionAccessDetails } from './subscription-access.js';

/**
 * Idempotently upserts a customer record from verified Paddle events.
 * 
 * @param {object} params
 * @param {string} params.customerId - Paddle customer ID (e.g. ctm_...)
 * @param {string} params.email - Customer email address
 * @returns {Promise<object>} Persisted customer record
 */
export async function upsertCustomer({ customerId, email }) {
  if (!customerId || !email) {
    throw new Error('customerId and email are required to upsert customer.');
  }

  const cleanCustomerId = customerId.trim();
  const cleanEmail = email.trim().toLowerCase();
  const db = getDb();
  const now = new Date().toISOString();

  // Always keep in-memory store synchronized for instant resolution & offline testing
  const memCustomers = globalThis.__memCustomers || [];
  const memIdx = memCustomers.findIndex(
    (c) => (c.customer_id && c.customer_id === cleanCustomerId) || c.email === cleanEmail
  );
  const memRecord = {
    customer_id: cleanCustomerId,
    id: cleanCustomerId,
    email: cleanEmail,
    updated_at: now
  };
  if (memIdx !== -1) {
    memCustomers[memIdx] = { ...memCustomers[memIdx], ...memRecord };
  } else {
    memCustomers.push({ ...memRecord, created_at: now });
  }
  globalThis.__memCustomers = memCustomers;

  // Try upserting into public.customers with customer_id primary key
  try {
    const { data, error } = await db
      .from('customers')
      .upsert(
        {
          customer_id: cleanCustomerId,
          email: cleanEmail,
          updated_at: now
        },
        { onConflict: 'customer_id' }
      )
      .select();

    if (!error && data && data.length > 0) {
      return {
        ...data[0],
        customer_id: data[0].customer_id || cleanCustomerId
      };
    }

    if (error) {
      // If customer_id column doesn't exist yet on live Supabase, fallback to finding by email
      const { data: existing } = await db
        .from('customers')
        .select('*')
        .eq('email', cleanEmail)
        .limit(1);

      if (existing && existing.length > 0) {
        return {
          ...existing[0],
          customer_id: existing[0].customer_id || cleanCustomerId
        };
      }

      // Try inserting with email only
      const { data: inserted } = await db
        .from('customers')
        .insert({
          email: cleanEmail,
          has_trial_claimed: false,
          created_at: now,
          updated_at: now
        })
        .select();

      if (inserted && inserted.length > 0) {
        return {
          ...inserted[0],
          customer_id: cleanCustomerId
        };
      }
    }
  } catch (err) {
    console.warn('[DB SERVICE] Customer persistence warning (proceeding):', err.message);
  }

  return memRecord;
}

/**
 * Retrieves a customer record by customer_id or email.
 * 
 * @param {string} customerIdOrEmail
 * @returns {Promise<object | null>}
 */
export async function getCustomer(customerIdOrEmail) {
  if (!customerIdOrEmail) return null;
  const term = customerIdOrEmail.trim();
  const db = getDb();

  try {
    // 1. Try querying by customer_id
    if (term.startsWith('ctm_')) {
      const { data } = await db
        .from('customers')
        .select('*')
        .eq('customer_id', term)
        .limit(1);

      if (data && data.length > 0) {
        return {
          ...data[0],
          customer_id: data[0].customer_id || term
        };
      }
    }

    // 2. Try querying by email
    const { data } = await db
      .from('customers')
      .select('*')
      .eq('email', term.toLowerCase())
      .limit(1);

    if (data && data.length > 0) {
      // Check memory store for mapped customer_id
      const memCustomers = globalThis.__memCustomers || [];
      const memMatch = memCustomers.find((c) => c.email === term.toLowerCase());
      return {
        ...data[0],
        customer_id: data[0].customer_id || memMatch?.customer_id || (term.startsWith('ctm_') ? term : null)
      };
    }
  } catch (err) {
    console.warn('[DB SERVICE] Error looking up customer:', err.message);
  }

  // 3. Fallback: check in-memory store
  const memCustomers = globalThis.__memCustomers || [];
  const memMatch = memCustomers.find(
    (c) => (c.customer_id && c.customer_id === term) || (c.email && c.email === term.toLowerCase())
  );
  if (memMatch) return memMatch;

  // 3. Fallback: check purchases table for mapped paddle_customer_id
  try {
    const { data: purchases } = await db
      .from('purchases')
      .select('*')
      .or(`customer_email.eq.${term.toLowerCase()},paddle_customer_id.eq.${term}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (purchases && purchases.length > 0) {
      return {
        customer_id: purchases[0].paddle_customer_id || `ctm_derived_${purchases[0].id}`,
        email: purchases[0].customer_email,
        created_at: purchases[0].created_at,
        updated_at: purchases[0].updated_at
      };
    }
  } catch {}

  return null;
}

/**
 * Idempotently upserts a subscription state record from verified Paddle events.
 * 
 * @param {object} params
 * @param {string} params.subscriptionId - Paddle subscription ID (sub_...)
 * @param {string} params.customerId - Paddle customer ID (ctm_...)
 * @param {string} params.status - 'active' | 'trialing' | 'paused' | 'past_due' | 'canceled'
 * @param {string} params.priceId - Paddle price ID (pri_...)
 * @param {string} params.productId - Paddle product ID (pro_...)
 * @param {string} [params.scheduledChangeAction] - 'cancel' | 'pause' | null
 * @param {string} [params.scheduledChangeAt] - ISO timestamp or null
 * @returns {Promise<object>} Persisted subscription record
 */
export async function upsertSubscription({
  subscriptionId,
  customerId,
  status,
  priceId,
  productId,
  scheduledChangeAction = null,
  scheduledChangeAt = null
}) {
  if (!subscriptionId || !customerId) {
    throw new Error('subscriptionId and customerId are required.');
  }

  const cleanSubId = subscriptionId.trim();
  const cleanCustomerId = customerId.trim();
  const cleanStatus = (status || 'active').trim().toLowerCase();
  const cleanPriceId = (priceId || '').trim();
  const cleanProductId = (productId || '').trim();
  const now = new Date().toISOString();

  const record = {
    subscription_id: cleanSubId,
    customer_id: cleanCustomerId,
    status: cleanStatus,
    price_id: cleanPriceId,
    product_id: cleanProductId,
    scheduled_change_action: scheduledChangeAction || null,
    scheduled_change_at: scheduledChangeAt || null,
    updated_at: now
  };

  // Always keep in-memory store synchronized for instant resolution & offline testing
  const memSubscriptions = globalThis.__memSubscriptions || [];
  const memIdx = memSubscriptions.findIndex((s) => s.subscription_id === cleanSubId);
  if (memIdx !== -1) {
    memSubscriptions[memIdx] = { ...memSubscriptions[memIdx], ...record };
  } else {
    memSubscriptions.push({ ...record, created_at: now });
  }
  globalThis.__memSubscriptions = memSubscriptions;

  const db = getDb();

  try {
    const { data, error } = await db
      .from('subscriptions')
      .upsert(record, { onConflict: 'subscription_id' })
      .select();

    if (!error && data && data.length > 0) {
      return data[0];
    }

    if (error) {
      // Fallback: If table does not exist in live Supabase, update purchases table
      await db
        .from('purchases')
        .update({
          status: cleanStatus,
          updated_at: now
        })
        .eq('paddle_subscription_id', cleanSubId);
    }
  } catch (err) {
    console.warn('[DB SERVICE] Subscription persistence warning:', err.message);
  }

  return record;
}

/**
 * Retrieves a subscription record by subscription ID.
 * 
 * @param {string} subscriptionId
 * @returns {Promise<object | null>}
 */
export async function getSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  const db = getDb();
  const cleanId = subscriptionId.trim();

  try {
    const { data } = await db
      .from('subscriptions')
      .select('*')
      .eq('subscription_id', cleanId)
      .limit(1);

    if (data && data.length > 0) {
      return data[0];
    }
  } catch (err) {
    console.warn('[DB SERVICE] Error looking up subscription:', err.message);
  }

  // Fallback to in-memory store
  const memSubscriptions = globalThis.__memSubscriptions || [];
  const memSub = memSubscriptions.find((s) => s.subscription_id === cleanId);
  if (memSub) return memSub;

  // Fallback to purchases table
  try {
    const { data: purchases } = await db
      .from('purchases')
      .select('*')
      .eq('paddle_subscription_id', cleanId)
      .limit(1);

    if (purchases && purchases.length > 0) {
      const p = purchases[0];
      return {
        subscription_id: p.paddle_subscription_id,
        customer_id: p.paddle_customer_id,
        status: p.status,
        price_id: p.metadata?.price_id || '',
        product_id: p.product_id || '',
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    }
  } catch {}

  return null;
}

/**
 * Retrieves all subscriptions belonging to a customer ID.
 * 
 * @param {string} customerId
 * @returns {Promise<Array>}
 */
export async function getCustomerSubscriptions(customerId) {
  if (!customerId) return [];
  const db = getDb();
  const cleanId = customerId.trim();

  try {
    const { data } = await db
      .from('subscriptions')
      .select('*')
      .eq('customer_id', cleanId)
      .order('updated_at', { ascending: false });

    if (data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('[DB SERVICE] Error querying customer subscriptions:', err.message);
  }

  // Fallback to in-memory store
  const memSubscriptions = globalThis.__memSubscriptions || [];
  const memMatches = memSubscriptions.filter((s) => s.customer_id === cleanId);
  if (memMatches.length > 0) return memMatches;

  // Fallback to purchases table
  try {
    const { data: purchases } = await db
      .from('purchases')
      .select('*')
      .eq('paddle_customer_id', customerId.trim())
      .order('created_at', { ascending: false });

    if (purchases && purchases.length > 0) {
      return purchases
        .filter((p) => p.paddle_subscription_id)
        .map((p) => ({
          subscription_id: p.paddle_subscription_id,
          customer_id: p.paddle_customer_id,
          status: p.status,
          price_id: p.metadata?.price_id || '',
          product_id: p.product_id || '',
          created_at: p.created_at,
          updated_at: p.updated_at
        }));
    }
  } catch {}

  return [];
}

/**
 * Determines whether a customer currently has paid access,
 * resolving their subscriptions and evaluating them through the access helper rules.
 * 
 * @param {string} customerIdOrEmail
 * @returns {Promise<{ hasAccess: boolean, status: string, activeSubscription: object | null, details: object }>}
 */
export async function checkCustomerAccess(customerIdOrEmail) {
  const customer = await getCustomer(customerIdOrEmail);
  if (!customer) {
    return {
      hasAccess: false,
      status: 'none',
      activeSubscription: null,
      details: getSubscriptionAccessDetails(null)
    };
  }

  const customerId = customer.customer_id || customer.id;
  const subscriptions = await getCustomerSubscriptions(customerId);

  // Find first subscription granting access (active or trialing)
  for (const sub of subscriptions) {
    if (hasSubscriptionAccess(sub)) {
      return {
        hasAccess: true,
        status: sub.status,
        activeSubscription: sub,
        details: getSubscriptionAccessDetails(sub)
      };
    }
  }

  // If no active/trialing subscription found, return most recent subscription status
  const latestSub = subscriptions.length > 0 ? subscriptions[0] : null;
  return {
    hasAccess: false,
    status: latestSub ? latestSub.status : 'none',
    activeSubscription: latestSub,
    details: getSubscriptionAccessDetails(latestSub)
  };
}
