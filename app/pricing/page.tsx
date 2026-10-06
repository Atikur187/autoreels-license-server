import React from 'react';
import { headers, cookies } from 'next/headers';
import PricingTable from './PricingTable';
import { TIERS } from '@/lib/tiers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing Plans & Licensing — AutoReels Scroll',
  description: 'Choose from Starter, Pro, and Advanced tiers for hands-free video scrolling. Localized pricing with Paddle Checkout.'
};

export default function PricingPage() {
  // 1. Fail loudly if environment variable is missing (Never silently default)
  const rawEnv = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || process.env.PADDLE_ENVIRONMENT || process.env.PADDLE_ENV;
  if (!rawEnv) {
    throw new Error(
      'PADDLE_ENVIRONMENT is not set! You must set PADDLE_ENVIRONMENT to "sandbox" or "production" in your environment variables. The server will not silently default to an environment to prevent running against the wrong Paddle account.'
    );
  }

  const environment = rawEnv.toLowerCase().trim();
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error(`Invalid PADDLE_ENVIRONMENT: "${rawEnv}". Must be either "sandbox" or "production".`);
  }

  // 2. Client-side token validation
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || process.env.PADDLE_CLIENT_TOKEN;
  if (!clientToken) {
    throw new Error('PADDLE_CLIENT_TOKEN is not set! You must configure your Paddle client-side token in your environment variables.');
  }

  if (environment === 'sandbox' && !clientToken.startsWith('test_')) {
    throw new Error('PADDLE_CLIENT_TOKEN must start with "test_" when running in sandbox environment.');
  }

  if (environment === 'production' && !clientToken.startsWith('live_')) {
    throw new Error('PADDLE_CLIENT_TOKEN must start with "live_" when running in production environment.');
  }

  // 3. Detect the user's country server-side from request headers (e.g. Vercel sets x-vercel-ip-country)
  // If the header is absent, do NOT pass a country code — Paddle.PricePreview() auto-detects location from the visitor's IP.
  // If an internal "unknown" sentinel like 'OTHERS' is used, keep it app-side only; never pass it to Paddle as a country code.
  const headersList = headers();
  const countryHeader = headersList.get('x-vercel-ip-country') || headersList.get('cf-ipcountry') || headersList.get('x-country-code');
  
  let initialCountry: string | null = null;
  if (countryHeader && /^[A-Z]{2}$/i.test(countryHeader.trim())) {
    const code = countryHeader.trim().toUpperCase();
    if (code !== 'XX' && code !== 'T1' && code !== 'ZZ') {
      initialCountry = code;
    }
  }

  // 4. Prefill customer email if signed in
  const cookieStore = cookies();
  const customerEmail = cookieStore.get('customer_email')?.value || cookieStore.get('user_email')?.value || null;
  const paddleCustomerId = cookieStore.get('paddle_customer_id')?.value || null;

  return (
    <PricingTable
      initialCountry={initialCountry}
      environment={environment as 'sandbox' | 'production'}
      clientToken={clientToken}
      tiers={TIERS}
      customerEmail={customerEmail}
      paddleCustomerId={paddleCustomerId}
    />
  );
}
