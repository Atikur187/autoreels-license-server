'use client';

import React, { useState, useEffect } from 'react';
import '../globals.css';

export default function AdminDashboardPage() {
  // Authentication State
  const [sessionToken, setSessionToken] = useState('');
  const [adminUser, setAdminUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Login Form State
  const [loginMethod, setLoginMethod] = useState('key'); // 'key' | 'supabase'
  const [keyInput, setKeyInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Active Tab: 'overview' | 'licenses' | 'purchases' | 'activations' | 'products' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview Data
  const [overviewMetrics, setOverviewMetrics] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Licenses Data
  const [licenses, setLicenses] = useState([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [licenseSearch, setLicenseSearch] = useState('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState('');
  const [licensePlanFilter, setLicensePlanFilter] = useState('');
  const [selectedLicenseIds, setSelectedLicenseIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Generator State
  const [genPlan, setGenPlan] = useState('lifetime');
  const [genMaxDevices, setGenMaxDevices] = useState(1);
  const [genEmail, setGenEmail] = useState('');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Purchases Data
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchasePlanFilter, setPurchasePlanFilter] = useState('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState('');

  // Activations Data
  const [activations, setActivations] = useState([]);
  const [activationsLoading, setActivationsLoading] = useState(false);
  const [activationSearch, setActivationSearch] = useState('');
  const [activationStatusFilter, setActivationStatusFilter] = useState('');

  // Products Data
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Active Modal for License Details & Device Slots
  const [inspectLicense, setInspectLicense] = useState(null);

  // Notifications
  const [notification, setNotification] = useState(null);

  // Auto-verify existing session on mount
  useEffect(() => {
    async function checkExistingSession() {
      const savedToken = typeof window !== 'undefined' ? sessionStorage.getItem('ars_admin_session_token') : null;
      if (!savedToken) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/auth/session', {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        const data = await res.json();
        if (res.ok && data.authenticated) {
          setSessionToken(savedToken);
          setAdminUser(data.admin);
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem('ars_admin_session_token');
          setIsAuthenticated(false);
        }
      } catch {
        sessionStorage.removeItem('ars_admin_session_token');
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    }

    checkExistingSession();
  }, []);

  // Fetch data when authenticated or active tab changes
  useEffect(() => {
    if (!isAuthenticated) return;

    if (activeTab === 'overview') {
      fetchOverview();
    } else if (activeTab === 'licenses') {
      fetchLicenses();
    } else if (activeTab === 'purchases') {
      fetchPurchases();
    } else if (activeTab === 'activations') {
      fetchActivations();
    } else if (activeTab === 'products') {
      fetchProducts();
    }
  }, [isAuthenticated, activeTab]);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
    'x-admin-token': sessionToken
  });

  // ---------------------------------------------------------------------------
  // Authentication Handlers
  // ---------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    try {
      const payload = loginMethod === 'key'
        ? { adminKey: keyInput.trim() }
        : { email: emailInput.trim(), password: passwordInput.trim() };

      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 403) {
          setAuthError('403 Forbidden: This account is authenticated but not on the server ADMIN_EMAILS allowlist.');
        } else {
          setAuthError(data.error || 'Authentication failed. Please verify credentials.');
        }
        setIsSubmittingAuth(false);
        return;
      }

      setSessionToken(data.token);
      setAdminUser(data.admin);
      setIsAuthenticated(true);
      sessionStorage.setItem('ars_admin_session_token', data.token);
      showToast('Welcome back, Administrator!');
    } catch (err) {
      setAuthError('Network error connecting to login service: ' + err.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {}

    sessionStorage.removeItem('ars_admin_session_token');
    setSessionToken('');
    setAdminUser(null);
    setIsAuthenticated(false);
    setLicenses([]);
    setPurchases([]);
    setActivations([]);
    setOverviewMetrics(null);
  };

  // ---------------------------------------------------------------------------
  // Overview Fetcher
  // ---------------------------------------------------------------------------
  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/admin/overview', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setOverviewMetrics(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Error loading overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Licenses Handlers
  // ---------------------------------------------------------------------------
  const fetchLicenses = async () => {
    setLicensesLoading(true);
    try {
      const params = new URLSearchParams();
      if (licenseSearch) params.append('q', licenseSearch);
      if (licenseStatusFilter) params.append('status', licenseStatusFilter);
      if (licensePlanFilter) params.append('plan', licensePlanFilter);

      const res = await fetch(`/api/admin/licenses?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setLicenses(data.licenses || []);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Error loading licenses:', err);
    } finally {
      setLicensesLoading(false);
    }
  };

  const handleGenerateLicense = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          plan: genPlan,
          maxDevices: parseInt(genMaxDevices, 10),
          customerEmail: genEmail.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to generate manual license.');
        setIsGenerating(false);
        return;
      }

      setGeneratedResult(data.license);
      setCopiedKey(false);
      showToast(`Key ${data.license.license_key} created successfully!`);
      fetchLicenses();
    } catch (err) {
      alert('Error generating license: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleLicenseStatus = async (lic) => {
    const nextStatus = lic.status === 'active' ? 'revoked' : 'active';
    const confirmPrompt = nextStatus === 'revoked'
      ? `Revoke license ${lic.license_key}?\n\nActive extension sessions will lose access.`
      : `Reactivate license ${lic.license_key}?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      const res = await fetch(`/api/admin/licenses/${lic.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast(`License ${lic.license_key} is now ${nextStatus}.`);
        fetchLicenses();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update license status.');
      }
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDeleteLicense = async (lic) => {
    if (!window.confirm(`Permanently DELETE license ${lic.license_key}?\n\nThis cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/licenses/${lic.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast(`License ${lic.license_key} deleted permanently.`);
        fetchLicenses();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete license.');
      }
    } catch (err) {
      alert('Error deleting license: ' + err.message);
    }
  };

  const handleCleanTestKeys = async () => {
    if (!window.confirm('Delete all demo/test sample keys (TEST-ARS-*)? Real purchases are not touched.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: 'test' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Sample test keys cleaned up.');
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to clean test keys.');
      }
    } catch (err) {
      alert('Error cleaning keys: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCleanExpiredKeys = async () => {
    if (!window.confirm('Delete all expired licenses?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: 'expired' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Expired licenses removed.');
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to clean expired keys.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Purchases Handlers
  // ---------------------------------------------------------------------------
  const fetchPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const params = new URLSearchParams();
      if (purchaseSearch) params.append('q', purchaseSearch);
      if (purchasePlanFilter) params.append('plan', purchasePlanFilter);
      if (purchaseStatusFilter) params.append('status', purchaseStatusFilter);

      const res = await fetch(`/api/admin/purchases?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setPurchases(data.purchases || []);
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setPurchasesLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Activations Handlers
  // ---------------------------------------------------------------------------
  const fetchActivations = async () => {
    setActivationsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activationSearch) params.append('q', activationSearch);
      if (activationStatusFilter) params.append('status', activationStatusFilter);

      const res = await fetch(`/api/admin/activations?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setActivations(data.activations || []);
      }
    } catch (err) {
      console.error('Error fetching activations:', err);
    } finally {
      setActivationsLoading(false);
    }
  };

  const handleDeactivateSlot = async (activationId, deviceLabel) => {
    if (!window.confirm(`Reset device slot for "${deviceLabel || 'Device'}"?\n\nThis frees up 1 device activation slot.`)) return;

    try {
      const res = await fetch('/api/admin/activations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ activationId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Device slot successfully freed!');
        fetchActivations();
        if (inspectLicense) {
          fetchLicenses();
        }
      } else {
        alert(data.error || 'Failed to reset device slot.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Products Handlers
  // ---------------------------------------------------------------------------
  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // Render: Loading Screen
  // ---------------------------------------------------------------------------
  if (authChecking) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Checking administrator session...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Secure Login Gate
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div style={styles.loginWrapper}>
        <div style={styles.loginCard}>
          <div style={styles.brandIcon}>🛡️</div>
          <h1 style={styles.loginTitle}>AutoReels Admin Control</h1>
          <p style={styles.loginSubtitle}>
            Dedicated portal for license management, customer entitlements, and purchase verification.
          </p>

          <div style={styles.authTabs}>
            <button
              onClick={() => { setLoginMethod('key'); setAuthError(''); }}
              style={{
                ...styles.authTab,
                borderBottomColor: loginMethod === 'key' ? 'var(--accent)' : 'transparent',
                color: loginMethod === 'key' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              🔑 Master Admin Key
            </button>
            <button
              onClick={() => { setLoginMethod('supabase'); setAuthError(''); }}
              style={{
                ...styles.authTab,
                borderBottomColor: loginMethod === 'supabase' ? 'var(--accent)' : 'transparent',
                color: loginMethod === 'supabase' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              👤 Supabase Account
            </button>
          </div>

          <form onSubmit={handleLogin} style={styles.loginForm}>
            {loginMethod === 'key' ? (
              <div style={styles.formGroup}>
                <label style={styles.label}>Master Admin API Key</label>
                <input
                  type="password"
                  placeholder="Enter ADMIN_API_KEY..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  style={styles.input}
                  autoFocus
                  required
                />
                <span style={styles.inputHint}>Configured in Vercel / server environment variables.</span>
              </div>
            ) : (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Admin Email</label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    style={styles.input}
                    autoFocus
                    required
                  />
                  <span style={styles.inputHint}>Must match an email in server ADMIN_EMAILS allowlist.</span>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    placeholder="Supabase account password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
              </>
            )}

            {authError && (
              <div style={styles.errorNoticeBox}>
                <span>⚠️ {authError}</span>
              </div>
            )}

            <button type="submit" disabled={isSubmittingAuth} style={styles.primaryAuthBtn}>
              {isSubmittingAuth ? 'Verifying Authorization...' : 'Authenticate & Enter Dashboard →'}
            </button>
          </form>

          <div style={styles.securityNote}>
            🔒 Protected by server-side authorization. Public registration is permanently disabled.
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Authenticated Dashboard
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.dashboardContainer}>
      {/* Toast Notification */}
      {notification && (
        <div style={notification.type === 'error' ? styles.toastError : styles.toastSuccess}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} style={styles.toastCloseBtn}>✕</button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.logoBadge}>🎬</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={styles.brandTitle}>AutoReels Scroll</span>
              <span style={styles.adminBadge}>ADMIN PANEL</span>
            </div>
            <span style={styles.brandSubtitle}>Production License & Entitlement Control</span>
          </div>
        </div>

        <div style={styles.topBarRight}>
          <div style={styles.userBadge}>
            <span style={styles.onlineDot}></span>
            <span>{adminUser?.email || 'Authorized Administrator'}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn} title="Sign out of Admin Panel">
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab Navigation Ribbon */}
      <nav style={styles.tabRibbon}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{ ...styles.tabButton, ...(activeTab === 'overview' ? styles.tabButtonActive : {}) }}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('licenses')}
          style={{ ...styles.tabButton, ...(activeTab === 'licenses' ? styles.tabButtonActive : {}) }}
        >
          🔑 Licenses
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          style={{ ...styles.tabButton, ...(activeTab === 'purchases' ? styles.tabButtonActive : {}) }}
        >
          💳 Purchases
        </button>
        <button
          onClick={() => setActiveTab('activations')}
          style={{ ...styles.tabButton, ...(activeTab === 'activations' ? styles.tabButtonActive : {}) }}
        >
          📱 Device Activations
        </button>
        <button
          onClick={() => setActiveTab('products')}
          style={{ ...styles.tabButton, ...(activeTab === 'products' ? styles.tabButtonActive : {}) }}
        >
          📦 Products & Plans
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{ ...styles.tabButton, ...(activeTab === 'settings' ? styles.tabButtonActive : {}) }}
        >
          ⚙️ Settings
        </button>
      </nav>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* =================================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* =================================================================== */}
        {activeTab === 'overview' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>System Overview</h2>
                <p style={styles.viewSubtitle}>Real database metrics and live entitlement standing.</p>
              </div>
              <button onClick={fetchOverview} style={styles.refreshBtn} disabled={overviewLoading}>
                {overviewLoading ? '↻ Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>

            {/* 6 Database Metric Cards */}
            <div style={styles.metricsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Total Licenses</span>
                <span style={styles.statNumber}>{overviewMetrics?.metrics?.totalLicenses ?? '—'}</span>
                <span style={styles.statSub}>Total issued in database</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Active Licenses</span>
                <span style={{ ...styles.statNumber, color: 'var(--success)' }}>
                  {overviewMetrics?.metrics?.activeLicenses ?? '—'}
                </span>
                <span style={styles.statSub}>Currently valid & unlocking</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Active Activations</span>
                <span style={{ ...styles.statNumber, color: 'var(--accent)' }}>
                  {overviewMetrics?.metrics?.activeActivations ?? '—'}
                </span>
                <span style={styles.statSub}>Current device installations</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Confirmed Purchases</span>
                <span style={{ ...styles.statNumber, color: '#a855f7' }}>
                  {overviewMetrics?.metrics?.confirmedPurchases ?? '—'}
                </span>
                <span style={styles.statSub}>Paddle verified transactions</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Expired Licenses</span>
                <span style={{ ...styles.statNumber, color: 'var(--warning)' }}>
                  {overviewMetrics?.metrics?.expiredLicenses ?? '—'}
                </span>
                <span style={styles.statSub}>Passes reached end-of-term</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Revoked Licenses</span>
                <span style={{ ...styles.statNumber, color: 'var(--danger)' }}>
                  {overviewMetrics?.metrics?.revokedLicenses ?? '—'}
                </span>
                <span style={styles.statSub}>Refunded or disabled</span>
              </div>
            </div>

            {/* Plan Distribution Cards */}
            <div style={styles.cardBox}>
              <h3 style={styles.cardBoxTitle}>Plan Breakdown</h3>
              <div style={styles.planBreakdownGrid}>
                <div style={styles.planPill}>
                  <span style={styles.planPillTitle}>🎁 7-Day Free Trial</span>
                  <span style={styles.planPillCount}>{overviewMetrics?.metrics?.planCounts?.['7day'] ?? 0}</span>
                </div>
                <div style={styles.planPill}>
                  <span style={styles.planPillTitle}>⚡ 1 Month Pass ($1.49)</span>
                  <span style={styles.planPillCount}>{overviewMetrics?.metrics?.planCounts?.['30day'] ?? 0}</span>
                </div>
                <div style={styles.planPill}>
                  <span style={styles.planPillTitle}>⭐ 1 Year Pro ($9.49)</span>
                  <span style={styles.planPillCount}>{overviewMetrics?.metrics?.planCounts?.['yearly'] ?? 0}</span>
                </div>
                <div style={styles.planPill}>
                  <span style={styles.planPillTitle}>👑 Lifetime VIP ($19.99)</span>
                  <span style={styles.planPillCount}>{overviewMetrics?.metrics?.planCounts?.['lifetime'] ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Recent Tables Grid */}
            <div style={styles.twoColGrid}>
              <div style={styles.cardBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={styles.cardBoxTitle}>Recent Purchases</h3>
                  <button onClick={() => setActiveTab('purchases')} style={styles.viewAllBtn}>View All →</button>
                </div>
                {overviewMetrics?.recentPurchases?.length > 0 ? (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Customer</th>
                          <th style={styles.th}>Plan</th>
                          <th style={styles.th}>Amount</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewMetrics.recentPurchases.map((p, idx) => (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600 }}>{p.customerEmail}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                                {p.transactionId.substring(0, 16)}...
                              </div>
                            </td>
                            <td style={styles.td}>{p.plan}</td>
                            <td style={styles.td}>${p.amount} {p.currency}</td>
                            <td style={styles.td}>
                              <span style={styles.statusBadgeActive}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={styles.emptyNote}>No purchases recorded yet.</p>
                )}
              </div>

              <div style={styles.cardBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={styles.cardBoxTitle}>Recent Device Activations</h3>
                  <button onClick={() => setActiveTab('activations')} style={styles.viewAllBtn}>View All →</button>
                </div>
                {overviewMetrics?.recentActivations?.length > 0 ? (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>License Key</th>
                          <th style={styles.th}>Device ID</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewMetrics.recentActivations.map((a, idx) => (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.td}>
                              <span style={styles.monoKey}>{a.licenseKey}</span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                                {a.installationId.substring(0, 16)}...
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={styles.statusBadgeActive}>{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={styles.emptyNote}>No device activations recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: LICENSES */}
        {/* =================================================================== */}
        {activeTab === 'licenses' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>License Management</h2>
                <p style={styles.viewSubtitle}>Generate manual entitlement keys and configure device slots.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCleanTestKeys} disabled={isDeleting} style={styles.btnWarningOutline}>
                  🧹 Clean Demo Keys
                </button>
                <button onClick={handleCleanExpiredKeys} disabled={isDeleting} style={styles.btnDangerOutline}>
                  🗑️ Clean Expired
                </button>
              </div>
            </div>

            {/* Manual Generator Box */}
            <div style={styles.cardBox}>
              <h3 style={styles.cardBoxTitle}>⚡ Generate Manual License Key</h3>
              <form onSubmit={handleGenerateLicense} style={styles.genGridForm}>
                <div style={styles.formCol}>
                  <label style={styles.label}>Plan Entitlement</label>
                  <select value={genPlan} onChange={(e) => setGenPlan(e.target.value)} style={styles.select}>
                    <option value="7day">7-Day Free Trial (7 Days • 1 Device)</option>
                    <option value="30day">1 Month Pass (30 Days • 2 Devices)</option>
                    <option value="yearly">1 Year Pro (365 Days • 3 Devices)</option>
                    <option value="lifetime">Lifetime VIP (Never Expires • 5 Devices)</option>
                  </select>
                </div>

                <div style={styles.formCol}>
                  <label style={styles.label}>Max Devices Limit</label>
                  <select value={genMaxDevices} onChange={(e) => setGenMaxDevices(e.target.value)} style={styles.select}>
                    <option value="1">1 Device</option>
                    <option value="2">2 Devices</option>
                    <option value="3">3 Devices</option>
                    <option value="5">5 Devices</option>
                    <option value="10">10 Devices</option>
                  </select>
                </div>

                <div style={styles.formCol}>
                  <label style={styles.label}>Customer Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={genEmail}
                    onChange={(e) => setGenEmail(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" disabled={isGenerating} style={styles.genSubmitBtn}>
                    {isGenerating ? 'Generating...' : '⚡ Generate ARS Key'}
                  </button>
                </div>
              </form>

              {/* Generated License Result Card */}
              {generatedResult && (
                <div style={styles.keySuccessBanner}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>
                      ✔ License Key Generated Successfully:
                    </div>
                    <div style={styles.generatedKeyText}>{generatedResult.license_key}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Plan: <strong>{generatedResult.plan}</strong> • Devices: <strong>{generatedResult.max_devices}</strong>
                      {generatedResult.expires_at ? ` • Expires: ${new Date(generatedResult.expires_at).toLocaleDateString()}` : ' • Lifetime (Never Expires)'}
                      {generatedResult.email ? ` • Customer: ${generatedResult.email}` : ''}
                    </div>
                  </div>
                  <button onClick={() => copyText(generatedResult.license_key)} style={styles.copyKeyBtn}>
                    {copiedKey ? '✔ Copied!' : '📋 Copy Key'}
                  </button>
                </div>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div style={styles.searchFilterRow}>
              <input
                type="text"
                placeholder="Search by license key, email, or plan..."
                value={licenseSearch}
                onChange={(e) => setLicenseSearch(e.target.value)}
                style={styles.searchInput}
              />
              <select
                value={licensePlanFilter}
                onChange={(e) => setLicensePlanFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Plans</option>
                <option value="7day">7-Day Trial</option>
                <option value="30day">1 Month Pass</option>
                <option value="yearly">1 Year Pro</option>
                <option value="lifetime">Lifetime VIP</option>
              </select>
              <select
                value={licenseStatusFilter}
                onChange={(e) => setLicenseStatusFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
              <button onClick={fetchLicenses} style={styles.btnSecondary}>
                Search
              </button>
            </div>

            {/* Licenses Table */}
            <div style={styles.cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                  Issued Licenses ({licenses.length})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Click license key or Inspect to view device installations
                </span>
              </div>

              {licensesLoading ? (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                  <div style={styles.spinner}></div>
                  <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>Loading licenses...</p>
                </div>
              ) : licenses.length > 0 ? (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>License Key</th>
                        <th style={styles.th}>Plan</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Devices</th>
                        <th style={styles.th}>Customer</th>
                        <th style={styles.th}>Expiration</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenses.map((lic) => (
                        <tr key={lic.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={styles.monoKey}>{lic.license_key}</span>
                              <button
                                onClick={() => copyText(lic.license_key)}
                                style={styles.miniCopyBtn}
                                title="Copy key"
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.planBadge}>{lic.plan}</span>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={
                                lic.status === 'active'
                                  ? styles.statusBadgeActive
                                  : lic.status === 'revoked'
                                  ? styles.statusBadgeRevoked
                                  : styles.statusBadgeExpired
                              }
                            >
                              {lic.status}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontWeight: 600 }}>
                              {lic.activeDevices || 0} / {lic.device_limit || lic.max_devices || 1}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '13px', color: lic.email ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                              {lic.email || '—'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px' }}>
                              {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Lifetime (Never)'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setInspectLicense(lic)}
                                style={styles.actionBtnInspect}
                                title="View active devices"
                              >
                                Devices
                              </button>
                              <button
                                onClick={() => handleToggleLicenseStatus(lic)}
                                style={lic.status === 'active' ? styles.actionBtnRevoke : styles.actionBtnReactivate}
                              >
                                {lic.status === 'active' ? 'Revoke' : 'Reactivate'}
                              </button>
                              <button
                                onClick={() => handleDeleteLicense(lic)}
                                style={styles.actionBtnDelete}
                                title="Delete license permanently"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={styles.emptyNote}>No licenses match the current query.</p>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: PURCHASES */}
        {/* =================================================================== */}
        {activeTab === 'purchases' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>Purchase Verification</h2>
                <p style={styles.viewSubtitle}>Authoritative payment records verified from Paddle webhooks.</p>
              </div>
              <button onClick={fetchPurchases} style={styles.refreshBtn} disabled={purchasesLoading}>
                {purchasesLoading ? '↻ Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>

            {/* Filter Bar */}
            <div style={styles.searchFilterRow}>
              <input
                type="text"
                placeholder="Search transaction ID, customer email, or key..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                style={styles.searchInput}
              />
              <select
                value={purchasePlanFilter}
                onChange={(e) => setPurchasePlanFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Plans</option>
                <option value="30day">1 Month Pass</option>
                <option value="yearly">1 Year Pro</option>
                <option value="lifetime">Lifetime VIP</option>
                <option value="7day">7-Day Free Trial</option>
              </select>
              <select
                value={purchaseStatusFilter}
                onChange={(e) => setPurchaseStatusFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed / Paid</option>
                <option value="refunded">Refunded</option>
                <option value="canceled">Canceled</option>
              </select>
              <button onClick={fetchPurchases} style={styles.btnSecondary}>Search</button>
            </div>

            <div style={styles.cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                  Recorded Purchases ({purchases.length})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Card numbers and CVV are never stored or exposed.
                </span>
              </div>

              {purchasesLoading ? (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                  <div style={styles.spinner}></div>
                </div>
              ) : purchases.length > 0 ? (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Transaction Reference</th>
                        <th style={styles.th}>Customer Email</th>
                        <th style={styles.th}>Plan</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Issued License Key</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fff' }}>
                              {p.transactionId}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontWeight: 500 }}>{p.customerEmail}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.planBadge}>{p.plan}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontWeight: 700 }}>
                              ${p.amount.toFixed(2)} {p.currency}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={p.status === 'completed' || p.status === 'paid' ? styles.statusBadgeActive : styles.statusBadgeRevoked}>
                              {p.status}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString() : '—'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {p.licenseKey ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={styles.monoKey}>{p.licenseKey}</span>
                                <button onClick={() => copyText(p.licenseKey)} style={styles.miniCopyBtn}>📋</button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={styles.emptyNote}>No purchases match the selected filter.</p>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: ACTIVATIONS */}
        {/* =================================================================== */}
        {activeTab === 'activations' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>Device Activations</h2>
                <p style={styles.viewSubtitle}>Inspect and manage active Chrome extension installations per license.</p>
              </div>
              <button onClick={fetchActivations} style={styles.refreshBtn} disabled={activationsLoading}>
                {activationsLoading ? '↻ Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>

            <div style={styles.searchFilterRow}>
              <input
                type="text"
                placeholder="Search by license key or installation ID..."
                value={activationSearch}
                onChange={(e) => setActivationSearch(e.target.value)}
                style={styles.searchInput}
              />
              <select
                value={activationStatusFilter}
                onChange={(e) => setActivationStatusFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>
              <button onClick={fetchActivations} style={styles.btnSecondary}>Search</button>
            </div>

            <div style={styles.cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                  Registered Installations ({activations.length})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Zero invasive fingerprinting. Pure installation identifiers.
                </span>
              </div>

              {activationsLoading ? (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                  <div style={styles.spinner}></div>
                </div>
              ) : activations.length > 0 ? (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>License Key</th>
                        <th style={styles.th}>Plan</th>
                        <th style={styles.th}>Installation Identifier</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Activated At</th>
                        <th style={styles.th}>Last Verification</th>
                        <th style={styles.th}>Reset Slot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activations.map((act) => (
                        <tr key={act.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={styles.monoKey}>{act.licenseKey}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.planBadge}>{act.plan}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {act.installationId.length > 20 ? `${act.installationId.substring(0, 18)}...` : act.installationId}
                              </span>
                              <button onClick={() => copyText(act.installationId)} style={styles.miniCopyBtn} title="Copy ID">
                                📋
                              </button>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={act.status === 'active' ? styles.statusBadgeActive : styles.statusBadgeExpired}>
                              {act.status}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px' }}>
                              {act.activatedAt ? new Date(act.activatedAt).toLocaleDateString() : '—'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {act.lastSeenAt ? new Date(act.lastSeenAt).toLocaleString() : '—'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => handleDeactivateSlot(act.id, act.installationId)}
                              style={styles.actionBtnResetSlot}
                              title="Free this slot so user can activate a new computer"
                            >
                              Reset Slot
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={styles.emptyNote}>No device activations found.</p>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: PRODUCTS & PLANS */}
        {/* =================================================================== */}
        {activeTab === 'products' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>Products & Plans Catalog</h2>
                <p style={styles.viewSubtitle}>Entitlement terms and Paddle Price ID bindings.</p>
              </div>
            </div>

            <div style={styles.productsGrid}>
              {products.map((prod) => (
                <div key={prod.id} style={styles.productCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={styles.planBadge}>{prod.badge}</span>
                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>● {prod.status}</span>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>{prod.name}</h3>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent)', marginBottom: '8px' }}>
                    {prod.price}
                  </div>

                  <div style={styles.productDivider}></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>Duration: <strong>{prod.duration}</strong></div>
                    <div>Concurrent Devices: <strong>{prod.maxDevices} Device Limit</strong></div>
                    <div>Payment Model: <strong>{prod.billingType || 'Free trial (Zero payment)'}</strong></div>
                    <div>Paddle Price ID:</div>
                    <code style={styles.codeSnippet}>{prod.paddlePriceId}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: SETTINGS */}
        {/* =================================================================== */}
        {activeTab === 'settings' && (
          <div>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.viewTitle}>Server Environment Settings</h2>
                <p style={styles.viewSubtitle}>Configuration audit for Paddle, Supabase, and Administrator Authorization.</p>
              </div>
            </div>

            <div style={styles.cardBox}>
              <h3 style={styles.cardBoxTitle}>🔒 Security & Authorization Checklist</h3>
              <div style={styles.checklistGrid}>
                <div style={styles.checkItem}>
                  <span style={{ color: 'var(--success)', fontSize: '18px' }}>✔</span>
                  <div>
                    <strong>Admin Route Protection</strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      All admin endpoints enforce server-validated authentication tokens.
                    </p>
                  </div>
                </div>

                <div style={styles.checkItem}>
                  <span style={{ color: 'var(--success)', fontSize: '18px' }}>✔</span>
                  <div>
                    <strong>ADMIN_EMAILS Allowlist</strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Non-admin Supabase accounts receive strict HTTP 403 Forbidden.
                    </p>
                  </div>
                </div>

                <div style={styles.checkItem}>
                  <span style={{ color: 'var(--success)', fontSize: '18px' }}>✔</span>
                  <div>
                    <strong>Supabase Row Level Security (RLS)</strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Public anon access is blocked. Privileged service key stays strictly server-side.
                    </p>
                  </div>
                </div>

                <div style={styles.checkItem}>
                  <span style={{ color: 'var(--success)', fontSize: '18px' }}>✔</span>
                  <div>
                    <strong>Paddle Webhook Idempotency</strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      HMAC-SHA256 signature checked. Re-sent webhooks cannot create duplicate purchases.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.cardBox}>
              <h3 style={styles.cardBoxTitle}>📋 Required Vercel Environment Variables</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Ensure these keys are configured in your Vercel Project Settings → Environment Variables:
              </p>
              <div style={styles.envTable}>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>ADMIN_API_KEY</code>
                  <span style={styles.envDesc}>Private secret password for Master Admin login.</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>ADMIN_EMAILS</code>
                  <span style={styles.envDesc}>Comma-separated list of authorized admin emails for Supabase login.</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_ENV</code>
                  <span style={styles.envDesc}>Set to &apos;sandbox&apos; for testing, or &apos;production&apos; for live payments.</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_CLIENT_TOKEN</code>
                  <span style={styles.envDesc}>Starts with &apos;test_&apos; in Sandbox, or &apos;live_&apos; in Production.</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_WEBHOOK_SECRET</code>
                  <span style={styles.envDesc}>Destination secret from Paddle Dashboard → Notifications.</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_PRICE_MONTHLY</code>
                  <span style={styles.envDesc}>Paddle Price ID for 1 Month Pass ($1.49). Starts with pri_</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_PRICE_YEARLY</code>
                  <span style={styles.envDesc}>Paddle Price ID for 1 Year Pro ($9.49). Starts with pri_</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>PADDLE_PRICE_LIFETIME</code>
                  <span style={styles.envDesc}>Paddle Price ID for Lifetime VIP ($19.99). Starts with pri_</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>SUPABASE_URL</code>
                  <span style={styles.envDesc}>Your Supabase Project URL (https://xyz.supabase.co).</span>
                </div>
                <div style={styles.envRow}>
                  <code style={styles.envKey}>SUPABASE_SERVICE_ROLE_KEY</code>
                  <span style={styles.envDesc}>Secret service_role key with write permissions for licenses.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Inspect License & Activations Modal */}
      {inspectLicense && (
        <div style={styles.modalOverlay} onClick={() => setInspectLicense(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>License Details</h3>
              <button onClick={() => setInspectLicense(null)} style={styles.modalCloseBtn}>✕</button>
            </div>

            <div style={styles.modalDetailBox}>
              <div>Key: <span style={styles.monoKey}>{inspectLicense.license_key}</span></div>
              <div>Plan: <strong>{inspectLicense.plan}</strong></div>
              <div>Status: <strong>{inspectLicense.status}</strong></div>
              <div>Devices: <strong>{inspectLicense.activeDevices || 0} / {inspectLicense.max_devices || 1}</strong></div>
              <div>Customer: <strong>{inspectLicense.email || 'None'}</strong></div>
              <div>Expires: <strong>{inspectLicense.expires_at ? new Date(inspectLicense.expires_at).toLocaleString() : 'Lifetime (Never)'}</strong></div>
              <div>Created: <strong>{new Date(inspectLicense.created_at).toLocaleString()}</strong></div>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '16px 0 8px' }}>
              Active Device Installations ({inspectLicense.activations?.length || 0})
            </h4>

            {inspectLicense.activations?.length > 0 ? (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Installation ID</th>
                      <th style={styles.th}>Activated</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectLicense.activations.map((a) => (
                      <tr key={a.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                            {a.installation_id || a.device_id}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '11px' }}>{new Date(a.activated_at).toLocaleDateString()}</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleDeactivateSlot(a.id, a.installation_id)}
                            style={styles.actionBtnResetSlot}
                          >
                            Reset Slot
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={styles.emptyNote}>No active devices installed on this license key.</p>
            )}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={() => setInspectLicense(null)} style={styles.btnSecondary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = {
  centerContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070b14',
    color: '#fff'
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loginWrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#070b14',
    color: '#f8fafc'
  },
  loginCard: {
    maxWidth: '460px',
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '36px',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)'
  },
  brandIcon: {
    fontSize: '36px',
    marginBottom: '12px'
  },
  loginTitle: {
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.4px',
    margin: '0 0 6px'
  },
  loginSubtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: '0 0 24px'
  },
  authTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    marginBottom: '20px'
  },
  authTab: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: 600,
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  input: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#fff',
    outline: 'none',
    width: '100%'
  },
  select: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none',
    width: '100%'
  },
  inputHint: {
    fontSize: '11px',
    color: 'var(--text-dim)'
  },
  errorNoticeBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#f87171'
  },
  primaryAuthBtn: {
    backgroundColor: 'var(--accent)',
    color: '#070b14',
    fontWeight: 700,
    fontSize: '14px',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '6px',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  securityNote: {
    marginTop: '20px',
    fontSize: '11px',
    color: 'var(--text-dim)',
    textAlign: 'center'
  },
  dashboardContainer: {
    minHeight: '100vh',
    backgroundColor: '#070b14',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column'
  },
  topBar: {
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
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
    color: '#fff'
  },
  adminBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: 'var(--accent)',
    fontSize: '10px',
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.6px'
  },
  brandSubtitle: {
    fontSize: '11px',
    color: 'var(--text-dim)'
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  onlineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)'
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tabRibbon: {
    backgroundColor: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border)',
    padding: '0 28px',
    display: 'flex',
    gap: '4px',
    overflowX: 'auto'
  },
  tabButton: {
    padding: '14px 18px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    cursor: 'pointer'
  },
  tabButtonActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)'
  },
  mainContent: {
    flex: 1,
    maxWidth: '1300px',
    width: '100%',
    margin: '0 auto',
    padding: '28px 24px'
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  viewTitle: {
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.3px',
    margin: '0 0 4px'
  },
  viewSubtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  refreshBtn: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  },
  statLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: 900,
    letterSpacing: '-1px',
    margin: '8px 0 4px',
    color: '#fff'
  },
  statSub: {
    fontSize: '11px',
    color: 'var(--text-dim)'
  },
  cardBox: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px'
  },
  cardBoxTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: '0 0 16px'
  },
  planBreakdownGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px'
  },
  planPill: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  planPillTitle: {
    fontSize: '13px',
    fontWeight: 600
  },
  planPillCount: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--accent)'
  },
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
    gap: '20px'
  },
  viewAllBtn: {
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  th: {
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid var(--border)'
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
  },
  td: {
    padding: '12px',
    fontSize: '13px'
  },
  monoKey: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '3px 6px',
    borderRadius: '4px',
    fontSize: '12px'
  },
  planBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px'
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--success)',
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '10px'
  },
  statusBadgeRevoked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '10px'
  },
  statusBadgeExpired: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--warning)',
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '10px'
  },
  genGridForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
    alignItems: 'flex-end'
  },
  formCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  genSubmitBtn: {
    width: '100%',
    backgroundColor: 'var(--accent)',
    color: '#070b14',
    fontWeight: 700,
    fontSize: '13px',
    padding: '11px 16px',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  keySuccessBanner: {
    marginTop: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap'
  },
  generatedKeyText: {
    fontFamily: 'monospace',
    fontSize: '20px',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '1px',
    marginTop: '4px'
  },
  copyKeyBtn: {
    backgroundColor: 'var(--success)',
    color: '#070b14',
    fontWeight: 700,
    fontSize: '13px',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  searchFilterRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  searchInput: {
    flex: 2,
    minWidth: '220px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '9px 14px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none'
  },
  filterSelect: {
    flex: 1,
    minWidth: '130px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none'
  },
  btnSecondary: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: '#fff',
    padding: '9px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnWarningOutline: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    color: 'var(--warning)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnDangerOutline: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#f87171',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  miniCopyBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    opacity: 0.7
  },
  actionBtnInspect: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: 'var(--accent)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  actionBtnRevoke: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  actionBtnReactivate: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: 'var(--success)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  actionBtnDelete: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'var(--text-dim)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer'
  },
  actionBtnResetSlot: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: 'var(--warning)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  emptyNote: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: '13px',
    padding: '24px 0',
    margin: 0
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px'
  },
  productCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column'
  },
  productDivider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '14px 0'
  },
  codeSnippet: {
    backgroundColor: 'var(--bg-elevated)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: 'var(--accent)',
    wordBreak: 'break-all'
  },
  checklistGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px'
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px'
  },
  envTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  envRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: '6px',
    fontSize: '12px'
  },
  envKey: {
    fontFamily: 'monospace',
    color: 'var(--accent)',
    fontWeight: 700,
    minWidth: '220px'
  },
  envDesc: {
    color: 'var(--text-secondary)'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 999
  },
  modalCard: {
    maxWidth: '560px',
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)'
  },
  modalCloseBtn: {
    color: 'var(--text-dim)',
    fontSize: '16px',
    cursor: 'pointer'
  },
  modalDetailBox: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    fontSize: '12px'
  },
  toastSuccess: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    backgroundColor: '#064e3b',
    border: '1px solid #10b981',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '10px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 1000,
    fontSize: '13px',
    fontWeight: 600
  },
  toastError: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    backgroundColor: '#7f1d1d',
    border: '1px solid #ef4444',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '10px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 1000,
    fontSize: '13px',
    fontWeight: 600
  },
  toastCloseBtn: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
    cursor: 'pointer'
  }
};
