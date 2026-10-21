# AutoReels Scroll — Next.js 14 License & Lemon Squeezy Payment Server

Production URL: `https://autoreels-license-server.vercel.app`

## ✨ Features
- **Official Lemon Squeezy API v1 Integration**: Hosted checkouts using the official JSON:API schema.
- **Cryptographic Webhook Verification**: Timing-safe HMAC-SHA256 signature verification over raw request body.
- **Idempotent Fulfillment**: Guarantees zero duplicate purchases or licenses on webhook retries via unique event constraints.
- **Strict Mode Separation**: Completely isolated Test Mode and Live Mode configuration. Test orders are strictly rejected on Live servers.
- **Zero Frontend Secrets**: Sensitive API keys and webhook secrets remain exclusively on the server.
- **Secure Customer Claim**: Single-use token flow delivers the ARS license to the customer immediately without exposing license keys in public URLs.
- **Entitlement Revocation**: Automated revocation of license keys upon Lemon Squeezy order refunds.
- **Admin Panel**: Authenticated audit dashboard for purchases, licenses, device activations, and webhook events.
- **Preserved Chrome Extension Compatibility**: Zero changes needed in the extension video scrolling automation.

---

## 🛠 Local Development & Testing

Run the automated 12-section test suite:
```bash
node scripts/test-lemonsqueezy-flow.js
```

Run the local development server:
```bash
npm run dev
```

Build production bundle:
```bash
npm run build
```

---

## 🔑 Environment Variables (.env.local / Vercel)

```env
LEMON_SQUEEZY_MODE=test
LEMON_SQUEEZY_API_KEY=your_api_key_here
LEMON_SQUEEZY_STORE_ID=your_store_id_here
LEMON_SQUEEZY_VARIANT_MONTHLY=your_monthly_variant_id
LEMON_SQUEEZY_VARIANT_YEARLY=your_yearly_variant_id
LEMON_SQUEEZY_VARIANT_LIFETIME=your_lifetime_variant_id
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_supabase_service_role_secret
APP_BASE_URL=https://autoreels-license-server.vercel.app
ADMIN_API_KEY=your_private_admin_password
```

---

## ⚡ Webhook Configuration (Lemon Squeezy Dashboard)

1. Navigate to **Settings → Webhooks** in your Lemon Squeezy dashboard.
2. Click **+ New Webhook**.
3. **URL**: `https://autoreels-license-server.vercel.app/api/lemonsqueezy/webhook`
4. **Secret**: Enter your signing secret (must match `LEMON_SQUEEZY_WEBHOOK_SECRET`).
5. **Events**:
   - `order_created`
   - `order_refunded`
6. Click **Save Webhook**.
