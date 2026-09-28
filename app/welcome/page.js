'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import '../pricing/pricing.css';

function WelcomeContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier') || 'Subscription';
  const cycle = searchParams.get('cycle') || 'monthly';

  return (
    <div className="pricing-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="pricing-glow-bg" />

      <div className="pricing-container" style={{ maxWidth: '720px', textAlign: 'center' }}>
        {/* Success Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem',
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)',
            fontSize: '2.5rem'
          }}
        >
          ✓
        </div>

        <div className="pricing-badge-wrapper">
          <span
            className="pricing-tag"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              borderColor: 'rgba(16, 185, 129, 0.35)',
              color: '#34d399'
            }}
          >
            Checkout Completed Successfully
          </span>
        </div>

        <h1 className="pricing-title" style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>
          Welcome to AutoReels {tier}!
        </h1>

        <p className="pricing-subtitle" style={{ fontSize: '1.1rem', marginBottom: '2.5rem' }}>
          Thank you for subscribing to the <strong>{tier}</strong> plan ({cycle === 'year' ? 'Annual' : 'Monthly'}).
          Your Paddle sandbox order has processed successfully, and your digital access is now active.
        </p>

        {/* Next Steps Box */}
        <div
          style={{
            background: 'rgba(19, 27, 46, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'left',
            marginBottom: '2.5rem',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.3)'
          }}
        >
          <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🚀</span> Next steps to activate your extension:
          </h3>

          <ol style={{ paddingLeft: '1.5rem', color: '#cbd5e1', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <li>
              <strong>Check your email:</strong> Paddle has sent an invoice confirmation with your order details.
            </li>
            <li>
              <strong>Open AutoReels Scroll:</strong> Pin the extension to your Chrome toolbar if you haven&apos;t already.
            </li>
            <li>
              <strong>Automatic Sync:</strong> Open YouTube Shorts, Instagram Reels, or TikTok — the extension automatically detects your subscription.
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/dashboard"
            style={{
              padding: '0.9rem 1.8rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
              color: '#0b0f17',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)',
              display: 'inline-block'
            }}
          >
            Go to User Dashboard
          </a>

          <a
            href="/pricing"
            style={{
              padding: '0.9rem 1.8rem',
              borderRadius: '12px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Back to Pricing
          </a>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="pricing-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="price-spinner" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
