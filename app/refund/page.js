import React from 'react';
import '../pricing/pricing.css';

export const metadata = {
  title: 'Refund & Cancellation Policy — AutoReels Scroll',
  description: 'Official 14-day refund policy, subscription cancellation terms, and dispute process for AutoReels Scroll.'
};

export default function RefundPolicyPage() {
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
            Refund &amp; Cancellation Policy
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Last Updated: September 2026 • Effective Date: September 2026
          </p>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>1. 14-Day Money-Back Guarantee</h2>
            <p>
              We want you to be completely satisfied with AutoReels Scroll. If you find that the product does not suit your needs or does not perform as expected, you are entitled to a full refund within <strong>14 calendar days</strong> of your initial purchase date. No complex interrogation, no hidden restocking fees.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>2. How to Request a Refund</h2>
            <p>
              To request a refund within the 14-day window, you can:
            </p>
            <ol style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>
                <strong>Self-Service via Paddle Buyer Support:</strong> Use the link included in your official Paddle email receipt or visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>paddle.net</a> with your order number.
              </li>
              <li>
                <strong>Contact AutoReels Support:</strong> Email our team directly at <code>support@autoreels.scroll</code> with your purchase email address and transaction ID. We will promptly process the refund via Paddle.
              </li>
            </ol>
            <p style={{ marginTop: '0.75rem' }}>
              Once approved, funds are credited back to your original payment method within 5–10 business days depending on your bank or card issuer.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>3. Subscription Cancellation Policy</h2>
            <p>
              You may cancel your recurring subscription (Monthly or Annual) at any time:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>
                <strong>Instant 1-Click Cancellation:</strong> Visit your <a href="/account" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Customer Portal</a> and click &quot;Cancel Subscription&quot;.
              </li>
              <li>
                <strong>Effective Date:</strong> Cancellation schedules the end of renewal. You retain full paid access to AutoReels Scroll until the end of the current billing period for which you have paid.
              </li>
              <li>
                <strong>No Further Charges:</strong> Once canceled, your credit card will never be charged for subsequent billing cycles.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>4. Exceptions &amp; Abuse Prevention</h2>
            <p>
              Refund requests after the 14-day window are evaluated on a case-by-case basis. We reserve the right to decline refunds where there is clear evidence of fraud, repeated subscription churn abuse, or violations of our Terms of Service.
            </p>
          </section>

          <section>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>5. Questions &amp; Support</h2>
            <p>
              Have a billing question or need assistance? Please visit our <a href="/contact" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Support Page</a> or email <code>support@autoreels.scroll</code>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/refund" style={{ color: '#38bdf8', textDecoration: 'none' }}>Refund Policy</a>
            <a href="/contact" style={{ color: '#94a3b8', textDecoration: 'none' }}>Contact</a>
          </div>
          <p>&copy; {new Date().getFullYear()} AutoReels Scroll. Merchant of Record: Paddle.com.</p>
        </footer>
      </div>
    </div>
  );
}
