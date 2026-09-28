/**
 * AutoReels Scroll — Customer Email Delivery Service
 * Sends clean, professional HTML emails upon successful payment and license generation.
 * 
 * Supports:
 * - Resend API (via RESEND_API_KEY)
 * - Extensible for SendGrid, Postmark, or custom SMTP
 * 
 * Safe fallback: If email API credentials are not set, logs a clear notification
 * without interrupting the webhook or license issuance flow.
 */

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = (process.env.EMAIL_FROM || 'AutoReels <licenses@autoreels.app>').trim();

/**
 * Sends the license activation email to the customer.
 * 
 * @param {object} params
 * @param {string} params.to - Customer email address
 * @param {string} params.licenseKey - Formatted license key (e.g. AR-XXXX-XXXX-XXXX)
 * @param {string} params.planName - Display name of plan (e.g. "1 Year Pro")
 * @param {string|null} params.expiresAt - Expiration ISO string or null for Lifetime
 * @param {number} params.deviceLimit - Allowed concurrent devices
 * @param {string} [params.transactionId] - Paddle Transaction ID
 * @returns {Promise<{ success: boolean, messageId?: string, skipped?: boolean, error?: string }>}
 */
export async function sendLicenseEmail({ to, licenseKey, planName, expiresAt, deviceLimit, transactionId }) {
  if (!to || !to.includes('@')) {
    console.warn('[EMAIL] Skipped: Invalid customer email address provided:', to);
    return { success: false, error: 'Invalid recipient email' };
  }

  const expiryDisplay = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Lifetime VIP (Never Expires)';

  const subject = `Your AutoReels Premium License: ${licenseKey}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AutoReels Premium Activated</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d18; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070d18; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0c1524; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 36px; box-shadow: 0 16px 36px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="font-size: 38px; line-height: 1;">🎬</div>
              <h1 style="margin: 12px 0 6px; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">AutoReels Premium Activated 🎉</h1>
              <p style="margin: 0; font-size: 14px; color: #38bdf8; font-weight: 600;">Thank you for your purchase!</p>
            </td>
          </tr>

          <!-- License Box -->
          <tr>
            <td style="background-color: #040913; border: 1px solid #38bdf8; border-radius: 10px; padding: 18px; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; font-weight: 600;">Your License Key</div>
              <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">
                ${licenseKey}
              </div>
            </td>
          </tr>

          <!-- Details Table -->
          <tr>
            <td style="padding: 24px 0 16px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 13px; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="color: #94a3b8;">Plan</td>
                  <td align="right" style="font-weight: 600; color: #ffffff;">${planName}</td>
                </tr>
                <tr>
                  <td style="color: #94a3b8;">Device Limit</td>
                  <td align="right" style="font-weight: 600; color: #ffffff;">${deviceLimit} Devices</td>
                </tr>
                <tr>
                  <td style="color: #94a3b8;">Expiry Date</td>
                  <td align="right" style="font-weight: 600; color: #ffffff;">${expiryDisplay}</td>
                </tr>
                ${transactionId ? `
                <tr>
                  <td style="color: #94a3b8;">Transaction ID</td>
                  <td align="right" style="font-family: monospace; font-size: 11px; color: #94a3b8;">${transactionId}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Activation Steps -->
          <tr>
            <td style="background-color: rgba(255,255,255,0.03); border-radius: 10px; padding: 18px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="font-weight: 700; font-size: 14px; color: #38bdf8; margin-bottom: 10px;">
                🚀 Quick Activation Instructions:
              </div>
              <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
                <li>Open Google Chrome and locate the <strong>AutoReels Scroll</strong> extension icon in your toolbar.</li>
                <li>Click the extension icon to open the settings popup.</li>
                <li>Paste your license key <code>${licenseKey}</code> into the <strong>License Key</strong> input box.</li>
                <li>Click <strong>Activate</strong> — instant unlimited hands-free auto-scrolling is unlocked!</li>
              </ol>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 28px; font-size: 12px; color: #64748b; line-height: 1.5;">
              Questions or need assistance? Reply directly to this email or visit our website.<br>
              © 2026 AutoReels Scroll. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // 1. If RESEND_API_KEY is configured, dispatch via Resend REST API
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [to],
          subject,
          html: htmlContent
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('[EMAIL] Resend API error:', resData);
        return { success: false, error: resData?.message || 'Resend delivery failed' };
      }

      console.log(`[EMAIL] Sent license key email to ${to} (Message ID: ${resData?.id})`);
      return { success: true, messageId: resData?.id };
    } catch (err) {
      console.error('[EMAIL] Dispatch exception:', err);
      return { success: false, error: err.message };
    }
  }

  // 2. Safe Fallback when RESEND_API_KEY is not yet added in environment
  console.log(`[EMAIL] Notice: RESEND_API_KEY is not configured. Email to ${to} logged for delivery:`);
  console.log(`  -> License: ${licenseKey}, Plan: ${planName}, Devices: ${deviceLimit}`);
  return { success: true, skipped: true, note: 'Configure RESEND_API_KEY in environment for live email dispatch.' };
}
