import React from 'react';
import { headers } from 'next/headers';
import PricingTable from './PricingTable';
import { getValidatedPaddleServerConfig } from '../../lib/paddle-config';
import { getCustomer } from '../../lib/db-service';
import { TIERS } from '../../lib/tiers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing & Plans — AutoReels Scroll',
  description: 'Choose your AutoReels Scroll tier: Starter, Pro, or Advanced with instant license activation.'
};

export default async function PricingPage({ searchParams }) {
  // 1. Strictly validate Paddle environment and fail loudly if unset
  const { environment, clientToken } = getValidatedPaddleServerConfig();

  // 2. Server-side Country Detection from trusted headers
  const headerList = headers();
  const rawCountry = (
    headerList.get('x-vercel-ip-country') ||
    headerList.get('cf-ipcountry') ||
    headerList.get('x-country-code') ||
    headerList.get('x-geo-country') ||
    ''
  ).trim().toUpperCase();

  // Strict validation: ISO 3166-1 alpha-2 format
  // If the header is absent or is an unknown sentinel (like 'OTHERS' or 'XX'), do NOT pass a country code
  // Paddle.PricePreview() will automatically fall back to IP-based regional detection.
  const initialCountry = (
    rawCountry.length === 2 &&
    /^[A-Z]{2}$/.test(rawCountry) &&
    rawCountry !== 'XX' &&
    rawCountry !== 'ZZ' &&
    rawCountry !== 'OT' &&
    rawCountry !== 'OTHERS'
  ) ? rawCountry : null;

  // Optional: check for logged-in user email passed via session, header, or searchParams
  const customerEmail = (searchParams && typeof searchParams.email === 'string' && searchParams.email) ||
    headerList.get('x-user-email') ||
    null;

  // 3. Resolve Paddle Customer ID (starts with ctm_...) for Paddle Retain
  let paddleCustomerId = null;
  if (customerEmail) {
    try {
      const customer = await getCustomer(customerEmail);
      if (customer && customer.customer_id && customer.customer_id.startsWith('ctm_')) {
        paddleCustomerId = customer.customer_id;
      }
    } catch (err) {
      console.warn('[Pricing Page] Error resolving customer for Paddle Retain:', err.message);
    }
  }

  return (
    <PricingTable
      initialCountry={initialCountry}
      environment={environment}
      clientToken={clientToken}
      tiers={TIERS}
      customerEmail={customerEmail}
      paddleCustomerId={paddleCustomerId}
    />
  );
}
