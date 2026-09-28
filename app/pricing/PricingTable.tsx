'use client';

import React, { useState, useEffect, useRef } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { Tier } from '@/lib/tiers';
import './pricing.css';

interface PricingTableProps {
  initialCountry: string | null;
  environment: 'sandbox' | 'production';
  clientToken: string;
  tiers: Tier[];
  customerEmail?: string | null;
  paddleCustomerId?: string | null;
}

interface PriceData {
  total: string;
  subtotal?: string;
  tax?: string;
  currencyCode?: string;
}

export default function PricingTable({
  initialCountry,
  environment,
  clientToken,
  tiers,
  customerEmail = null,
  paddleCustomerId = null
}: PricingTableProps) {
  // Billing cycle state: 'month' | 'year'
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loadingPrices, setLoadingPrices] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [activeCheckoutTier, setActiveCheckoutTier] = useState<string | null>(null);

  // References to prevent stale closure in callbacks
  const activeTierRef = useRef<string | null>(null);
  const billingCycleRef = useRef<'month' | 'year'>(billingCycle);
  activeTierRef.current = activeCheckoutTier;
  billingCycleRef.current = billingCycle;

  // 1. Initialize Paddle.js (strictly single initialization on mount)
  useEffect(() => {
    let isMounted = true;

    async function setupPaddle() {
      try {
        if (!environment) {
          throw new Error('Paddle environment is missing.');
        }
        if (!clientToken) {
          throw new Error('Paddle client token is missing.');
        }

        const paddleInitOptions: any = {
          environment,
          token: clientToken,
          eventCallback: (event: any) => {
            if (event.name === 'checkout.completed') {
              const tierName = activeTierRef.current || '';
              const cycle = billingCycleRef.current;
              window.location.href = `/welcome?tier=${encodeURIComponent(tierName)}&cycle=${encodeURIComponent(cycle)}`;
            } else if (event.name === 'checkout.closed') {
              setActiveCheckoutTier(null);
            }
          }
        };

        // Paddle Retain: Pass signed-in customer's Paddle Customer ID (must start with ctm_...)
        if (paddleCustomerId && typeof paddleCustomerId === 'string' && paddleCustomerId.startsWith('ctm_')) {
          paddleInitOptions.pwCustomer = { id: paddleCustomerId };
        }

        const paddleInstance = await initializePaddle(paddleInitOptions);

        if (isMounted && paddleInstance) {
          setPaddle(paddleInstance);
        }
      } catch (err: any) {
        console.error('[Paddle Integration] Initialization failed:', err);
        if (isMounted) {
          setPriceError(`Failed to initialize Paddle payment system: ${err.message}`);
          setLoadingPrices(false);
        }
      }
    }

    setupPaddle();

    return () => {
      isMounted = false;
    };
  }, [environment, clientToken, paddleCustomerId]);

  // 2. Fetch Country-Localized Price Previews via Paddle.PricePreview()
  useEffect(() => {
    if (!paddle) return;

    let isMounted = true;

    async function fetchLocalizedPrices() {
      setLoadingPrices(true);
      setPriceError(null);

      try {
        // Collect current price IDs for all tiers based on active billing cycle
        const items = tiers.map((tier) => ({
          priceId: tier.priceId[billingCycle],
          quantity: 1
        }));

        // Strict IP Geolocation Rule:
        // Pass address.countryCode ONLY if detected from trusted server header (2-letter ISO).
        // If absent or unknown sentinel ('OTHERS'), do NOT pass address to let Paddle auto-detect from visitor IP.
        const previewParams: any = { items };
        if (
          initialCountry &&
          initialCountry !== 'OTHERS' &&
          initialCountry !== 'UNKNOWN' &&
          /^[A-Z]{2}$/i.test(initialCountry)
        ) {
          previewParams.address = {
            countryCode: initialCountry.toUpperCase()
          };
        }

        const previewResponse = await paddle.PricePreview(previewParams);

        if (!isMounted) return;

        const lineItems = previewResponse.data?.details?.lineItems || [];
        const newPrices: Record<string, PriceData> = {};

        lineItems.forEach((item: any) => {
          if (item.price?.id && item.formattedTotals) {
            // STRICT RULE: Display only the totals Paddle returns (formattedTotals).
            // Do NO price math on frontend, and don't re-format Paddle's already-formatted strings.
            newPrices[item.price.id] = {
              total: item.formattedTotals.total,
              subtotal: item.formattedTotals.subtotal,
              tax: item.formattedTotals.tax,
              currencyCode: previewResponse.data.currencyCode
            };
          }
        });

        setPrices((prev) => ({ ...prev, ...newPrices }));
        setLoadingPrices(false);
      } catch (err: any) {
        console.error('[Paddle PricePreview Error]', err);
        if (isMounted) {
          setPriceError(err.message || 'Failed to load localized prices. Please try again.');
          setLoadingPrices(false);
        }
      }
    }

    fetchLocalizedPrices();

    return () => {
      isMounted = false;
    };
  }, [paddle, billingCycle, initialCountry, tiers]);

  // 3. Handle Subscription CTA Click
  const handleSubscribe = (tier: Tier) => {
    if (!paddle) {
      alert('Paddle payment engine is still initializing. Please wait a moment.');
      return;
    }

    const priceId = tier.priceId[billingCycle];
    if (!priceId) {
      alert(`No active price configured for ${tier.name} (${billingCycle}).`);
      return;
    }

    setActiveCheckoutTier(tier.name);

    const redirectUrl = `${window.location.origin}/welcome?tier=${encodeURIComponent(tier.name)}&cycle=${encodeURIComponent(billingCycle)}`;

    const checkoutConfig: any = {
      items: [
        {
          priceId,
          quantity: 1
        }
      ],
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: redirectUrl
      }
    };

    // Prefill customer's email if they're signed in
    if (customerEmail && typeof customerEmail === 'string' && customerEmail.includes('@')) {
      checkoutConfig.customer = {
        email: customerEmail.trim()
      };
    }

    try {
      paddle.Checkout.open(checkoutConfig);
    } catch (err: any) {
      console.error('[Paddle Checkout Open Error]', err);
      setActiveCheckoutTier(null);
      alert(`Unable to open checkout: ${err.message}`);
    }
  };

  return (
    <div className="pricing-wrapper">
      <div className="pricing-glow-bg" />

      <div className="pricing-container">
        {/* Navigation Bar */}
        <header className="pricing-nav">
          <a href="/" className="pricing-brand">
            <span className="pricing-brand-icon">⚡</span>
            <span>AutoReels Scroll</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <a href="/pricing" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>Pricing</a>
            <a href="/account" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>Customer Portal</a>
            <a href="/contact" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>Contact &amp; Support</a>
            {environment === 'sandbox' && (
              <div className="sandbox-pill">
                <span className="sandbox-dot" />
                <span>Paddle Sandbox Mode</span>
              </div>
            )}
          </div>
        </header>

        {/* Pricing Header */}
        <div className="pricing-header">
          <div className="pricing-badge-wrapper">
            <span className="pricing-tag">Pricing Plans & Licensing</span>
          </div>

          <h1 className="pricing-title">Automate your reels hands-free</h1>
          <p className="pricing-subtitle">
            Choose the ideal plan for your scrolling habits. Transparent pricing with instant license key delivery and zero hassle.
          </p>

          {/* Country Location Indicator */}
          <div className="country-indicator">
            <span className="country-flag">🌍</span>
            <span>
              {initialCountry
                ? `Showing country-localized prices for (${initialCountry})`
                : 'Showing prices localized to your regional IP location'}
            </span>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="billing-toggle-section">
          <div className="billing-toggle-pill" role="group" aria-label="Billing cycle selector">
            <button
              type="button"
              id="billing-monthly-toggle"
              className={`billing-toggle-btn ${billingCycle === 'month' ? 'active' : ''}`}
              onClick={() => setBillingCycle('month')}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              id="billing-yearly-toggle"
              className={`billing-toggle-btn ${billingCycle === 'year' ? 'active' : ''}`}
              onClick={() => setBillingCycle('year')}
            >
              <span>Yearly Billing</span>
              <span className="save-badge">Save ~17%</span>
            </button>
          </div>
        </div>

        {/* Price Error Banner */}
        {priceError && (
          <div
            style={{
              maxWidth: '640px',
              margin: '0 auto 2rem',
              padding: '1rem 1.5rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}
          >
            {priceError}
          </div>
        )}

        {/* 3-Tier Pricing Grid */}
        <div className="pricing-grid">
          {tiers.map((tier) => {
            const currentPriceId = tier.priceId[billingCycle];
            const priceInfo = prices[currentPriceId];
            const isOpeningThis = activeCheckoutTier === tier.name;

            return (
              <div
                key={tier.name}
                id={`tier-card-${tier.name.toLowerCase()}`}
                className={`tier-card ${tier.popular ? 'popular' : ''}`}
              >
                {tier.badge && <div className="tier-card-badge">{tier.badge}</div>}

                <div className="tier-header">
                  <h3 className="tier-name">{tier.name}</h3>
                  <p className="tier-description">{tier.description}</p>
                </div>

                {/* Price Display: strictly formattedTotals from Paddle */}
                <div className="tier-price-wrap">
                  {loadingPrices && !priceInfo ? (
                    <div className="tier-price-loading">
                      <div className="price-spinner" />
                      <span>Fetching localized price...</span>
                    </div>
                  ) : (
                    <div className="tier-price-row">
                      <span className="tier-price-amount">
                        {priceInfo?.total || '—'}
                      </span>
                      <span className="tier-price-period">/{billingCycle === 'month' ? 'month' : 'year'}</span>
                    </div>
                  )}
                  <div className="tier-price-note">
                    {billingCycle === 'year' ? 'Billed annually • Cancel anytime' : 'Billed monthly • Cancel anytime'}
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="tier-features">
                  <div className="tier-features-title">What&apos;s included:</div>
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="tier-feature-item">
                      <svg
                        className="tier-feature-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Subscribe Button (Paddle Checkout Overlay) */}
                <button
                  type="button"
                  id={`subscribe-btn-${tier.name.toLowerCase()}`}
                  className="tier-cta-btn"
                  onClick={() => handleSubscribe(tier)}
                  disabled={isOpeningThis || (!paddle && loadingPrices)}
                >
                  {isOpeningThis ? (
                    <>
                      <div className="price-spinner" />
                      <span>Opening Checkout...</span>
                    </>
                  ) : (
                    <span>Subscribe to {tier.name}</span>
                  )}
                </button>

                {customerEmail && (
                  <div className="user-prefill-notice">
                    Pre-filling: <code>{customerEmail}</code>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sandbox Test Mode Helper Info */}
        {environment === 'sandbox' && (
          <div className="sandbox-info-banner">
            <div className="sandbox-info-icon">🧪</div>
            <div className="sandbox-info-content">
              <h4>Paddle Sandbox Test Account Active</h4>
              <p>
                Transactions will be simulated against Paddle Sandbox. No real credit card charges will occur.
                Use Paddle&apos;s standard sandbox test card number to verify:
              </p>
              <div className="sandbox-test-card">
                <span>Test Card:</span>
                <strong>4242 •••• •••• 4242</strong>
                <span>(Any MM/YY, any CVV, any postal code)</span>
              </div>
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="trust-grid">
          <div className="trust-item">
            <div className="trust-icon">🛡️</div>
            <div>
              <h5>Paddle Merchant of Record</h5>
              <p>Certified PCI-DSS compliant checkout with localized payment methods, tax handling, and instant invoicing.</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon">⚡</div>
            <div>
              <h5>Instant License Activation</h5>
              <p>Receive your digital license key immediately upon checkout completion to unlock features across all platforms.</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon">🔄</div>
            <div>
              <h5>14-Day Money-Back Guarantee</h5>
              <p>Not completely satisfied with AutoReels Scroll? Cancel anytime with 1-click in your customer billing portal.</p>
            </div>
          </div>
        </div>

        {/* Public Legal & Compliance Footer (Paddle Go-Live Verification) */}
        <footer style={{ marginTop: '4rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1.75rem', marginBottom: '1.25rem' }}>
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Terms &amp; Conditions</a>
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Privacy Policy</a>
            <a href="/refund" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Refund &amp; Cancellation Policy</a>
            <a href="/contact" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Contact Support</a>
            <a href="/account" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Manage Subscription</a>
          </div>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            &copy; {new Date().getFullYear()} AutoReels Scroll. All rights reserved.
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569' }}>
            Payments securely processed by Paddle.com — our Merchant of Record for all orders. Paddle provides customer service inquiries, handles sales tax, and processes returns.
          </p>
        </footer>
      </div>
    </div>
  );
}
