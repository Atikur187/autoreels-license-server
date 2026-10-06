import React from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { resolveAuthenticatedUser } from '../../lib/auth.js';
import { getCustomerSubscriptions } from '../../lib/db-service.js';
import { getSubscriptionAccessDetails } from '../../lib/subscription-access.js';
import '../pricing/pricing.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Billing & Account Portal — AutoReels Scroll',
  description: 'Manage your AutoReels Scroll subscription, update payment methods, and download invoices.'
};

export default async function AccountPage({ searchParams }) {
  // 1. Resolve authentication server-side safely
  let auth = { authenticated: false };
  let subscriptions = [];
  let accessDetails = null;

  try {
    const headerList = headers();
    const mockReq = {
      headers: headerList,
      url: searchParams?.email ? `http://localhost?email=${encodeURIComponent(searchParams.email)}` : 'http://localhost'
    };

    auth = await resolveAuthenticatedUser(mockReq);

    if (auth.authenticated && auth.customerId) {
      subscriptions = await getCustomerSubscriptions(auth.customerId);
      const primarySub = subscriptions.length > 0 ? subscriptions[0] : null;
      accessDetails = getSubscriptionAccessDetails(primarySub);
    }
  } catch (err) {
    console.warn('[AccountPage] Auth resolution error:', err);
  }

  return (
    <div className="pricing-wrapper">
      <div className="pricing-glow-bg" />

      <div className="pricing-container" style={{ maxWidth: '840px' }}>
        {/* Navigation */}
        <header className="pricing-nav">
          <Link href="/" className="pricing-brand">
            <span className="pricing-brand-icon">⚡</span>
            <span>AutoReels Scroll</span>
          </Link>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link
              href="/pricing"
              style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              Pricing
            </Link>
            <Link
              href="/dashboard"
              style={{
                color: '#38bdf8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              Dashboard
            </Link>
          </div>
        </header>

        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="pricing-badge-wrapper">
            <span className="pricing-tag">Customer Self-Service</span>
          </div>
          <h1 className="pricing-title" style={{ fontSize: '2.5rem' }}>
            Billing & Subscription Portal
          </h1>
          <p className="pricing-subtitle" style={{ maxWidth: '600px', margin: '0.75rem auto 0' }}>
            Manage your payment methods, view invoices, or change your subscription directly through our secure Paddle customer portal.
          </p>
        </div>

        {/* Not Authenticated State */}
        {!auth.authenticated && (
          <div
            style={{
              background: 'rgba(19, 27, 46, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '2.5rem',
              textAlign: 'center',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
            <h2 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
              Sign in to access your account
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem' }}>
              Please enter the email address used during your Paddle checkout to authenticate your session.
            </p>

            <form
              method="GET"
              action="/account"
              style={{
                display: 'flex',
                gap: '0.75rem',
                maxWidth: '440px',
                margin: '0 auto',
                flexWrap: 'wrap'
              }}
            >
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                required
                style={{
                  flex: '1 1 240px',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  background: 'rgba(11, 15, 23, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.85rem 1.75rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  color: '#0b0f17',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Access Portal
              </button>
            </form>
          </div>
        )}

        {/* Authenticated State */}
        {auth.authenticated && (
          <div
            style={{
              background: 'rgba(19, 27, 46, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '2.5rem',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* User Profile Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '2rem',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Authenticated Customer
                </div>
                <div style={{ fontSize: '1.15rem', color: '#f8fafc', fontWeight: '600' }}>
                  {auth.email}
                </div>
              </div>

              {auth.customerId && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Paddle Customer ID
                  </div>
                  <code style={{ fontSize: '0.85rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                    {auth.customerId}
                  </code>
                </div>
              )}
            </div>

            {/* Subscription Access Overview */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '1rem' }}>
                Subscription Entitlement Status
              </h3>

              {accessDetails && (
                <div
                  style={{
                    background: 'rgba(11, 15, 23, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Status: </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          background:
                            accessDetails.status === 'active' || accessDetails.status === 'trialing'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            accessDetails.status === 'active' || accessDetails.status === 'trialing'
                              ? '#34d399'
                              : '#f87171',
                          border: `1px solid ${
                            accessDetails.status === 'active' || accessDetails.status === 'trialing'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(239, 68, 68, 0.3)'
                          }`
                        }}
                      >
                        {accessDetails.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                      Access Granted:{' '}
                      <strong style={{ color: accessDetails.hasAccess ? '#34d399' : '#f87171' }}>
                        {accessDetails.hasAccess ? 'YES' : 'NO'}
                      </strong>
                    </div>
                  </div>

                  {/* Scheduled Change Notice */}
                  {accessDetails.isScheduledForCancel && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fcd34d',
                        fontSize: '0.9rem'
                      }}
                    >
                      ⚠️ <strong>Scheduled Cancellation:</strong> Your subscription is set to cancel on{' '}
                      {accessDetails.scheduledChangeAt
                        ? new Date(accessDetails.scheduledChangeAt).toLocaleDateString()
                        : 'the end of your current billing period'}
                      . Your paid access remains fully active until then.
                    </div>
                  )}

                  {accessDetails.isScheduledForPause && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#7dd3fc',
                        fontSize: '0.9rem'
                      }}
                    >
                      ℹ️ <strong>Scheduled Pause:</strong> Your subscription is scheduled to pause on{' '}
                      {accessDetails.scheduledChangeAt
                        ? new Date(accessDetails.scheduledChangeAt).toLocaleDateString()
                        : 'the end of your current billing period'}
                      .
                    </div>
                  )}
                </div>
              )}

              {!accessDetails && (
                <div style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                  No active subscription records found for this account.
                </div>
              )}
            </div>

            {/* Launch Paddle Portal Action */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(2, 132, 199, 0.05))',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center'
              }}
            >
              <h4 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                Paddle Self-Service Customer Portal
              </h4>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                Click below to mint an authenticated session and open your Paddle-hosted portal to manage payment methods, view past invoices, or cancel anytime.
              </p>

              <form method="GET" action="/api/portal/session">
                <input type="hidden" name="email" value={auth.email} />
                <button
                  type="submit"
                  style={{
                    padding: '0.9rem 2.2rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                    color: '#0b0f17',
                    fontWeight: '700',
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(56, 189, 248, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <span>Open Customer Portal</span>
                  <span>↗</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
