/**
 * AutoReels Scroll - Official Paddle Billing Webhook Receiver
 * Route: POST /api/paddle/webhook
 * 
 * Cryptographically verifies Paddle webhook signatures and acts as the
 * authoritative source of truth for payment confirmations, renewals, and refunds.
 */

import { getDb } from '../../../../lib/supabase.js';
import { generateLicenseKey } from '../../../../lib/license-generator.js';
import {
  verifyPaddleWebhook,
  resolvePlanFromEvent,
  calculateExpirationDate,
  PLANS
} from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // 1. Read raw body text for cryptographic signature verification
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('Paddle-Signature') || request.headers.get('paddle-signature') || '';

    // 2. Cryptographic signature check (ts + h1 HMAC-SHA256 with 10-min tolerance)
    const verification = verifyPaddleWebhook(rawBody, signatureHeader);
    if (!verification.valid) {
      console.warn('[Paddle Webhook] Signature verification failed:', verification.error);
      return jsonResponse({ success: false, error: 'Unauthorized: ' + verification.error }, 401, request);
    }

    // 3. Parse JSON event data
    let eventPayload;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400, request);
    }

    const { event_type: eventType, event_id: eventId, data } = eventPayload || {};
    console.log(`[Paddle Webhook] Verified event: ${eventType} (ID: ${eventId || 'unknown'})`);

    const db = getDb();

    // -------------------------------------------------------------------------
    // EVENT: transaction.completed / transaction.paid
    // Customer successfully completed payment in Paddle Checkout
    // -------------------------------------------------------------------------
    if (eventType === 'transaction.completed' || eventType === 'transaction.paid') {
      const transactionId = data?.id;
      if (!transactionId) {
        return jsonResponse({ success: false, error: 'Missing transaction ID in event.' }, 400, request);
      }

      // Check idempotency: If this transaction has already been processed, prevent duplicates
      const { data: existingPurchases } = await db
        .from('purchases')
        .select('*')
        .eq('paddle_transaction_id', transactionId);

      if (existingPurchases && existingPurchases.length > 0) {
        console.log(`[Paddle Webhook] Idempotency notice: Transaction ${transactionId} already processed.`);
        return jsonResponse(
          {
            success: true,
            message: 'Transaction already processed (idempotent).',
            licenseId: existingPurchases[0].license_id
          },
          200,
          request
        );
      }

      // Extract transaction metadata
      const customerEmail =
        data?.customer?.email ||
        data?.customer_details?.email ||
        data?.custom_data?.email ||
        'customer@autoreels.local';

      // Find price ID from transaction line items
      const firstItem = data?.items && data.items[0];
      const priceId = firstItem?.price?.id || firstItem?.price_id || data?.details?.line_items?.[0]?.price_id || null;
      const customData = data?.custom_data || {};

      // Load products from DB for accurate matching
      const { data: dbProducts } = await db.from('products').select('*');

      // Authoritatively resolve plan from verified Paddle Price ID ONLY.
      // NEVER trust client customData or browser strings.
      const resolvedPlan = resolvePlanFromEvent(priceId, customData, dbProducts || []);

      if (!resolvedPlan) {
        console.error(`[Paddle Webhook] Unmapped Paddle Price ID: "${priceId}". Refusing to grant unverified plan.`);
        return jsonResponse(
          {
            success: false,
            error: `Unmapped Paddle Price ID: "${priceId}". Please configure this price in your products table or server environment.`
          },
          422,
          request
        );
      }

      const planConfig = PLANS[resolvedPlan];
      const expiresAt = calculateExpirationDate(resolvedPlan);
      const maxDevices = planConfig.maxDevices || 1;
      const subscriptionId = data?.subscription_id || null;

      // Extract payment details
      const totalAmount =
        data?.details?.totals?.total ||
        data?.details?.totals?.grand_total ||
        planConfig.priceUsd;
      const currency = data?.currency_code || data?.details?.totals?.currency_code || 'USD';

      // Retrieve corresponding product ID from products table
      let productId = null;
      if (priceId && dbProducts) {
        const prod = dbProducts.find((p) => p.paddle_price_id && p.paddle_price_id.trim() === priceId.trim());
        if (prod) productId = prod.id;
      }
      if (!productId && resolvedPlan && dbProducts) {
        const prod = dbProducts.find((p) => p.plan === resolvedPlan);
        if (prod) productId = prod.id;
      }

      const paddleCustomerId = data?.customer_id || data?.customer?.id || null;
      const purchasedAt = data?.billed_at || data?.created_at || new Date().toISOString();

      // 1. Generate cryptographic non-sequential license key (ARS-XXXX-XXXX-XXXX)
      const licenseKey = generateLicenseKey('ARS');

      const newLicense = {
        license_key: licenseKey,
        product_id: productId,
        plan: resolvedPlan,
        status: 'active',
        expires_at: expiresAt,
        max_devices: maxDevices,
        notes: `Paddle checkout (${customerEmail}) TrxID: ${transactionId}${subscriptionId ? ` SubID: ${subscriptionId}` : ''}`
      };

      const { data: insertedLicense, error: licErr } = await db
        .from('licenses')
        .insert(newLicense)
        .select();

      if (licErr) {
        console.error('[Paddle Webhook] Database error inserting license:', licErr);
        return jsonResponse({ success: false, error: 'Database insert failed.' }, 500, request);
      }

      const createdLicense = insertedLicense && insertedLicense[0] ? insertedLicense[0] : newLicense;

      // 2. Record purchase in purchases table
      const newPurchase = {
        paddle_transaction_id: transactionId,
        paddle_customer_id: paddleCustomerId,
        paddle_subscription_id: subscriptionId,
        customer_email: customerEmail.toLowerCase(),
        product_id: productId,
        plan: resolvedPlan,
        amount: parseFloat(totalAmount) || planConfig.priceUsd,
        currency,
        status: 'completed',
        purchased_at: purchasedAt,
        license_id: createdLicense.id || null,
        metadata: {
          event_id: eventId,
          price_id: priceId,
          created_via: 'paddle_webhook'
        }
      };

      await db.from('purchases').insert(newPurchase);

      console.log(`[Paddle Webhook] Issued license ${licenseKey} for ${customerEmail} (Plan: ${resolvedPlan}, TrxID: ${transactionId})`);

      return jsonResponse(
        {
          success: true,
          message: 'Purchase recorded and license activated successfully.',
          licenseKey,
          plan: resolvedPlan
        },
        200,
        request
      );
    }

    // -------------------------------------------------------------------------
    // EVENT: adjustment.updated / adjustment.created / transaction.refunded / payment.refunded
    // Customer was refunded or payment disputed -> Revoke License
    // -------------------------------------------------------------------------
    if (
      eventType === 'adjustment.updated' ||
      eventType === 'adjustment.created' ||
      eventType === 'transaction.refunded' ||
      eventType === 'payment.refunded' ||
      (eventType === 'transaction.updated' && (data?.status === 'refunded' || data?.status === 'chargeback'))
    ) {
      const transactionId = data?.transaction_id || data?.id;

      if (transactionId) {
        const { data: purchases } = await db
          .from('purchases')
          .select('*')
          .eq('paddle_transaction_id', transactionId);

        if (purchases && purchases.length > 0) {
          const purchase = purchases[0];

          // 1. Mark purchase as refunded
          await db
            .from('purchases')
            .update({ status: 'refunded' })
            .eq('id', purchase.id);

          // 2. Revoke associated license
          if (purchase.license_id) {
            await db
              .from('licenses')
              .update({
                status: 'revoked',
                notes: `Revoked due to Paddle refund (${transactionId})`
              })
              .eq('id', purchase.license_id);

            console.log(`[Paddle Webhook] License ID ${purchase.license_id} revoked due to refund for transaction ${transactionId}.`);
          }
        }
      }

      return jsonResponse({ success: true, message: 'Refund processed successfully.' }, 200, request);
    }

    // -------------------------------------------------------------------------
    // EVENT: subscription.canceled / subscription.cancelled
    // Subscription canceled by user or admin
    // -------------------------------------------------------------------------
    if (eventType === 'subscription.canceled' || eventType === 'subscription.cancelled') {
      const subscriptionId = data?.id;

      if (subscriptionId) {
        const { data: purchases } = await db
          .from('purchases')
          .select('*')
          .eq('paddle_subscription_id', subscriptionId);

        if (purchases && purchases.length > 0) {
          for (const p of purchases) {
            await db.from('purchases').update({ status: 'canceled' }).eq('id', p.id);

            // If subscription is canceled immediately, expire the license
            if (data?.effective_from === 'immediately' && p.license_id) {
              await db
                .from('licenses')
                .update({ status: 'expired', notes: 'Subscription terminated immediately.' })
                .eq('id', p.license_id);
            }
          }
        }
      }

      return jsonResponse({ success: true, message: 'Subscription cancellation recorded.' }, 200, request);
    }

    // -------------------------------------------------------------------------
    // EVENT: subscription.updated / subscription.activated (Renewals)
    // Recurring payment succeeded for another billing cycle
    // -------------------------------------------------------------------------
    if (eventType === 'subscription.updated' || eventType === 'subscription.activated') {
      const subscriptionId = data?.id;

      if (subscriptionId) {
        const { data: purchases } = await db
          .from('purchases')
          .select('*')
          .eq('paddle_subscription_id', subscriptionId);

        if (purchases && purchases.length > 0) {
          const purchase = purchases[0];
          if (purchase.license_id) {
            const plan = purchase.plan || '30day';
            const newExpiry = calculateExpirationDate(plan);

            await db
              .from('licenses')
              .update({
                status: 'active',
                expires_at: newExpiry
              })
              .eq('id', purchase.license_id);

            console.log(`[Paddle Webhook] Subscription ${subscriptionId} renewed. License updated with new expiry.`);
          }
        }
      }

      return jsonResponse({ success: true, message: 'Subscription update handled.' }, 200, request);
    }

    // -------------------------------------------------------------------------
    // EVENT: subscription.past_due / subscription.payment_failed
    // Payment failed for a subscription
    // -------------------------------------------------------------------------
    if (eventType === 'subscription.past_due' || eventType === 'subscription.payment_failed') {
      const subscriptionId = data?.id;
      if (subscriptionId) {
        await db
          .from('purchases')
          .update({ status: 'past_due' })
          .eq('paddle_subscription_id', subscriptionId);
      }
      return jsonResponse({ success: true, message: 'Past due status recorded.' }, 200, request);
    }

    // Unhandled event type acknowledged safely
    return jsonResponse(
      { success: true, message: `Event ${eventType} acknowledged.` },
      200,
      request
    );
  } catch (err) {
    console.error('[Paddle Webhook] Fatal error:', err);
    return jsonResponse({ success: false, error: err.message || 'Internal server error.' }, 500, request);
  }
}
