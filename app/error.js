'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import './pricing/pricing.css';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[App Runtime Error]', error);
  }, [error]);

  return (
    <div className="pricing-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pricing-glow-bg" />
      <div style={{
        maxWidth: '540px',
        width: '90%',
        margin: '2rem auto',
        padding: '2.5rem',
        borderRadius: '20px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        color: '#cbd5e1',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
        <h2 style={{ fontSize: '1.75rem', color: '#f8fafc', marginBottom: '0.75rem', fontWeight: 700 }}>
          AutoReels Scroll
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          We encountered a temporary connection issue. Please refresh or return to the pricing page.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: '10px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            Try Again
          </button>
          <Link
            href="/pricing"
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              fontWeight: 500,
              textDecoration: 'none',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '0.95rem'
            }}
          >
            Go to Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
