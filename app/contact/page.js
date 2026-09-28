'use client';

import React, { useState } from 'react';
import '../pricing/pricing.css';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate contact form submission
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

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
            <a href="/contact" style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}>Contact</a>
          </div>
        </header>

        {/* Content Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '2.5rem',
          color: '#cbd5e1'
        }}>
          <h1 style={{ color: '#f8fafc', fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 700 }}>
            Contact &amp; Customer Support
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2.5rem' }}>
            Need help with your license, billing, or extension setup? Reach our team in two clicks or fewer.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {/* Direct Email Card */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>✉️</div>
              <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Direct Email Support</h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1rem' }}>
                We typically respond within 12–24 business hours.
              </p>
              <a
                href="mailto:support@autoreels.scroll"
                style={{
                  display: 'inline-block',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                support@autoreels.scroll &rarr;
              </a>
            </div>

            {/* Paddle Buyer Support Card */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>🛡️</div>
              <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Billing &amp; Receipts</h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1rem' }}>
                For immediate VAT invoices, card updates, or charge inquiries.
              </p>
              <a
                href="https://paddle.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                Paddle Buyer Portal &rarr;
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '2.5rem' }}>
            <h2 style={{ color: '#f8fafc', fontSize: '1.35rem', marginBottom: '1rem' }}>
              Send Us a Message
            </h2>

            {submitted ? (
              <div style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                color: '#86efac',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>Message Received!</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Thank you for reaching out. Our support team will respond to <strong>{formData.email}</strong> shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Your Email</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="License activation issue / Feature inquiry"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How can we help you?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.85rem 1.75rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                    color: '#fff',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    justifySelf: 'start',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
                  }}
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/refund" style={{ color: '#94a3b8', textDecoration: 'none' }}>Refund Policy</a>
            <a href="/contact" style={{ color: '#38bdf8', textDecoration: 'none' }}>Contact</a>
          </div>
          <p>&copy; {new Date().getFullYear()} AutoReels Scroll. Merchant of Record: Paddle.com.</p>
        </footer>
      </div>
    </div>
  );
}
