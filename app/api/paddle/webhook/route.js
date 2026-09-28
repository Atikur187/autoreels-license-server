/**
 * AutoReels Scroll — Official Paddle Webhook Receiver
 * Route: POST /api/paddle/webhook
 * 
 * Cryptographically verifies incoming Paddle webhook deliveries with @paddle/paddle-node-sdk
 * and routes verified events to typed, idempotent event handlers.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Signature must be verified with Paddle SDK before anything else:
 *    paddle.webhooks.unmarshal(rawBody, secret, signature)
 * 2. Raw request body must be read as text (await request.text()). Do NOT JSON.parse first.
 * 3. Uses notification SIGNING SECRET (PADDLE_WEBHOOK_SECRET), not API key.
 * 4. Fails with non-2xx (HTTP 401) on verification failure so Paddle retries.
 * 5. All handlers are idempotent (upserts keyed on Paddle IDs: sub_..., ctm_..., txn_...).
 * 6. Handles subscription.created/updated/canceled, customer.created/updated, transaction.completed.
 *    Safely ignores other types with HTTP 200.
 */

import { getPaddleNodeClient, getPaddleWebhookSecret } from '../../../../lib/paddle-node.js';
import { validatePaddleWebhookIp } from '../../../../lib/paddle-ip-validator.js';
import { upsertCustomer, upsertSubscription } from '../../../../lib/db-service.js';
import { getDb } from '../../../../lib/supabase.js';
import { generateLicenseKey } from '../../../../lib/license-generator.js';
import { sendLicenseEmail } from '../../../../lib/email.js';
import { resolvePlanFromEvent, calculateExpirationDate, PLANS } from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  // 0. Dynamic IP Allowlist Check (authoritative CIDRs from https://api.paddle.com/ips)
  const paddleEnv = (process.env.PADDLE_ENV || 'sandbox').toLowerCase();
  const ipCheck = await validatePaddleWebhookIp(request, paddleEnv);
  if (!ipCheck.allowed) {
    console.warn(`[PADDLE WEBHOOK] IP delivery rejected: ${ipCheck.clientIp} (${ipCheck.reason})`);
    return jsonResponse(
      { error: 'Forbidden: Request IP is not in Paddle authoritative allowlist.' },
      403,
      request
    );
  }

  let rawBody = '';
  let signatureHeader = '';

  try {
    // 1. Read raw body as text — NEVER JSON.parse before verification
    rawBody = await request.text();
    signatureHeader =
      request.headers.get('Paddle-Signature') ||
      request.headers.get('paddle-signature') ||
      '';

    if (!signatureHeader) {
      console.warn('[PADDLE WEBHOOK] Missing Paddle-Signature header.');
      return jsonResponse({ error: 'Missing Paddle-Signature header.' }, 401, request);
    }
  } catch (readErr) {
    return jsonResponse({ error: 'Failed to read request body.' }, 400, request);
  }

  // 2. Cryptographic signature check via Paddle Node SDK
  let event;
  try {
    const paddle = getPaddleNodeClient();
    const webhookSecret = getPaddleWebhookSecret();

    // In Node SDK: paddle.webhooks.unmarshal(rawBody, secret, signature)
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signatureHeader);
  } catch (verifyErr) {
    console.error('[PADDLE WEBHOOK] Signature verification failed:', verifyErr.message);
    // CRITICAL: Return non-2xx (401) so Paddle knows delivery failed and retries
    return jsonResponse(
      { error: 'Unauthorized: Webhook signature verification failed.' },
      401,
      request
    );
  }

  // 3. Extract typed event metadata
  const eventType = event.eventType || event.event_type;
  const eventId = event.eventId || event.event_id;
  const data = event.data || {};

  console.log(`[PADDLE WEBHOOK] Verified event: ${eventType} (ID: ${eventId || 'unknown'})`);

  const db = getDb();

  // 4. Record event idempotency
  if (eventId) {
    try {
      const { data: existingEvent } = await db
        .from('webhook_events')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (existingEvent && existingEvent.status === 'completed') {
        console.log(`[PADDLE WEBHOOK] Idempotency: Event ${eventId} already processed.`);
        return jsonResponse(
          { success: true, message: 'Event already processed (idempotent).', eventId },
          200,
          request
        );
      }

      if (!existingEvent) {
        await db.from('webhook_events').insert({
          event_id: eventId,
          event_type: eventType,
          status: 'processing',
          processed_at: new Date().toISOString()
        });
      }
    } catch (idempErr) {
      console.warn('[PADDLE WEBHOOK] webhook_events table notice:', idempErr.message);
    }
  }

  try {
    // 5. Route to typed event handlers
    switch (eventType) {
      // -----------------------------------------------------------------------
      // Customer Events
      // -----------------------------------------------------------------------
      case 'customer.created':
      case 'customer.updated': {
        await handleCustomerEvent(data);
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription Created / Updated Events
      // -----------------------------------------------------------------------
      case 'subscription.created':
      case 'subscription.updated': {
        await handleSubscriptionCreatedOrUpdated(data, eventType);
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription Canceled Event
      // -----------------------------------------------------------------------
      case 'subscription.canceled': {
        await handleSubscriptionCanceled(data);
        break;
      }

      // -----------------------------------------------------------------------
      // Transaction Completed Event
      // -----------------------------------------------------------------------
      case 'transaction.completed':
      case 'transaction.paid': {
        await handleTransactionCompleted(data, eventId);
        break;
      }

      // -----------------------------------------------------------------------
      // Other events safely acknowledged and ignored
      // -----------------------------------------------------------------------
      default: {
        console.log(`[PADDLE WEBHOOK] Event type "${eventType}" acknowledged and safely ignored.`);
        break;
      }
    }

    // Mark event completed
    if (eventId) {
      try {
        await db
          .from('webhook_events')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('event_id', eventId);
      } catch {}
    }

    return jsonResponse(
      {
        success: true,
        eventType,
        eventId,
        message: 'Event processed successfully.'
      },
      200,
      request
    );
  } catch (handlerErr) {
    console.error(`[PADDLE WEBHOOK] Error processing event ${eventType}:`, handlerErr);
    // Non-2xx causes Paddle to retry at-least-once deliveries
    return jsonResponse(
      { error: `Internal error processing event: ${handlerErr.message}` },
      500,
      request
    );
  }
}

/**
 * Handles customer.created and customer.updated events.
 * Idempotently upserts customer record into public.customers.
 */
async function handleCustomerEvent(data) {
  const customerId = data.id || data.customerId;
  const email = data.email;

  if (!customerId || !email) {
    console.warn('[PADDLE WEBHOOK] Customer event missing id or email:', data);
    return;
  }

  await upsertCustomer({ customerId, email });
  console.log(`[PADDLE WEBHOOK] Customer mirrored: ${customerId} (${email})`);
}

/**
 * Handles subscription.created and subscription.updated events.
 * Idempotently mirrors subscription state and extracts scheduled changes.
 */
async function handleSubscriptionCreatedOrUpdated(data, eventType) {
  const subscriptionId = data.id || data.subscriptionId;
  const customerId = data.customerId || data.customer_id;
  const status = (data.status || 'active').toLowerCase().trim();

  // Extract price ID & product ID from items
  const items = data.items || [];
  const firstItem = items[0] || {};
  const priceId = firstItem.price?.id || firstItem.priceId || firstItem.price_id || '';
  const productId =
    firstItem.price?.productId ||
    firstItem.price?.product_id ||
    firstItem.productId ||
    firstItem.product_id ||
    '';

  // Extract scheduled changes if present
  const scheduledChange = data.scheduledChange || data.scheduled_change;
  const scheduledChangeAction = scheduledChange?.action || null;
  const scheduledChangeAt = scheduledChange?.effectiveAt || scheduledChange?.effective_at || null;

  // 1. Mirror state into subscriptions table
  if (subscriptionId && customerId) {
    await upsertSubscription({
      subscriptionId,
      customerId,
      status,
      priceId,
      productId,
      scheduledChangeAction,
      scheduledChangeAt
    });

    console.log(
      `[PADDLE WEBHOOK] Subscription mirrored: ${subscriptionId} (Status: ${status}${
        scheduledChangeAction ? `, Scheduled ${scheduledChangeAction} at ${scheduledChangeAt}` : ''
      })`
    );
  }

  // 2. Synchronize associated license expiration date if renewed
  if (eventType === 'subscription.updated' && status === 'active') {
    const db = getDb();
    try {
      const { data: purchases } = await db
        .from('purchases')
        .select('*')
        .eq('paddle_subscription_id', subscriptionId);

      if (purchases && purchases.length > 0) {
        for (const purchase of purchases) {
          if (purchase.license_id) {
            const plan = purchase.plan || '30day';
            const newExpiry = calculateExpirationDate(plan);
            await db
              .from('licenses')
              .update({
                status: 'active',
                expires_at: newExpiry,
                updated_at: new Date().toISOString()
              })
              .eq('id', purchase.license_id);

            console.log(`[PADDLE WEBHOOK] License ${purchase.license_id} renewed until ${newExpiry}.`);
          }
        }
      }
    } catch (licErr) {
      console.warn('[PADDLE WEBHOOK] License update notice:', licErr.message);
    }
  }
}

/**
 * Handles subscription.canceled event.
 * Idempotently updates subscription status to 'canceled' in database.
 */
async function handleSubscriptionCanceled(data) {
  const subscriptionId = data.id || data.subscriptionId;
  const customerId = data.customerId || data.customer_id;

  const items = data.items || [];
  const firstItem = items[0] || {};
  const priceId = firstItem.price?.id || firstItem.priceId || firstItem.price_id || '';
  const productId =
    firstItem.price?.productId ||
    firstItem.price?.product_id ||
    firstItem.productId ||
    firstItem.product_id ||
    '';

  // 1. Mirror canceled status into subscriptions table
  if (subscriptionId && customerId) {
    await upsertSubscription({
      subscriptionId,
      customerId,
      status: 'canceled',
      priceId,
      productId,
      scheduledChangeAction: null,
      scheduledChangeAt: null
    });
    console.log(`[PADDLE WEBHOOK] Subscription canceled in DB: ${subscriptionId}`);
  }

  // 2. Update purchases and expire licenses
  const db = getDb();
  try {
    const { data: purchases } = await db
      .from('purchases')
      .select('*')
      .eq('paddle_subscription_id', subscriptionId);

    if (purchases && purchases.length > 0) {
      for (const purchase of purchases) {
        await db
          .from('purchases')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', purchase.id);

        if (purchase.license_id) {
          await db
            .from('licenses')
            .update({
              status: 'expired',
              notes: `Subscription canceled (${subscriptionId})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', purchase.license_id);

          console.log(`[PADDLE WEBHOOK] License ${purchase.license_id} marked expired.`);
        }
      }
    }
  } catch (err) {
    console.warn('[PADDLE WEBHOOK] Purchases/license cancellation notice:', err.message);
  }
}

/**
 * Handles transaction.completed event.
 * Idempotently records customer, purchase, subscription and grants digital license.
 */
async function handleTransactionCompleted(data, eventId) {
  const transactionId = data.id || data.transactionId;
  if (!transactionId) {
    throw new Error('Missing transactionId in transaction.completed event.');
  }

  const db = getDb();

  // 1. Check transaction-level idempotency
  const { data: existingPurchases } = await db
    .from('purchases')
    .select('*')
    .eq('paddle_transaction_id', transactionId);

  if (existingPurchases && existingPurchases.length > 0) {
    console.log(`[PADDLE WEBHOOK] Idempotency: Transaction ${transactionId} already recorded.`);
    return;
  }

  // Extract customer and pricing info
  const customerId = data.customerId || data.customer_id || data.customer?.id || null;
  const customerEmail = (
    data.customer?.email ||
    data.customer_details?.email ||
    data.customData?.email ||
    data.custom_data?.email ||
    'customer@autoreels.local'
  ).trim().toLowerCase();

  const subscriptionId = data.subscriptionId || data.subscription_id || null;

  // Mirror customer if present
  if (customerId && customerEmail) {
    await upsertCustomer({ customerId, email: customerEmail });
  }

  // Determine line item and price
  const firstItem = data.items?.[0] || data.details?.lineItems?.[0] || data.details?.line_items?.[0] || {};
  const priceId = firstItem.price?.id || firstItem.priceId || firstItem.price_id || null;
  const productId =
    firstItem.price?.productId ||
    firstItem.price?.product_id ||
    firstItem.productId ||
    firstItem.product_id ||
    null;

  // Mirror subscription if this is a recurring purchase
  if (subscriptionId && customerId) {
    await upsertSubscription({
      subscriptionId,
      customerId,
      status: 'active',
      priceId: priceId || '',
      productId: productId || ''
    });
  }

  // Resolve plan authoritatively
  const { data: dbProducts } = await db.from('products').select('*');
  const resolvedPlan = resolvePlanFromEvent(priceId, data.customData || data.custom_data || {}, dbProducts || []) || 'starter';
  const planConfig = PLANS[resolvedPlan] || PLANS['starter'];
  const expiresAt = calculateExpirationDate(resolvedPlan);
  const maxDevices = planConfig.maxDevices || 1;

  // Generate unique license key
  const licenseKey = generateLicenseKey('ARS');

  const newLicense = {
    license_key: licenseKey,
    email: customerEmail,
    plan: resolvedPlan,
    status: 'active',
    expires_at: expiresAt,
    max_devices: maxDevices,
    paddle_transaction_id: transactionId,
    paddle_customer_id: customerId,
    paddle_subscription_id: subscriptionId,
    notes: `Paddle transaction (${customerEmail}) TrxID: ${transactionId}`
  };

  const { data: insertedLicense, error: licErr } = await db
    .from('licenses')
    .insert(newLicense)
    .select();

  if (licErr) {
    console.error('[PADDLE WEBHOOK] Error inserting license:', licErr.message);
  }

  const createdLicense = insertedLicense && insertedLicense[0] ? insertedLicense[0] : newLicense;

  // Record purchase
  const totalAmount =
    data.details?.totals?.total ||
    data.details?.totals?.grandTotal ||
    planConfig.priceUsd;
  const currency = data.currencyCode || data.currency_code || 'USD';

  await db.from('purchases').insert({
    paddle_transaction_id: transactionId,
    paddle_customer_id: customerId,
    paddle_subscription_id: subscriptionId,
    customer_email: customerEmail,
    plan: resolvedPlan,
    amount: parseFloat(totalAmount) || planConfig.priceUsd,
    currency,
    status: 'completed',
    purchased_at: data.billedAt || data.billed_at || new Date().toISOString(),
    license_id: createdLicense.id || null,
    metadata: {
      event_id: eventId,
      price_id: priceId,
      product_id: productId
    }
  });

  // Send confirmation email asynchronously
  sendLicenseEmail({
    to: customerEmail,
    licenseKey,
    planName: planConfig.title,
    expiresAt,
    deviceLimit: maxDevices,
    transactionId
  }).catch((err) => {
    console.error('[PADDLE WEBHOOK] Email sending error:', err.message);
  });

  console.log(`[PADDLE WEBHOOK] Transaction completed & provisioned: ${transactionId} for ${customerEmail}`);
}
