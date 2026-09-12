-- ==============================================================================
-- AutoReels Scroll — Complete Supabase PostgreSQL Schema
-- Tables: products, purchases, licenses, activations, customers
-- Copy and run this script in your Supabase Dashboard SQL Editor.
-- ==============================================================================

-- 1. Enable pgcrypto for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at automatic trigger function
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. Products Table (Defines plans, durations, and Paddle Price ID mappings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL, -- '7day', '30day', 'yearly', 'lifetime'
    paddle_price_id VARCHAR(128), -- Paddle Price ID (e.g. pri_...)
    duration_days INTEGER,        -- NULL for lifetime, 7, 30, 365
    is_lifetime BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_plan ON public.products(plan);
CREATE INDEX IF NOT EXISTS idx_products_paddle_price ON public.products(paddle_price_id);

CREATE OR REPLACE TRIGGER set_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 4. Licenses Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(64) UNIQUE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    plan VARCHAR(32) NOT NULL, -- '7day', '30day', 'yearly', 'lifetime'
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
    expires_at TIMESTAMPTZ, -- NULL for lifetime
    max_devices INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON public.licenses(product_id);

CREATE OR REPLACE TRIGGER set_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 5. Purchases Table (Authoritative records from verified Paddle webhooks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paddle_transaction_id VARCHAR(128) UNIQUE, -- Idempotency key from Paddle
    paddle_customer_id VARCHAR(128),           -- Paddle Customer ID (ctm_...)
    paddle_subscription_id VARCHAR(128),       -- Subscription ID for recurring plans
    customer_email VARCHAR(255),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    plan VARCHAR(32) NOT NULL,
    amount NUMERIC(10, 2),
    currency VARCHAR(8) DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'completed', -- 'completed', 'refunded', 'canceled', 'past_due'
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_txn ON public.purchases(paddle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_purchases_sub ON public.purchases(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON public.purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_license ON public.purchases(license_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON public.purchases(product_id);

CREATE OR REPLACE TRIGGER set_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 6. Activations Table (Device Installations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    installation_id VARCHAR(128) NOT NULL,
    device_label VARCHAR(128),
    platform VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'deactivated'
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_license_installation UNIQUE (license_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_activations_license ON public.activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_installation ON public.activations(installation_id);
CREATE INDEX IF NOT EXISTS idx_activations_status ON public.activations(status);

CREATE OR REPLACE TRIGGER set_activations_updated_at
BEFORE UPDATE ON public.activations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 7. Customers Table (Account and free trial abuse prevention)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    has_trial_claimed BOOLEAN NOT NULL DEFAULT false,
    trial_license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

CREATE OR REPLACE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Settings
-- All tables are private. The Next.js API server accesses them securely
-- via the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS safely.
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Deny public anon access by default
DROP POLICY IF EXISTS "Deny public anon access to products" ON public.products;
CREATE POLICY "Deny public anon access to products" ON public.products FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny public anon access to licenses" ON public.licenses;
CREATE POLICY "Deny public anon access to licenses" ON public.licenses FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny public anon access to purchases" ON public.purchases;
CREATE POLICY "Deny public anon access to purchases" ON public.purchases FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny public anon access to activations" ON public.activations;
CREATE POLICY "Deny public anon access to activations" ON public.activations FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny public anon access to customers" ON public.customers;
CREATE POLICY "Deny public anon access to customers" ON public.customers FOR ALL TO anon, authenticated USING (false);

-- -----------------------------------------------------------------------------
-- 9. Initial Seed Data: Standard Plans in products table
-- -----------------------------------------------------------------------------
INSERT INTO public.products (id, name, plan, duration_days, is_lifetime, active)
VALUES
    ('00000000-0000-0000-0000-000000000001', '7-Day Free Trial', '7day', 7, false, true),
    ('00000000-0000-0000-0000-000000000002', '1 Month Pass', '30day', 30, false, true),
    ('00000000-0000-0000-0000-000000000003', '1 Year Pro', 'yearly', 365, false, true),
    ('00000000-0000-0000-0000-000000000004', 'Lifetime VIP', 'lifetime', NULL, true, true)
ON CONFLICT (id) DO NOTHING;
