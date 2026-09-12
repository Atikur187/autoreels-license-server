# 🚀 Complete Non-Developer Guide: Setting Up Paddle Billing for AutoReels Scroll

This guide gives you step-by-step instructions with exact click-by-click steps to connect your **Paddle Billing** account to AutoReels Scroll. No coding is required.

---

## Table of Contents
1. [Where to Create Paddle Products & Prices](#1-where-to-create-paddle-products--prices)
2. [Configuring 1 Month Pass (One-Time vs Subscription)](#2-configuring-1-month-pass-one-time-vs-subscription)
3. [Where to Put Your Paddle IDs and Secrets](#3-where-to-put-your-paddle-ids-and-secrets)
4. [How to Configure the Paddle Webhook](#4-how-to-configure-the-paddle-webhook)
5. [Supabase Database Setup](#5-supabase-database-setup)
6. [How to Test in Paddle Sandbox](#6-how-to-test-in-paddle-sandbox)
7. [How to Switch from Sandbox to Live Production](#7-how-to-switch-from-sandbox-to-live-production)

---

## 1. Where to Create Paddle Products & Prices

1. Log into your **Paddle Dashboard** (use [sandbox.paddle.com](https://sandbox.paddle.com) for testing, or [vendors.paddle.com](https://vendors.paddle.com) for live).
2. On the left navigation menu, click **Catalog** → **Products**.
3. Click the blue **+ New Product** button:
   - **Product Name**: `AutoReels Scroll`
   - **Tax Category**: `Digital Goods` (or `Standard`)
   - Click **Save Product**.

4. Inside this Product, you will create **3 Prices** (The 7-Day Free Trial does not need a price in Paddle because our website generates it directly with $0.00 and zero friction):

### Price A: 1 Month Pass ($1.49)
- Click **+ Add Price**
- **Description / Name**: `1 Month Pass`
- **Billing Cycle**:
  - For **One-Time 30-day payment**: Select `One-time`.
  - For **Monthly recurring subscription**: Select `Recurring` → `Every 1 month`.
- **Currency & Amount**: Select `USD` and enter `1.49`.
- Click **Save Price**.
- Copy the **Price ID** (looks like `pri_01h...`). This is your `PADDLE_PRICE_MONTHLY`.

### Price B: 1 Year Pro ($9.49)
- Click **+ Add Price**
- **Description / Name**: `1 Year Pro`
- **Billing Cycle**: `One-time` (or `Recurring` → `Every 1 year` if you prefer yearly renewal).
- **Currency & Amount**: Select `USD` and enter `9.49`.
- Click **Save Price**.
- Copy the **Price ID** (looks like `pri_01h...`). This is your `PADDLE_PRICE_YEARLY`.

### Price C: Lifetime VIP ($19.99)
- Click **+ Add Price**
- **Description / Name**: `Lifetime VIP`
- **Billing Cycle**: `One-time`
- **Currency & Amount**: Select `USD` and enter `19.99`.
- Click **Save Price**.
- Copy the **Price ID** (looks like `pri_01h...`). This is your `PADDLE_PRICE_LIFETIME`.

---

## 2. Configuring 1 Month Pass (One-Time vs Subscription)

In your environment settings, you have full control over whether the 1-month pass acts as a one-time 30-day ticket or a recurring monthly subscription:

- If you created a **One-Time price** in Paddle for 1 Month:
  Set `PADDLE_BILLING_TYPE_MONTHLY=onetime`
- If you created a **Recurring Monthly subscription** in Paddle for 1 Month:
  Set `PADDLE_BILLING_TYPE_MONTHLY=subscription`

---

## 3. Where to Put Your Paddle IDs and Secrets

Open your file `license-server/.env.local` (for local development) or your **Vercel Project Settings → Environment Variables** (for production):

| Variable Name | Where to Find in Paddle Dashboard | Description |
|---|---|---|
| `PADDLE_API_KEY` | **Developer Tools** → **Authentication** → **API Keys** | Secret API key (starts with `pdl_api_...`) |
| `PADDLE_WEBHOOK_SECRET` | **Developer Tools** → **Notifications** → Webhook Secret Key | Webhook secret (starts with `pdl_whsec_...`) |
| `PADDLE_ENVIRONMENT` | Set to `sandbox` for testing, or `production` for real money | Environment toggle |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | **Developer Tools** → **Authentication** → **Client-side Tokens** | Public token for frontend overlay (starts with `test_` or `live_`) |
| `PADDLE_PRICE_MONTHLY` | **Catalog** → **Prices** → 1 Month Pass | The `pri_...` ID for $1.49 |
| `PADDLE_PRICE_YEARLY` | **Catalog** → **Prices** → 1 Year Pro | The `pri_...` ID for $9.49 |
| `PADDLE_PRICE_LIFETIME` | **Catalog** → **Prices** → Lifetime VIP | The `pri_...` ID for $19.99 |
| `PADDLE_BILLING_TYPE_MONTHLY` | Set to `onetime` or `subscription` | Configures 1-month behavior |

> [!CAUTION]
> Never paste `PADDLE_API_KEY` or `PADDLE_WEBHOOK_SECRET` in frontend files or the Chrome extension! They are kept strictly on your server in environment variables.

---

## 4. How to Configure the Paddle Webhook

The webhook is the official, authoritative link that tells your server when someone finishes paying.

1. In Paddle Dashboard, go to **Developer Tools** → **Notifications** (Webhooks).
2. Click **+ New Destination**:
   - **Destination Type**: `Webhook URL`
   - **URL**:
     - For production: `https://your-website.vercel.app/api/paddle/webhook`
     - For local testing: Use ngrok or local tunnel (e.g. `https://your-tunnel.ngrok-free.app/api/paddle/webhook`)
   - **Description**: `AutoReels License Fulfillment Webhook`
3. Under **Events to receive**, check the following boxes:
   - ✅ `transaction.completed` (Crucial: Fires when customer finishes paying)
   - ✅ `transaction.paid`
   - ✅ `adjustment.updated` (Handles refunds)
   - ✅ `subscription.canceled` (Handles cancellations)
   - ✅ `subscription.updated` (Handles monthly renewals)
   - ✅ `subscription.past_due` (Handles failed card re-bills)
4. Click **Save Destination**.
5. Copy the **Webhook Secret Key** displayed (starts with `pdl_whsec_...`).
6. Paste this key into `PADDLE_WEBHOOK_SECRET` in your `.env.local` or Vercel environment settings.

---

## 5. Supabase Database Setup

If you are using Supabase for production database persistence:
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project, click **SQL Editor** on the left menu.
3. Open the file `license-server/supabase-schema.sql` located in your project, copy its entire contents, paste it into the Supabase SQL Editor, and click **Run**.
4. This will create or verify the required tables:
   - `licenses`: stores license keys, validity periods, device limits.
   - `purchases`: stores transaction IDs, customer emails, amounts, status, and mappings.
   - `activations`: stores active Chrome extension installations.
   - `customers`: stores customer emails.

---

## 6. How to Test in Paddle Sandbox

1. In `license-server/.env.local`, ensure:
   ```env
   PADDLE_ENVIRONMENT=sandbox
   NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
   ```
2. Run your server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000/pricing` in your browser.
4. Test all flows:
   - Click **Start 7-Day Free Trial**: It generates a 7-day trial key instantly without payment.
   - Click **Select 1 Month Pass ($1.49)**, **Get 1 Year Pro ($9.49)**, or **Select Lifetime VIP ($19.99)**.
   - In Paddle Sandbox Checkout, you can use Paddle's official test credit cards (e.g., card numbers starting with `4242 4242 4242 4242`, any future expiration date like `12/28`, and any CVC like `123`).
5. After payment, Paddle calls your webhook, your server generates a valid `ARS-XXXX-XXXX-XXXX` license key, and the success screen displays:
   - `Payment successful`
   - `Your AutoReels license is ready.`
   - License key with **Activate Extension** and **Copy License** buttons.

---

## 7. How to Switch from Sandbox to Live Production

When you are ready to collect real payments from customers worldwide:

1. In your **Live Paddle Dashboard** ([vendors.paddle.com](https://vendors.paddle.com)):
   - Create your 3 live prices.
   - Create your live API Key and Client Token.
   - Add your live Webhook Destination: `https://your-domain.com/api/paddle/webhook`.
2. In your production environment settings (e.g., Vercel):
   - Change `PADDLE_ENVIRONMENT=production`
   - Change `NEXT_PUBLIC_PADDLE_ENVIRONMENT=production`
   - Replace the sandbox Price IDs with your live `pri_...` IDs.
   - Replace `PADDLE_API_KEY` with your live Paddle API key.
   - Replace `PADDLE_WEBHOOK_SECRET` with your live Paddle webhook secret.
   - Replace `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` with your live client token.
3. Redeploy to Vercel.
4. Congratulations! Your AutoReels Scroll website is now fully live and accepting worldwide payments securely!
