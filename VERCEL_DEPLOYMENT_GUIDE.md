# AutoReels License Server & Admin Panel — Vercel Deployment Guide

This guide explains step-by-step how to deploy this repository to **Vercel** and access the **Admin Panel**.

---

## 1. GitHub Repository
Your repository is hosted on GitHub at:
`https://github.com/Atikur187/autoreels-license-server.git`

The repository already contains the complete Next.js license server, Paddle billing integration, and the private Admin Panel at `/admin`.

---

## 2. Deploying on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `Atikur187/autoreels-license-server`.
4. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (Default)
   - **Build Command**: `next build` (Default)
   - **Output Directory**: `.next` (Default)

---

## 3. Environment Variables (Required in Vercel)

Under **Environment Variables** in your Vercel project settings, add the following variables (copy values from your local `.env.local`):

### 🛡️ Admin Panel Security
| Variable | Value / Description |
|---|---|
| `ADMIN_API_KEY` | `admin-secret-key-change-in-production` *(or your custom secret key)* |
| `ADMIN_EMAILS` | `atikurtohman483@gmail.com` *(optional allowlist for email login)* |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` |

### 🗄️ Database (Supabase)
| Variable | Value |
|---|---|
| `SUPABASE_URL` | *(Copy from your .env.local SUPABASE_URL)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Copy from your .env.local SUPABASE_SERVICE_ROLE_KEY)* |

### 💳 Paddle Payments
| Variable | Value |
|---|---|
| `PADDLE_ENV` | `sandbox` *(or `production` for live payments)* |
| `PADDLE_ENVIRONMENT` | `sandbox` |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | `sandbox` |
| `PADDLE_CLIENT_TOKEN` | *(Copy from your .env.local PADDLE_CLIENT_TOKEN)* |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | *(Copy from your .env.local NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)* |
| `PADDLE_API_KEY` | *(Copy from your .env.local PADDLE_API_KEY)* |
| `PADDLE_WEBHOOK_SECRET` | *(Copy from your .env.local PADDLE_WEBHOOK_SECRET)* |
| `PADDLE_BILLING_TYPE_MONTHLY` | `onetime` |
| `PADDLE_PRICE_MONTHLY` | *(Copy from your .env.local PADDLE_PRICE_MONTHLY)* |
| `PADDLE_PRICE_YEARLY` | *(Copy from your .env.local PADDLE_PRICE_YEARLY)* |
| `PADDLE_PRICE_LIFETIME` | *(Copy from your .env.local PADDLE_PRICE_LIFETIME)* |

---

## 4. How to Access the Admin Panel on Vercel

Once Vercel finishes deploying:

1. Open your browser and navigate to:
   👉 **`https://your-project.vercel.app/admin`**
   *(or click the **"Admin Login"** link in the footer of your homepage)*

2. In the login modal:
   - Select tab: **`🔑 Master Admin Key`**
   - Enter your `ADMIN_API_KEY` (e.g. `admin-secret-key-change-in-production`)
   - Click **Authenticate as Administrator →**

3. You will now have full access to:
   - Real-time revenue & metrics
   - Generating manual licenses
   - Viewing active devices & releasing activation slots
   - Paddle purchases and transaction history
