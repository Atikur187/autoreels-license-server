import React from 'react';
import '../pricing/pricing.css';

export const metadata = {
  title: 'Terms of Service — AutoReels Scroll',
  description: 'Official Terms of Service and End User License Agreement for AutoReels Scroll.'
};

export default function TermsPage() {
  return (
    <div className="pricing-wrapper">
      <div className="pricing-glow-bg" />
      <div className="pricing-container" style={{ maxWidth: '840px' }}>
        {/* Navigation */}
        <header className="pricing-nav">
          <a href="/" className="pricing-brand">
            <span className="pricing-brand-icon">⚡</span>
            <span>AutoReels Scroll</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <a href="/pricing" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none' }}>Pricing</a>
            <a href="/account" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none' }}>Customer Portal</a>
            <a href="/contact" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none' }}>Contact</a>
          </div>
        </header>

        {/* Content Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '2.5rem',
          lineHeight: '1.7',
          color: '#cbd5e1'
        }}>
          <h1 style={{ color: '#f8fafc', fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 700 }}>
            Terms &amp; Conditions
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Last Updated: September 2026 • Effective Date: September 2026
          </p>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>1. Introduction &amp; Acceptance</h2>
            <p>
              Welcome to AutoReels Scroll (&quot;we,&quot; &quot;our,&quot; or &quot;Service&quot;). By purchasing a license, subscribing, downloading, or using the AutoReels Scroll browser extension and associated licensing services, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not purchase or use the Service.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>2. Product Description &amp; License Grant</h2>
            <p>
              AutoReels Scroll provides client-side automation tools to enhance user playback experience on supported short-form video platforms (YouTube Shorts, Instagram Reels, Facebook Reels, and TikTok). Upon purchase, we grant you a non-exclusive, non-transferable, revocable license to use the extension according to your selected plan:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Starter Plan:</strong> Valid for 1 concurrent active browser session.</li>
              <li><strong>Pro Plan:</strong> Valid for up to 3 concurrent active browser sessions.</li>
              <li><strong>Advanced Plan:</strong> Unlimited active device sessions for personal/professional use.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>3. Merchant of Record &amp; Payment Processing</h2>
            <p>
              Our order process is conducted by our online reseller and Merchant of Record, <strong>Paddle.com Market Ltd</strong> (&quot;Paddle&quot;). Paddle provides customer service inquiries, handles sales tax, and handles refunds and returns. When completing a checkout, you agree to Paddle&apos;s checkout terms and buyer policies.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>4. Subscriptions, Billing &amp; Cancellation</h2>
            <p>
              Recurring subscriptions (Monthly or Annual) automatically renew at the end of each billing cycle unless canceled prior to the renewal date. You may cancel your subscription at any time with zero penalty through your <a href="/account" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Customer Billing Portal</a>. Cancellation takes effect at the conclusion of your current paid billing period; you retain access until the period expires.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>5. Refunds &amp; Money-Back Guarantee</h2>
            <p>
              We stand by our product with a 14-day money-back guarantee. If you are unsatisfied with AutoReels Scroll within 14 days of your initial purchase, please review our <a href="/refund" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Refund &amp; Cancellation Policy</a> or contact us directly.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>6. Acceptable Use &amp; Platform Compliance</h2>
            <p>
              AutoReels Scroll is designed to automate scrolling for human viewing comfort. You agree not to:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>Use the extension for fraudulent ad impression generation or spam networks.</li>
              <li>Reverse engineer, decompile, or tamper with the license activation protocol.</li>
              <li>Distribute pirated license keys or bypass concurrent session security checks.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>7. Limitation of Liability</h2>
            <p>
              AutoReels Scroll is provided &quot;as is&quot; without warranties of any kind. We are not affiliated with, endorsed by, or sponsored by YouTube, Meta, Instagram, Facebook, TikTok, or ByteDance. In no event shall AutoReels Scroll or Paddle be liable for any indirect, incidental, or consequential damages arising from use or inability to use the extension.
            </p>
          </section>

          <section>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>8. Contact Information</h2>
            <p>
              For legal, licensing, or support questions, please visit our <a href="/contact" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Contact &amp; Support Page</a> or email us at <code>support@autoreels.scroll</code>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
            <a href="/terms" style={{ color: '#38bdf8', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/refund" style={{ color: '#94a3b8', textDecoration: 'none' }}>Refund Policy</a>
            <a href="/contact" style={{ color: '#94a3b8', textDecoration: 'none' }}>Contact</a>
          </div>
          <p>&copy; {new Date().getFullYear()} AutoReels Scroll. Merchant of Record: Paddle.com.</p>
        </footer>
      </div>
    </div>
  );
}
