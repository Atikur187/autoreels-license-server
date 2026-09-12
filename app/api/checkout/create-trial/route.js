/**
 * AutoReels Scroll - 7-Day Free Trial License Creation API
 * Route: POST /api/checkout/create-trial
 * 
 * Generates an instant, zero-friction 7-day trial license without requiring payment.
 * Implements clean, non-invasive abuse protection (1 trial per email address + rate limiting).
 */

import { getDb } from '../../../../lib/supabase.js';
import { generateLicenseKey } from '../../../../lib/license-generator.js';
import { calculateExpirationDate } from '../../../../lib/paddle.js';
import { handleOptions, jsonResponse } from '../../../../lib/cors.js';
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rate-limit.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    // 1. Client rate limiting (max 10 trial requests per hour per client IP)
    const clientIp = getClientIdentifier(request);
    const rate = checkRateLimit(`trial-${clientIp}`, 10, 3600000);
    if (!rate.allowed) {
      return jsonResponse(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: `Too many trial requests. Please retry in ${rate.retryAfter}s.`
        },
        429,
        request
      );
    }

    // 2. Parse payload
    const body = await request.json().catch(() => ({}));
    const rawEmail = body?.email || '';

    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@') || rawEmail.trim().length < 5) {
      return jsonResponse(
        {
          success: false,
          code: 'EMAIL_REQUIRED',
          error: 'A valid email address is required to activate your 7-Day Free Trial.'
        },
        400,
        request
      );
    }

    const cleanEmail = rawEmail.trim().toLowerCase();
    const db = getDb();

    // 3. Abuse Protection: Check if this email has already claimed a 7-day free trial
    const { data: existingCustomer } = await db
      .from('customers')
      .select('*')
      .eq('email', cleanEmail);

    if (existingCustomer && existingCustomer.length > 0 && existingCustomer[0].has_trial_claimed) {
      return jsonResponse(
        {
          success: false,
          code: 'TRIAL_ALREADY_CLAIMED',
          error: 'A 7-Day Free Trial has already been claimed for this email. Please select a pass to continue.'
        },
        400,
        request
      );
    }

    // Double-check purchases table for existing 7day trial on this email
    const { data: existingPurchases } = await db
      .from('purchases')
      .select('*')
      .eq('customer_email', cleanEmail)
      .eq('plan', '7day');

    if (existingPurchases && existingPurchases.length > 0) {
      return jsonResponse(
        {
          success: false,
          code: 'TRIAL_ALREADY_CLAIMED',
          error: 'A 7-Day Free Trial has already been claimed for this email. Please select a pass to continue.'
        },
        400,
        request
      );
    }

    // 4. Retrieve Product ID for 7day plan
    const { data: prods } = await db.from('products').select('*').eq('plan', '7day');
    const productId = prods && prods.length > 0 ? prods[0].id : null;

    // 5. Generate secure cryptographic license key
    const licenseKey = generateLicenseKey('ARS');
    const expiresAt = calculateExpirationDate('7day');
    const maxDevices = 1;

    const newLicense = {
      license_key: licenseKey,
      product_id: productId,
      plan: '7day',
      status: 'active',
      expires_at: expiresAt,
      max_devices: maxDevices,
      notes: `7-Day Free Trial (${cleanEmail})`
    };

    const { data: inserted, error: insertErr } = await db.from('licenses').insert(newLicense);

    if (insertErr) {
      console.error('[Create Trial] Database error:', insertErr);
      return jsonResponse({ success: false, error: 'Failed to create trial license.' }, 500, request);
    }

    const created = inserted && inserted[0] ? inserted[0] : newLicense;

    // 6. Record trial in customers table to prevent repeat abuse
    await db.from('customers').insert({
      email: cleanEmail,
      has_trial_claimed: true,
      trial_license_id: created.id || null
    });

    // 7. Record $0 purchase entry
    await db.from('purchases').insert({
      paddle_transaction_id: `trial_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      customer_email: cleanEmail,
      product_id: productId,
      plan: '7day',
      amount: 0.00,
      currency: 'USD',
      status: 'completed',
      license_id: created.id || null,
      purchased_at: new Date().toISOString()
    });

    return jsonResponse(
      {
        success: true,
        licenseKey,
        plan: '7day',
        expiresAt,
        maxDevices,
        message: 'Your 7-day free trial is ready! Enjoy full premium auto-scrolling.'
      },
      201,
      request
    );
  } catch (err) {
    console.error('[Create Trial] Server error:', err);
    return jsonResponse({ success: false, error: 'Internal server error.' }, 500, request);
  }
}
