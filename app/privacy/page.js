import React from 'react';
import '../pricing/pricing.css';

export const metadata = {
  title: 'Privacy Policy — AutoReels Scroll',
  description: 'Official Privacy Policy detailing zero-telemetry and data protection practices for AutoReels Scroll.'
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Last Updated: September 2026 • Effective Date: September 2026
          </p>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>1. Overview &amp; Commitment</h2>
            <p>
              AutoReels Scroll (&quot;we,&quot; &quot;our&quot;) is committed to strict user privacy, minimal data collection, and zero tracking. We do NOT track your browsing habits, watched videos, or personal identity. This Privacy Policy explains what limited data is processed strictly for licensing and order fulfillment.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>2. What We Process &amp; Why</h2>
            <p>
              When you purchase a license or activate the extension, we process only the bare minimum technical data required to verify entitlements:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Customer Email:</strong> Provided during Paddle checkout to deliver your digital license key, renewal notices, and customer support.</li>
              <li><strong>License Activation Code:</strong> Used to verify tier level (Starter, Pro, Advanced) and subscription status.</li>
              <li><strong>Anonymous Software Installation ID:</strong> A randomly generated UUID stored in your browser&apos;s local storage to count active devices according to your plan limit.</li>
              <li><strong>Activation Timestamps:</strong> To enforce validity and grant 72-hour offline grace periods.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>3. What We Strictly Do NOT Collect</h2>
            <p>
              We adhere to a strict zero-telemetry architecture:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>No Browsing History:</strong> We never log URLs, video titles, creators, watch durations, or viewing feeds.</li>
              <li><strong>No Hardware Fingerprinting:</strong> We do not collect canvas hashes, battery status, device serial numbers, or audio fingerprints.</li>
              <li><strong>No Analytics or Ad Trackers:</strong> We do not include Google Analytics, Facebook Pixels, or third-party ad beacons.</li>
              <li><strong>No Data Brokering:</strong> We never sell, monetize, or lease your personal information to third parties.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>4. Payment Data &amp; Merchant of Record</h2>
            <p>
              Payments are securely handled by <strong>Paddle.com Market Ltd</strong>, acting as the Merchant of Record. We never receive or store your complete credit card number, CVV code, or banking credentials. Paddle processes financial transactions in compliance with PCI-DSS Level 1 standards and relevant data privacy regulations (GDPR, CCPA).
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>5. Data Retention &amp; Rights</h2>
            <p>
              License and purchase records are retained as required by financial regulations and to fulfill your subscription entitlements. You may request data deletion or an export of your customer data at any time by contacting our support team.
            </p>
          </section>

          <section>
            <h2 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.75rem' }}>6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please reach out via our <a href="/contact" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Contact Page</a> or email <code>privacy@autoreels.scroll</code>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <a href="/privacy" style={{ color: '#38bdf8', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/refund" style={{ color: '#94a3b8', textDecoration: 'none' }}>Refund Policy</a>
            <a href="/contact" style={{ color: '#94a3b8', textDecoration: 'none' }}>Contact</a>
          </div>
          <p>&copy; {new Date().getFullYear()} AutoReels Scroll. Merchant of Record: Paddle.com.</p>
        </footer>
      </div>
    </div>
  );
}
