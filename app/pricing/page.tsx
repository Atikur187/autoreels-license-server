import React from 'react';
import nextDynamic from 'next/dynamic';
import { headers, cookies } from 'next/headers';
import { TIERS } from '../../lib/tiers';
import './pricing.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing Plans & Licensing — AutoReels Scroll',
  description: 'Choose from Starter, Pro, and Advanced tiers for hands-free video scrolling. Localized pricing with Paddle Checkout.'
};

// Client-only dynamic component to completely prevent @paddle/paddle-js SSR crashes
const PricingTable = nextDynamic(() => import('./PricingTable'), {
  ssr: false,
  loading: () => (
    <div className="pricing-wrapper" style={{ minHeight: '100vh' }}>
      <div className="pricing-glow-bg" />
      <div className="pricing-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="pricing-badge-wrapper">
          <span className="pricing-tag">Pricing Plans & Licensing</span>
        </div>
        <h1 className="pricing-title">Automate your reels hands-free</h1>
        <p className="pricing-subtitle" style={{ margin: '1rem auto 3rem' }}>
          Loading plans &amp; pricing...
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      </div>
    </div>
  )
});

const DEFAULT_SANDBOX_CLIENT_TOKEN = 'test_22abe763cbc6f5b7f432db48a97';

export default function PricingPage() {
  // 1. Resolve Paddle environment safely with fallback
  const rawEnv = (
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ||
    process.env.PADDLE_ENVIRONMENT ||
    process.env.PADDLE_ENV ||
    'sandbox'
  ).toLowerCase().trim();

  const environment: 'sandbox' | 'production' =
    rawEnv === 'production' || rawEnv === 'live' ? 'production' : 'sandbox';

  // 2. Resolve client token safely with sandbox fallback
  let clientToken = (
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
    process.env.PADDLE_CLIENT_TOKEN ||
    ''
  ).trim();

  if (!clientToken) {
    if (environment === 'sandbox') {
      clientToken = DEFAULT_SANDBOX_CLIENT_TOKEN;
    } else {
      clientToken = 'live_placeholder_token';
    }
  }

  // 3. Detect the user's country safely from request headers
  let initialCountry: string | null = null;
  try {
    const headersList = headers();
    const countryHeader =
      headersList.get('x-vercel-ip-country') ||
      headersList.get('cf-ipcountry') ||
      headersList.get('x-country-code');

    if (countryHeader && /^[A-Z]{2}$/i.test(countryHeader.trim())) {
      const code = countryHeader.trim().toUpperCase();
      if (code !== 'XX' && code !== 'T1' && code !== 'ZZ') {
        initialCountry = code;
      }
    }
  } catch (err) {
    console.warn('[PricingPage] Error reading headers:', err);
  }

  // 4. Resolve customer cookies safely
  let customerEmail: string | null = null;
  let paddleCustomerId: string | null = null;
  try {
    const cookieStore = cookies();
    customerEmail =
      cookieStore.get('customer_email')?.value ||
      cookieStore.get('user_email')?.value ||
      null;
    paddleCustomerId =
      cookieStore.get('paddle_customer_id')?.value ||
      null;
  } catch (err) {
    console.warn('[PricingPage] Error reading cookies:', err);
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
