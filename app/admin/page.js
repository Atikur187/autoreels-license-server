'use client';

import React, { useState, useEffect } from 'react';
import '../globals.css';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Licenses state
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [notification, setNotification] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Generator state
  const [genPlan, setGenPlan] = useState('lifetime');
  const [genMaxDevices, setGenMaxDevices] = useState(1);
  const [genEmail, setGenEmail] = useState('');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Activations modal
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const savedKey = typeof window !== 'undefined' ? sessionStorage.getItem('ars_admin_key') : null;
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
      fetchLicenses(savedKey);
    }
  }, []);

  const showNotice = (msg, type = 'success') => {
    setNotification({ type, message: msg });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === msg ? null : curr));
    }, 4500);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    const clean = keyInput.trim();
    setAdminKey(clean);
    sessionStorage.setItem('ars_admin_key', clean);
    setIsAuthenticated(true);
    setAuthError('');
    fetchLicenses(clean);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ars_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
    setLicenses([]);
    setSelectedIds(new Set());
    setGeneratedResult(null);
    setNotification(null);
  };

  const fetchLicenses = async (key = adminKey) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        headers: { 'x-admin-key': key }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAuthError('Unauthorized: Invalid Admin Key.');
          setIsAuthenticated(false);
          sessionStorage.removeItem('ars_admin_key');
        } else {
          setAuthError(data.error || 'Failed to load licenses.');
        }
        setLoading(false);
        return;
      }
      const fetched = data.licenses || [];
      setLicenses(fetched);
      setSelectedIds((prev) => {
        const next = new Set();
        const validIds = new Set(fetched.map((l) => l.id));
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      setAuthError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setActionMessage('');
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          plan: genPlan,
          maxDevices: parseInt(genMaxDevices, 10),
          customerEmail: genEmail.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to generate license.');
        return;
      }
      setGeneratedResult(data.license);
      setCopiedKey(false);
      showNotice(`License ${data.license.license_key} generated successfully!`);
      fetchLicenses();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleStatus = async (lic) => {
    const nextStatus = lic.status === 'active' ? 'revoked' : 'active';
    const confirmMsg = nextStatus === 'revoked'
      ? `Revoke license ${lic.license_key}? Any active devices will immediately lose premium.`
      : `Reactivate license ${lic.license_key}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/licenses/${lic.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showNotice(`License ${lic.license_key} marked as ${nextStatus}.`);
        fetchLicenses();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update status.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteLicense = async (lic) => {
    const confirmMsg = `⚠️ Delete License Permanently?\n\nKey: ${lic.license_key}\nPlan: ${lic.plan}\n\nThis will remove the license from your database and disconnect any active devices immediately.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/licenses/${lic.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(`License ${lic.license_key} has been permanently deleted.`);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(lic.id);
          return next;
        });
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to delete license.');
      }
    } catch (err) {
      alert('Error deleting license: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!window.confirm(`⚠️ Permanently DELETE ${count} selected license(s)?\n\nThis cannot be undone and will free up your list.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(`Successfully deleted ${count} selected license(s).`);
        setSelectedIds(new Set());
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to delete selected licenses.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCleanTestKeys = async () => {
    const testCount = licenses.filter((l) => l.license_key && l.license_key.startsWith('TEST-ARS-')).length;
    if (testCount === 0) {
      alert('No demo/test keys found.');
      return;
    }

    if (!window.confirm(`🧹 Clean up all ${testCount} demo test keys (TEST-ARS-*)?\n\nReal customer and purchased licenses will NOT be touched.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ type: 'test' })
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(data.message || `Deleted ${testCount} demo keys.`);
        setSelectedIds(new Set());
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to clean test keys.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCleanExpired = async () => {
    const now = new Date();
    const expCount = licenses.filter((l) => l.status === 'expired' || (l.expires_at && new Date(l.expires_at) < now)).length;
    if (expCount === 0) {
      alert('No expired licenses found.');
      return;
    }

    if (!window.confirm(`🗑️ Delete all ${expCount} expired license(s)?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ type: 'expired' })
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(data.message || `Deleted ${expCount} expired licenses.`);
        setSelectedIds(new Set());
        fetchLicenses();
      } else {
        alert(data.error || 'Failed to delete expired licenses.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivateDevice = async (activationId, installationId) => {
    if (!window.confirm(`Deactivate device installation "${installationId.substring(0, 12)}..."?`)) return;

    try {
      const res = await fetch('/api/admin/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ activationId })
      });
      if (res.ok) {
        if (selectedLicense) {
          const updatedActs = (selectedLicense.activations || []).filter((a) => a.id !== activationId);
          setSelectedLicense({ ...selectedLicense, activations: updatedActs, activeDevices: updatedActs.length });
        }
        showNotice('Device deactivated successfully.');
        fetchLicenses();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to deactivate device.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const filteredLicenses = licenses.filter((lic) => {
    if (statusFilter && lic.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        lic.license_key.toLowerCase().includes(q) ||
        lic.plan.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredLicenses.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalLicenses = licenses.length;
  const activeLicenses = licenses.filter((l) => l.status === 'active').length;
  const activeDevices = licenses.reduce((sum, l) => sum + (l.activeDevices || 0), 0);
  const testKeysCount = licenses.filter((l) => l.license_key && l.license_key.startsWith('TEST-ARS-')).length;
  const now = new Date();
  const expiredCount = licenses.filter((l) => l.status === 'expired' || (l.expires_at && new Date(l.expires_at) < now)).length;

  // -------------------------------------------------------------------------
  // Render: Login Screen
  // -------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div style={styles.loginWrapper}>
        <div style={styles.loginCard}>
          <div style={styles.brandIcon}>🔒</div>
          <h1 style={styles.loginTitle}>AutoReels Admin</h1>
          <p style={styles.loginSubtitle}>Enter your private administrative secret key to access license management.</p>

          <form onSubmit={handleLogin} style={styles.loginForm}>
            <input
              type="password"
              placeholder="Admin API Key..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={styles.input}
              autoFocus
            />
            {authError && <div style={styles.errorBanner}>{authError}</div>}
            <button type="submit" style={styles.btnPrimary}>
              Access Dashboard
            </button>
          </form>

          <p style={styles.hint}>
            Configured via <code className="mono">ADMIN_API_KEY</code> environment variable.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Main Dashboard
  // -------------------------------------------------------------------------
  return (
    <div style={styles.container}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          <span style={styles.navLogo}>🎬</span>
          <div>
            <h1 style={styles.navTitle}>AutoReels Scroll — License Admin</h1>
            <span style={styles.navSub}>Production Entitlement Control Center</span>
          </div>
        </div>
        <div style={styles.navActions}>
          <button onClick={() => fetchLicenses()} style={styles.btnSecondary} title="Refresh records">
            ↻ Refresh
          </button>
          <button onClick={handleLogout} style={styles.btnDangerOutline}>
            Logout
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <section style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Total Licenses</span>
          <span style={styles.metricValue}>{totalLicenses}</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Active Licenses</span>
          <span style={{ ...styles.metricValue, color: 'var(--success)' }}>{activeLicenses}</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Active Device Activations</span>
          <span style={{ ...styles.metricValue, color: 'var(--accent)' }}>{activeDevices}</span>
        </div>
      </section>

      {/* Generator Section */}
      <section style={styles.card}>
        <h2 style={styles.sectionHeading}>Generate New License</h2>
        <form onSubmit={handleGenerate} style={styles.genForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Plan</label>
            <select value={genPlan} onChange={(e) => setGenPlan(e.target.value)} style={styles.select}>
              <option value="lifetime">Lifetime (No Expiry)</option>
              <option value="yearly">1 Year</option>
              <option value="90day">90 Days</option>
              <option value="30day">30 Days</option>
              <option value="7day">7-Day Trial</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Max Devices</label>
            <select value={genMaxDevices} onChange={(e) => setGenMaxDevices(e.target.value)} style={styles.select}>
              <option value="1">1 Device (Standard)</option>
              <option value="2">2 Devices</option>
              <option value="3">3 Devices</option>
              <option value="5">5 Devices</option>
              <option value="10">10 Devices</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Email (Optional)</label>
            <input
              type="email"
              placeholder="customer@example.com"
              value={genEmail}
              onChange={(e) => setGenEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={{ ...styles.formGroup, alignSelf: 'flex-end' }}>
            <button type="submit" disabled={isGenerating} style={styles.btnPrimary}>
              {isGenerating ? 'Generating...' : '⚡ Generate Key'}
            </button>
          </div>
        </form>

        {/* Output Banner */}
        {generatedResult && (
          <div style={styles.generatedBanner}>
            <div>
              <span style={styles.bannerLabel}>License Generated Successfully:</span>
              <div style={styles.bannerKey}>{generatedResult.license_key}</div>
              <div style={styles.bannerMeta}>
                Plan: <strong>{generatedResult.plan}</strong> • Max Devices: <strong>{generatedResult.max_devices}</strong>
                {generatedResult.expires_at ? ` • Expires: ${new Date(generatedResult.expires_at).toLocaleDateString()}` : ' • Lifetime'}
              </div>
            </div>
            <button onClick={() => copyToClipboard(generatedResult.license_key)} style={styles.btnCopy}>
              {copiedKey ? '✔ Copied!' : 'Copy Key'}
            </button>
          </div>
        )}
      </section>

      {/* Licenses Table Section */}
      <section style={styles.card}>
        {/* Notification Banner */}
        {notification && (
          <div style={notification.type === 'error' ? styles.errorNotice : styles.successNotice}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} style={styles.noticeCloseBtn} title="Dismiss">✕</button>
          </div>
        )}

        <div style={styles.tableHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={styles.sectionHeading}>Issued Licenses ({filteredLicenses.length})</h2>
            {testKeysCount > 0 && (
              <button
                type="button"
                onClick={handleCleanTestKeys}
                disabled={isDeleting}
                style={styles.btnCleanTest}
                title="Permanently remove all sample demo test keys (TEST-ARS-*)"
              >
                🧹 Clean Demo Keys ({testKeysCount})
              </button>
            )}
            {expiredCount > 0 && (
              <button
                type="button"
                onClick={handleCleanExpired}
                disabled={isDeleting}
                style={styles.btnCleanExpired}
                title="Permanently delete all expired licenses"
              >
                🗑️ Clean Expired ({expiredCount})
              </button>
            )}
          </div>

          <div style={styles.filterControls}>
            <input
              type="text"
              placeholder="Search by license key or plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...styles.input, width: '240px' }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Banner */}
        {selectedIds.size > 0 && (
          <div style={styles.bulkActionBar}>
            <div style={styles.bulkInfo}>
              <span style={styles.bulkBadge}>{selectedIds.size}</span>
              <span>license{selectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                style={styles.btnBulkDelete}
              >
                {isDeleting ? 'Deleting...' : `🗑️ Delete Selected (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={styles.btnDeselect}
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={styles.loadingState}>Loading license inventory...</div>
        ) : filteredLicenses.length === 0 ? (
          <div style={styles.emptyState}>No matching licenses found.</div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thCheck}>
                    <input
                      type="checkbox"
                      checked={filteredLicenses.length > 0 && selectedIds.size === filteredLicenses.length}
                      onChange={handleSelectAll}
                      title="Select / Deselect all visible licenses"
                      style={styles.checkbox}
                    />
                  </th>
                  <th style={styles.th}>License Key</th>
                  <th style={styles.th}>Plan</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Devices</th>
                  <th style={styles.th}>Expires</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLicenses.map((lic) => {
                  const isExp = lic.expires_at && new Date(lic.expires_at) < new Date();
                  const displayStatus = isExp ? 'expired' : lic.status;
                  const isSelected = selectedIds.has(lic.id);
                  return (
                    <tr
                      key={lic.id}
                      style={
                        isSelected
                          ? { ...styles.tr, backgroundColor: 'rgba(56, 189, 248, 0.08)' }
                          : styles.tr
                      }
                    >
                      <td style={styles.tdCheck}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(lic.id)}
                          style={styles.checkbox}
                        />
                      </td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lic.license_key)}
                          style={styles.keyButton}
                          title="Click to copy key"
                        >
                          <span className="mono">{lic.license_key}</span>
                          <span style={styles.copyIcon}>📋</span>
                        </button>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.planBadge}>{lic.plan}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(displayStatus)}>
                          {displayStatus.toUpperCase()}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() => setSelectedLicense(lic)}
                          style={styles.devicePill}
                          title="View activated devices"
                        >
                          {lic.activeDevices || 0} / {lic.max_devices}
                          <span style={{ fontSize: '11px', marginLeft: '4px' }}>🔍</span>
                        </button>
                      </td>
                      <td style={styles.td}>
                        {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={styles.td}>
                        {new Date(lic.created_at).toLocaleDateString()}
                      </td>
                      <td style={styles.tdRight}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lic)}
                            style={lic.status === 'active' ? styles.btnRevoke : styles.btnReactivate}
                            title={lic.status === 'active' ? 'Revoke license access' : 'Reactivate license access'}
                          >
                            {lic.status === 'active' ? 'Revoke' : 'Reactivate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLicense(lic)}
                            style={styles.btnDelete}
                            title="Permanently delete this license"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activations Detail Modal */}
      {selectedLicense && (
        <div style={styles.modalOverlay} onClick={() => setSelectedLicense(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Device Activations</h3>
                <span className="mono" style={{ color: 'var(--accent)', fontSize: '13px' }}>
                  {selectedLicense.license_key}
                </span>
              </div>
              <button onClick={() => setSelectedLicense(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Active devices: <strong>{selectedLicense.activations?.length || 0}</strong> of <strong>{selectedLicense.max_devices}</strong> maximum.
              </div>

              {!selectedLicense.activations || selectedLicense.activations.length === 0 ? (
                <div style={styles.emptyState}>No devices currently activated on this key.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedLicense.activations.map((act) => (
                    <div key={act.id} style={styles.actCard}>
                      <div>
                        <div className="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                          ID: {act.installation_id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Activated: {new Date(act.activated_at).toLocaleString()} • Last seen: {new Date(act.last_seen_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeactivateDevice(act.id, act.installation_id)}
                        style={styles.btnDangerSm}
                      >
                        Deactivate Device
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusBadgeStyle(status) {
  const base = {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px'
  };

  if (status === 'active') {
    return { ...base, backgroundColor: 'var(--success-bg)', color: 'var(--success)' };
  } else if (status === 'expired') {
    return { ...base, backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' };
  }
  return { ...base, backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' };
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  loginWrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  loginCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '36px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
  },
  brandIcon: {
    fontSize: '36px',
    marginBottom: '12px'
  },
  loginTitle: {
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '8px'
  },
  loginSubtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '24px'
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid var(--border)'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  navLogo: {
    fontSize: '28px'
  },
  navTitle: {
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.3px'
  },
  navSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  navActions: {
    display: 'flex',
    gap: '10px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px'
  },
  metricCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  metricLabel: {
    fontSize: '12px',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    fontWeight: 600,
    letterSpacing: '0.5px'
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: 700
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px'
  },
  sectionHeading: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '18px',
    color: 'var(--text-primary)'
  },
  genForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    alignItems: 'center'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)'
  },
  input: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none'
  },
  select: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  btnPrimary: {
    backgroundColor: 'var(--accent)',
    color: '#04111d',
    fontWeight: 600,
    padding: '10px 18px',
    borderRadius: '8px',
    transition: 'background-color 0.15s'
  },
  btnSecondary: {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '13px'
  },
  btnDangerOutline: {
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--border)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '13px'
  },
  btnDangerSm: {
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600
  },
  generatedBanner: {
    marginTop: '20px',
    padding: '16px 20px',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid var(--accent)',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bannerLabel: {
    fontSize: '12px',
    color: 'var(--accent)',
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  bannerKey: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#fff',
    margin: '4px 0'
  },
  bannerMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  btnCopy: {
    backgroundColor: 'var(--accent)',
    color: '#04111d',
    padding: '10px 16px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '13px'
  },
  tableHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px'
  },
  filterControls: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  tableResponsive: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  thCheck: {
    padding: '12px 10px',
    borderBottom: '1px solid var(--border)',
    width: '40px',
    textAlign: 'center'
  },
  th: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.5px'
  },
  thRight: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.5px',
    textAlign: 'right'
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s'
  },
  tdCheck: {
    padding: '12px 10px',
    width: '40px',
    textAlign: 'center'
  },
  checkbox: {
    cursor: 'pointer',
    width: '15px',
    height: '15px',
    accentColor: 'var(--accent)'
  },
  td: {
    padding: '12px 14px',
    color: 'var(--text-primary)'
  },
  tdRight: {
    padding: '12px 14px',
    textAlign: 'right'
  },
  keyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 600
  },
  copyIcon: {
    fontSize: '12px',
    opacity: 0.7
  },
  planBadge: {
    textTransform: 'capitalize',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)'
  },
  devicePill: {
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: 600
  },
  btnRevoke: {
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: 'var(--danger)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnReactivate: {
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--success-bg)',
    border: '1px solid rgba(34, 197, 94, 0.25)',
    color: 'var(--success)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnDelete: {
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease'
  },
  btnCleanTest: {
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    color: '#facc15',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px'
  },
  btnCleanExpired: {
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px'
  },
  bulkActionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    marginBottom: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '8px'
  },
  bulkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  bulkBadge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    borderRadius: '10px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700
  },
  btnBulkDelete: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnDeselect: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  successNotice: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#22c55e',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  noticeCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    maxWidth: '560px',
    width: '100%',
    padding: '24px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 700
  },
  closeBtn: {
    fontSize: '18px',
    color: 'var(--text-dim)',
    padding: '4px 8px'
  },
  actCard: {
    padding: '12px 14px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  loadingState: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-dim)'
  },
  emptyState: {
    padding: '30px',
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: '13px'
  },
  errorBanner: {
    padding: '10px',
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger)',
    borderRadius: '8px',
    fontSize: '12px'
  },
  hint: {
    marginTop: '16px',
    fontSize: '11px',
    color: 'var(--text-dim)'
  }
};
