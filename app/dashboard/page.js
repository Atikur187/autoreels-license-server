'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import '../globals.css';

export default function CustomerDashboardPage() {
  const [searchKey, setSearchKey] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [activeTab, setActiveTab] = useState('key'); // 'key' or 'email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');

  // Read URL query parameters on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key') || params.get('license_key');
    const email = params.get('email');

    if (key) {
      setSearchKey(key);
      setActiveTab('key');
      lookupLicense(key, null);
    } else if (email) {
      setSearchEmail(email);
      setActiveTab('email');
      lookupLicense(null, email);
    }
  }, []);

  const lookupLicense = async (keyParam, emailParam) => {
    const key = keyParam !== undefined ? keyParam : searchKey;
    const email = emailParam !== undefined ? emailParam : searchEmail;

    if (!key && !email) {
      setError('Please enter a license key or email address to search.');
      return;
    }

    setLoading(true);
    setError('');
    setCustomerData(null);
    setActivationMsg('');

    try {
      let url = '/api/license/status';
      if (key && key.trim()) {
        url += `?license_key=${encodeURIComponent(key.trim().toUpperCase())}`;
      } else if (email && email.trim()) {
        url += `?email=${encodeURIComponent(email.trim().toLowerCase())}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success || !data.license) {
        setError(data.error || data.message || 'No license record found for this identifier.');
      } else {
        setCustomerData(data);
      }
    } catch (err) {
      setError('Connection error looking up license. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleActivateExtension = () => {
    if (!customerData?.license?.license_key) return;
    const key = customerData.license.license_key;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: 'ACTIVATE_LICENSE', licenseKey: key }, (response) => {
          if (response && response.success) {
            setActivationMsg('✅ AutoReels extension activated successfully on this browser!');
          } else {
            handleCopy(key);
            setActivationMsg('License copied! Click your AutoReels extension icon in the toolbar and click Activate.');
          }
        });
        return;
      } catch (e) {
        // Fallback below
      }
    }

    handleCopy(key);
    setActivationMsg('License copied to clipboard! Open the AutoReels extension popup in Chrome and click Activate.');
  };

  const planTitles = {
    '7day': '7-Day Free Trial',
    '30day': '1 Month Pass',
    'yearly': '1 Year Pro',
    'lifetime': 'Lifetime VIP'
  };

  const planBadges = {
    '7day': '🎁 Trial',
    '30day': '⚡ 30 Days',
    'yearly': '⭐ 1 Year',
    'lifetime': '👑 Lifetime VIP'
  };

  return (
    <div style={styles.container}>
      {/* Background Glow Accents */}
      <div style={styles.glowTop} />
      <div style={styles.glowRight} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href="/" style={styles.brandLink}>
            <div style={styles.logoBadge}>▶️</div>
            <div>
              <div style={styles.brandTitle}>AutoReels Scroll</div>
              <div style={styles.brandSubtitle}>Customer License Dashboard</div>
            </div>
          </Link>
          <div style={styles.headerNav}>
            <Link href="/pricing" style={styles.navLink}>
              View Pricing
            </Link>
            <Link href="/" style={styles.navLink}>
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.heroSection}>
          <h1 style={styles.heroHeading}>Customer License Dashboard</h1>
          <p style={styles.heroSubtitle}>
            Look up your AutoReels plan, device activations, expiration dates, and renewal information.
          </p>
        </div>

        {/* Search Panel */}
        <div style={styles.searchCard}>
          <div style={styles.tabBar}>
            <button
              onClick={() => { setActiveTab('key'); setError(''); }}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'key' ? styles.tabBtnActive : {})
              }}
            >
              🔑 Search by License Key
            </button>
            <button
              onClick={() => { setActiveTab('email'); setError(''); }}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'email' ? styles.tabBtnActive : {})
              }}
            >
              ✉️ Search by Email
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupLicense();
            }}
            style={styles.searchForm}
          >
            {activeTab === 'key' ? (
              <input
                type="text"
                placeholder="ARS-XXXX-XXXX-XXXX"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                style={styles.inputField}
              />
            ) : (
              <input
                type="email"
                placeholder="your-email@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                style={styles.inputField}
              />
            )}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Searching...' : 'Check Status'}
            </button>
          </form>

          {error && <div style={styles.errorBanner}>{error}</div>}
        </div>

        {/* License Details Result */}
        {customerData && customerData.license && (
          <div style={styles.resultCard}>
            <div style={styles.resultHeader}>
              <div>
                <span style={styles.planBadge}>
                  {planBadges[customerData.license.plan] || '👑 Premium'}
                </span>
                <h2 style={styles.planTitle}>
                  {planTitles[customerData.license.plan] || customerData.license.plan}
                </h2>
              </div>
              <div>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor:
                      customerData.license.status === 'active'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color: customerData.license.status === 'active' ? '#10b981' : '#ef4444',
                    borderColor: customerData.license.status === 'active' ? '#10b981' : '#ef4444'
                  }}
                >
                  {customerData.license.status === 'active' ? '● Active' : `● ${customerData.license.status}`}
                </span>
              </div>
            </div>

            {/* License Key Box */}
            <div style={styles.licenseBox}>
              <div>
                <div style={styles.licenseBoxLabel}>YOUR LICENSE KEY</div>
                <div style={styles.licenseKeyText}>{customerData.license.license_key}</div>
              </div>
              <button
                onClick={() => handleCopy(customerData.license.license_key)}
                style={styles.copyBtn}
              >
                {copied ? '✔ Copied!' : '📋 Copy License'}
              </button>
            </div>

            {activationMsg && <div style={styles.activationNotice}>{activationMsg}</div>}

            {/* Metadata Grid */}
            <div style={styles.metaGrid}>
              {/* Expiration */}
              <div style={styles.metaItem}>
                <div style={styles.metaLabel}>Expiration</div>
                <div style={styles.metaValue}>
                  {customerData.license.plan === 'lifetime' || !customerData.license.expires_at ? (
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Never (Lifetime Access ∞)</span>
                  ) : (
                    <span>
                      {new Date(customerData.license.expires_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Devices Limit */}
              <div style={styles.metaItem}>
                <div style={styles.metaLabel}>Device Activations</div>
                <div style={styles.metaValue}>
                  {customerData.license.activations_count !== undefined
                    ? `${customerData.license.activations_count} / ${customerData.license.max_devices} devices active`
                    : `Up to ${customerData.license.max_devices} devices simultaneously`}
                </div>
              </div>

              {/* Purchase Details */}
              {customerData.purchase && (
                <>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Amount Paid</div>
                    <div style={styles.metaValue}>
                      ${customerData.purchase.amount} {customerData.purchase.currency}
                    </div>
                  </div>

                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Payment Status</div>
                    <div style={styles.metaValue}>
                      <span style={{ textTransform: 'capitalize', color: '#38bdf8' }}>
                        {customerData.purchase.status}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Renewal Information */}
              <div style={{ ...styles.metaItem, gridColumn: '1 / -1' }}>
                <div style={styles.metaLabel}>Renewal Information</div>
                <div style={styles.metaValue}>
                  {customerData.license.plan === 'lifetime' ? (
                    'One-time VIP payment — No recurring charges, access is forever.'
                  ) : customerData.license.plan === '7day' ? (
                    'Free 7-Day Trial — Automatically expires after 7 days without renewal.'
                  ) : customerData.purchase?.paddle_subscription_id ? (
                    'Active subscription — Automatically renews according to your billing period.'
                  ) : (
                    'One-time pass — No automatic renewal. You can purchase a new pass when this expires.'
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.actionRow}>
              <button onClick={handleActivateExtension} style={styles.activateBtn}>
                🚀 Activate in Chrome Extension
              </button>
              <Link href="/pricing" style={styles.upgradeBtn}>
                View Other Plans
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#070b14',
    color: '#f8fafc',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: 'relative',
    overflowX: 'hidden'
  },
  glowTop: {
    position: 'absolute',
    top: '-160px',
    left: '20%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, rgba(7, 11, 20, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  glowRight: {
    position: 'absolute',
    top: '40%',
    right: '-100px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(7, 11, 20, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backdropFilter: 'blur(16px)',
    backgroundColor: 'rgba(7, 11, 20, 0.85)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  headerInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
    color: '#fff'
  },
  logoBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px'
  },
  brandTitle: {
    fontWeight: 800,
    fontSize: '17px',
    letterSpacing: '-0.3px'
  },
  brandSubtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)'
  },
  headerNav: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  },
  navLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.2s'
  },
  main: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '60px 24px 100px',
    position: 'relative',
    zIndex: 1
  },
  heroSection: {
    textAlign: 'center',
    marginBottom: '36px'
  },
  heroHeading: {
    fontSize: '34px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    marginBottom: '10px'
  },
  heroSubtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    maxWidth: '560px',
    margin: '0 auto',
    lineHeight: 1.6
  },
  searchCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)'
  },
  tabBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '18px'
  },
  tabBtn: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
    color: '#38bdf8'
  },
  searchForm: {
    display: 'flex',
    gap: '12px'
  },
  inputField: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: '#fff',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none'
  },
  submitBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    color: '#000',
    fontWeight: 700,
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  errorBanner: {
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: 500
  },
  resultCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '18px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  planBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  planTitle: {
    fontSize: '24px',
    fontWeight: 800,
    marginTop: '4px'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
    border: '1px solid'
  },
  licenseBox: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px dashed var(--accent)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '24px'
  },
  licenseBoxLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.8px',
    marginBottom: '4px'
  },
  licenseKeyText: {
    fontSize: '22px',
    fontFamily: 'monospace',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '1.5px'
  },
  copyBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    backgroundColor: 'var(--accent)',
    color: '#000',
    fontWeight: 700,
    fontSize: '13px',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  activationNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '24px',
    textAlign: 'center'
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '28px'
  },
  metaItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '16px'
  },
  metaLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '6px'
  },
  metaValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff'
  },
  actionRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap'
  },
  activateBtn: {
    flex: 1,
    padding: '14px 20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'center'
  },
  upgradeBtn: {
    padding: '14px 24px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
    textAlign: 'center'
  }
};
