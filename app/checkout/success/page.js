'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import '../../globals.css';

function SuccessContent() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get('_ptxn') || searchParams.get('transaction_id') || searchParams.get('txn_id');
  const keyParam = searchParams.get('key') || searchParams.get('license_key');

  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activationTip, setActivationTip] = useState('');

  useEffect(() => {
    if (keyParam) {
      // Authoritatively verify key with backend before displaying
      fetch(`/api/license/status?license_key=${encodeURIComponent(keyParam)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.license) {
            setLicense(data.license);
          } else {
            setError(data.error || 'Invalid or unverified license key.');
          }
        })
        .catch(() => setError('Failed to verify license key with server.'))
        .finally(() => setLoading(false));
      return;
    }

    if (!txnId) {
      setError('No transaction ID provided in checkout return.');
      setLoading(false);
      return;
    }

    // Poll /api/license/status until authoritative Paddle webhook creates license
    let attempts = 0;
    const maxAttempts = 20; // 20 * 1500ms = 30 seconds
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/license/status?transaction_id=${encodeURIComponent(txnId)}`);
        const data = await res.json();
        if (data.success && data.ready && data.license) {
          clearInterval(interval);
          setLicense(data.license);
          setLoading(false);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setLoading(false);
          setError('Payment received! Webhook processing is taking slightly longer than usual. Please check your email or refresh this page in a moment.');
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setLoading(false);
          setError('Connection error checking license status. Please refresh.');
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [txnId, keyParam]);

  const handleCopyLicense = () => {
    if (license?.license_key) {
      navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleActivateExtension = () => {
    if (license?.license_key) {
      navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      setActivationTip('✔ License copied to clipboard! Open the AutoReels extension in your browser to activate.');
      setTimeout(() => setActivationTip(''), 5000);
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'AUTOREELS_ACTIVATE_KEY', licenseKey: license.license_key }, '*');
      }
    }
  };

  const planTitles = {
    '7day': '7-Day Free Trial',
    '30day': '1 Month Pass',
    'yearly': '1 Year Pro',
    'lifetime': 'Lifetime VIP'
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.badge}>
          <span>✓</span>
        </div>

        <h1 style={styles.title}>Payment successful ✅</h1>
        <p style={styles.subtitle}>Your AutoReels Premium license has been created.</p>

        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Verifying payment confirmation with Paddle webhook...
            </p>
          </div>
        ) : error ? (
          <div style={styles.errorBox}>
            <p style={{ margin: 0, fontSize: '13px', color: '#ef4444' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ ...styles.secondaryBtn, marginTop: '12px' }}
            >
              ↻ Retry Status Check
            </button>
          </div>
        ) : license ? (
          <div>
            <div style={styles.licenseLabel}>License:</div>
            <div style={styles.keyBox}>
              <span style={styles.keyText}>{license.license_key}</span>
              <button onClick={handleCopyLicense} style={styles.copyBtn} title="Copy license">
                {copied ? '✔ Copied!' : '📋 Copy License'}
              </button>
            </div>

            <div style={styles.metaRow}>
              <span>Plan: <strong>{planTitles[license.plan] || license.plan}</strong></span>
              <span>Max Devices: <strong>{license.max_devices || '1'}</strong></span>
              {license.expires_at ? (
                <span>Expires: <strong>{new Date(license.expires_at).toLocaleDateString()}</strong></span>
              ) : (
                <span>Validity: <strong>Lifetime (Never Expires)</strong></span>
              )}
            </div>

            <div style={styles.buttonRow}>
              <button onClick={handleActivateExtension} style={styles.primaryBtn}>
                🚀 Activate Extension
              </button>
              <button onClick={handleCopyLicense} style={styles.secondaryBtn}>
                {copied ? '✔ Copied!' : '📋 Copy License'}
              </button>
            </div>

            {activationTip && (
              <div style={styles.tipBanner}>
                {activationTip}
              </div>
            )}

            <div style={styles.instructions}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '6px' }}>
                💡 Quick Activation Instructions:
              </div>
              <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                <li>Click the <strong>AutoReels Scroll</strong> icon in your Chrome toolbar.</li>
                <li>Paste your license key (already copied to clipboard) into the activation box.</li>
                <li>Click <strong>Activate</strong> to immediately unlock hands-free auto-scrolling!</li>
              </ol>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: '24px' }}>
          <a href="/" style={styles.homeLink}>← Return to AutoReels Home</a>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#070d18',
    color: '#fff'
  },
  card: {
    maxWidth: '520px',
    width: '100%',
    backgroundColor: '#0c1524',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '18px',
    padding: '36px',
    textAlign: 'center',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)'
  },
  badge: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '2px solid #10b981',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 auto 16px'
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    margin: '0 0 6px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#38bdf8',
    fontWeight: 600,
    margin: '0 0 24px'
  },
  licenseLabel: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px'
  },
  keyBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#040913',
    border: '1px solid #38bdf8',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '14px'
  },
  keyText: {
    fontFamily: 'monospace',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#fff'
  },
  copyBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: '#38bdf8',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '8px'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#38bdf8',
    color: '#070d18',
    border: 'none',
    padding: '12px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tipBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '16px'
  },
  instructions: {
    textAlign: 'left',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '14px 16px',
    fontSize: '12px'
  },
  homeLink: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '13px',
    textDecoration: 'none'
  },
  loadingBox: {
    padding: '30px 20px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite'
  },
  errorBox: {
    padding: '20px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px'
  }
};
