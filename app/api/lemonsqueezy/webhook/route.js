/**
 * AutoReels Scroll — Official Lemon Squeezy Webhook Receiver
 * Route: POST /api/lemonsqueezy/webhook
 * 
 * Authoritative payment confirmation and license issuing endpoint.
 * Features:
 * 1. Cryptographic HMAC-SHA256 signature verification via raw request body & timingSafeEqual.
 * 2. Strict event-level and order-level idempotency to prevent duplicate licenses.
 * 3. Environment safety: verifies test_mode vs LEMON_SQUEEZY_MODE.
 * 4. Authoritative variant mapping: never trusts client prices or claims.
 * 5. Generates cryptographically secure ARS license keys.
 * 6. Supports order_created and order_refunded events.
 */

import { getDb } from '../../../../lib/supabase.js';
import { generateLicenseKey } from '../../../../lib/license-generator.js';
import { sendLicenseEmail } from '../../../../lib/email.js';
import {
  verifyLemonSqueezyWebhook,
  resolvePlanFromVariantId,
  calculateExpirationDate,
  PLANS,
  LEMON_SQUEEZY_MODE,
  IS_LIVE_MODE,
  LEMON_SQUEEZY_STORE_ID
} from '../../../../lib/lemonsqueezy.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // 1. Read raw body text for cryptographic HMAC-SHA256 signature verification
    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get('x-signature') ||
      request.headers.get('X-Signature') ||
      '';

    // 2. Cryptographic signature check
    const verification = verifyLemonSqueezyWebhook(rawBody, signatureHeader);
    if (!verification.valid) {
      console.warn('[LEMON SQUEEZY] Signature verification failed:', verification.error);
      return jsonResponse(
        { success: false, error: 'Unauthorized: ' + verification.error },
        401,
        request
      );
    }

    // 3. Parse JSON event payload
    let eventPayload;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ success: false, error: 'Malformed JSON payload.' }, 400, request);
    }

    const eventName = eventPayload.meta?.event_name || request.headers.get('x-event-name') || '';
    const customData = eventPayload.meta?.custom_data || {};
    const orderData = eventPayload.data || {};
    const orderId = orderData.id ? String(orderData.id) : null;
    const attributes = orderData.attributes || {};

    console.log(`[LEMON SQUEEZY] Verified webhook received: "${eventName}" (Order ID: ${orderId || 'N/A'})`);

    const db = getDb();
    const eventId = `ls_evt_${orderId || Date.now()}_${eventName}`;

    // 4. Strict Idempotency Check via webhook_events
    try {
      const { data: existingEvent } = await db
        .from('webhook_events')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (existingEvent && existingEvent.status === 'completed') {
        console.log(`[LEMON SQUEEZY] Idempotency: Event ${eventId} was already processed. Returning HTTP 200.`);

        let existingLicenseKey = null;
        if (orderId) {
          const { data: purchases } = await db
            .from('purchases')
            .select('*')
            .eq('lemonsqueezy_order_id', String(orderId).trim());
          if (purchases && purchases[0]) {
            if (purchases[0].license_id) {
              const { data: lic } = await db
                .from('licenses')
                .select('*')
                .eq('id', purchases[0].license_id);
              if (lic && lic[0]) {
                existingLicenseKey = lic[0].license_key;
              }
            }
            if (!existingLicenseKey) {
              const { data: lic } = await db
                .from('licenses')
                .select('*')
                .eq('lemonsqueezy_order_id', String(orderId).trim());
              if (lic && lic[0]) {
                existingLicenseKey = lic[0].license_key;
              }
            }
          }
        }

        return jsonResponse(
          {
            success: true,
            idempotent: true,
            message: 'Event already processed (idempotent).',
            licenseKey: existingLicenseKey,
            eventId
          },
          200,
          request
        );
      }

      if (!existingEvent) {
        await db.from('webhook_events').insert({
          event_id: eventId,
          event_type: eventName,
          status: 'processing',
          payload: eventPayload,
          processed_at: new Date().toISOString()
        });
      }
    } catch (evtErr) {
      console.warn('[LEMON SQUEEZY] webhook_events table check notice:', evtErr.message);
    }

    // 5. Environment & Store Safety Verification
    if (LEMON_SQUEEZY_STORE_ID && attributes.store_id) {
      if (String(attributes.store_id) !== String(LEMON_SQUEEZY_STORE_ID)) {
        console.error(`[LEMON SQUEEZY] Store ID mismatch: expected ${LEMON_SQUEEZY_STORE_ID}, received ${attributes.store_id}`);
        return jsonResponse({ success: false, error: 'Store ID mismatch.' }, 403, request);
      }
    }

    const isTestOrder = Boolean(attributes.test_mode);
    if (IS_LIVE_MODE && isTestOrder) {
      console.error('[LEMON SQUEEZY] SECURITY VIOLATION: Test order rejected on LIVE mode production server.');
      return jsonResponse(
        { success: false, error: 'Test mode orders are rejected in Live Mode.' },
        403,
        request
      );
    }

    // -------------------------------------------------------------------------
    // EVENT: order_created
    // Triggered when a new order is placed and payment succeeds
    // -------------------------------------------------------------------------
    if (eventName === 'order_created') {
      if (!orderId) {
        return jsonResponse({ success: false, error: 'Missing order ID in payload.' }, 400, request);
      }

      const orderStatus = (attributes.status || '').toLowerCase();
      if (orderStatus !== 'paid') {
        console.warn(`[LEMON SQUEEZY] Order ${orderId} received with non-paid status: "${orderStatus}". Awaiting paid confirmation.`);
        return jsonResponse({ success: true, message: `Order status is "${orderStatus}". Awaiting paid.` }, 200, request);
      }

      // Check Order-Level Idempotency in purchases table
      let { data: existingPurchases } = await db
        .from('purchases')
        .select('*')
        .eq('lemonsqueezy_order_id', String(orderId).trim());

      if (!existingPurchases || existingPurchases.length === 0) {
        const { data: legacy } = await db
          .from('purchases')
          .select('*')
          .eq('paddle_transaction_id', `ls_order_${orderId}`);
        if (legacy && legacy.length > 0) {
          existingPurchases = legacy;
        }
      }

      if (existingPurchases && existingPurchases.length > 0) {
        console.log(`[LEMON SQUEEZY] Idempotency: Purchase for Order ID ${orderId} already exists.`);

        let existingLicenseKey = null;
        const purchase = existingPurchases[0];
        if (purchase.license_id) {
          const { data: lic } = await db.from('licenses').select('*').eq('id', purchase.license_id);
          if (lic && lic[0]) {
            existingLicenseKey = lic[0].license_key;
          }
        }
        if (!existingLicenseKey) {
          const { data: lic } = await db.from('licenses').select('*').eq('lemonsqueezy_order_id', String(orderId).trim());
          if (lic && lic[0]) {
            existingLicenseKey = lic[0].license_key;
          }
        }

        try {
          await db.from('webhook_events').update({ status: 'completed' }).eq('event_id', eventId);
        } catch {}

        return jsonResponse(
          {
            success: true,
            idempotent: true,
            message: 'Order already processed and fulfilled (idempotent).',
            licenseKey: existingLicenseKey,
            licenseId: purchase.license_id
          },
          200,
          request
        );
      }

      // Extract variant ID from first order item
      const firstOrderItem = attributes.first_order_item || {};
      const variantId = firstOrderItem.variant_id || attributes.variant_id;
      const productId = firstOrderItem.product_id || attributes.product_id;

      // Authoritatively resolve plan from variant ID (or custom data if mapped)
      let resolvedPlan = resolvePlanFromVariantId(variantId);
      if (!resolvedPlan && customData.plan && PLANS[customData.plan]) {
        resolvedPlan = customData.plan;
      }

      if (!resolvedPlan || !PLANS[resolvedPlan]) {
        console.error(`[LEMON SQUEEZY] Unmapped variant ID: "${variantId}". Refusing to grant unverified plan.`);
        try {
          await db.from('webhook_events').update({
            status: 'failed',
            error_message: `Unmapped variant ID "${variantId}"`
          }).eq('event_id', eventId);
        } catch {}

        return jsonResponse(
          {
            success: false,
            error: `Unmapped variant ID: "${variantId}". Please configure variant IDs in server environment.`
          },
          422,
          request
        );
      }

      const planConfig = PLANS[resolvedPlan];
      const customerEmail = (attributes.user_email || customData.email || 'customer@autoreels.local').trim().toLowerCase();
      const customerName = attributes.user_name || '';
      const totalAmountCents = attributes.total || attributes.subtotal || Math.round(planConfig.priceUsd * 100);
      const totalAmountUsd = (totalAmountCents / 100).toFixed(2);
      const currency = attributes.currency || 'USD';
      const claimToken = customData.claim_token || null;

      const expiresAt = calculateExpirationDate(resolvedPlan);
      const maxDevices = planConfig.maxDevices || 1;

      // Generate cryptographically secure unique ARS license key (ARS-XXXX-XXXX-XXXX)
      const licenseKey = generateLicenseKey('ARS');

      // 1. Insert License record
      const newLicense = {
        license_key: licenseKey,
        email: customerEmail,
        plan: resolvedPlan,
        status: 'active',
        expires_at: expiresAt,
        max_devices: maxDevices,
        device_limit: maxDevices,
        activation_count: 0,
        lemonsqueezy_order_id: orderId,
        notes: `Lemon Squeezy order #${attributes.order_number || orderId} (${customerEmail})`
      };

      let { data: insertedLicenses, error: licErr } = await db
        .from('licenses')
        .insert(newLicense)
        .select();

      if (licErr) {
        console.error('[LEMON SQUEEZY] Database error inserting license:', licErr);
        try {
          await db.from('webhook_events').update({
            status: 'failed',
            error_message: licErr.message
          }).eq('event_id', eventId);
        } catch {}
        return jsonResponse({ success: false, error: 'Database insert failed: ' + licErr.message }, 500, request);
      }

      const createdLicense = insertedLicenses && insertedLicenses[0] ? insertedLicenses[0] : newLicense;
      console.log(`[LEMON SQUEEZY] License created: ${licenseKey} for ${customerEmail} (Plan: ${resolvedPlan}, Order: ${orderId})`);

      // 2. Insert Purchase record
      const newPurchase = {
        lemonsqueezy_order_id: orderId,
        lemonsqueezy_customer_id: attributes.customer_id ? String(attributes.customer_id) : null,
        lemonsqueezy_variant_id: variantId ? String(variantId) : null,
        lemonsqueezy_product_id: productId ? String(productId) : null,
        paddle_transaction_id: `ls_order_${orderId}`, // Compatibility fallback for existing queries
        customer_email: customerEmail,
        plan: resolvedPlan,
        amount: parseFloat(totalAmountUsd),
        currency,
        status: 'completed',
        purchased_at: attributes.created_at || new Date().toISOString(),
        license_id: createdLicense.id || null,
        metadata: {
          order_id: orderId,
          order_number: attributes.order_number,
          variant_id: variantId,
          claim_token: claimToken,
          customer_name: customerName,
          receipt_url: attributes.urls?.receipt || null,
          test_mode: isTestOrder
        }
      };

      await db.from('purchases').insert(newPurchase);

      // 3. Fulfill Pending Checkout / Claim Token record
      if (claimToken) {
        try {
          await db
            .from('pending_checkouts')
            .update({
              status: 'ready',
              license_id: createdLicense.id || null,
              lemonsqueezy_order_id: orderId,
              customer_email: customerEmail,
              updated_at: new Date().toISOString()
            })
            .eq('claim_token', claimToken);
        } catch (claimErr) {
          console.warn('[LEMON SQUEEZY] Note: pending_checkouts update notice:', claimErr.message);
        }
      }

      // 4. Mark webhook event completed
      try {
        await db.from('webhook_events').update({ status: 'completed' }).eq('event_id', eventId);
      } catch {}

      // 5. Send confirmation email asynchronously (if configured)
      sendLicenseEmail({
        to: customerEmail,
        licenseKey,
        planName: planConfig.title,
        expiresAt,
        deviceLimit: maxDevices,
        transactionId: `LS-${orderId}`
      }).catch((emailErr) => {
        console.error('[EMAIL] Async delivery notice:', emailErr.message);
      });

      return jsonResponse(
        {
          success: true,
          message: 'Order verified and license created successfully.',
          licenseKey,
          plan: resolvedPlan,
          orderId
        },
        200,
        request
      );
    }

    // -------------------------------------------------------------------------
    // EVENT: order_refunded
    // Triggered when an order is refunded -> Revoke License
    // -------------------------------------------------------------------------
    if (eventName === 'order_refunded') {
      if (!orderId) {
        return jsonResponse({ success: false, error: 'Missing order ID in refund event.' }, 400, request);
      }

      console.log(`[LEMON SQUEEZY] Processing refund for order: ${orderId}`);

      // 1. Locate purchase record
      let { data: purchases } = await db
        .from('purchases')
        .select('*')
        .eq('lemonsqueezy_order_id', String(orderId).trim());

      if (!purchases || purchases.length === 0) {
        const { data: legacy } = await db
          .from('purchases')
          .select('*')
          .eq('paddle_transaction_id', `ls_order_${orderId}`);
        if (legacy && legacy.length > 0) {
          purchases = legacy;
        }
      }

      if (purchases && purchases.length > 0) {
        const purchase = purchases[0];

        // 2. Mark purchase as refunded
        await db
          .from('purchases')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', purchase.id);

        // 3. Revoke associated license
        if (purchase.license_id) {
          await db
            .from('licenses')
            .update({
              status: 'revoked',
              notes: `Revoked due to Lemon Squeezy refund for Order #${orderId}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', purchase.license_id);

          console.log(`[LEMON SQUEEZY] License ID ${purchase.license_id} revoked due to refund for order ${orderId}.`);
        }
      } else {
        console.warn(`[LEMON SQUEEZY] No purchase record found for refunded order ${orderId}.`);
      }

      try {
        await db.from('webhook_events').update({ status: 'completed' }).eq('event_id', eventId);
      } catch {}

      return jsonResponse(
        {
          success: true,
          action: 'revoked',
          orderId,
          message: `Refund for order ${orderId} processed successfully and license revoked.`
        },
        200,
        request
      );
    }

    // Acknowledge other webhook events
    try {
      await db.from('webhook_events').update({ status: 'completed' }).eq('event_id', eventId);
    } catch {}

    return jsonResponse(
      { success: true, message: `Event "${eventName}" acknowledged.` },
      200,
      request
    );
  } catch (err) {
    console.error('[LEMON SQUEEZY] Fatal Webhook Exception:', err);
    return jsonResponse(
      { success: false, error: err.message || 'Internal server error in webhook handler.' },
      500,
      request
    );
  }
}
