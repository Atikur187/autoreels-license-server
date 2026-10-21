-- ==============================================================================
-- AutoReels Scroll — Migration 004: Lemon Squeezy Payment & Webhook Integration
-- Supports Lemon Squeezy Orders, Variants, Webhook Events, and Secure Claim Tokens
-- ==============================================================================

-- 1. Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add Lemon Squeezy columns to public.purchases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'lemonsqueezy_order_id'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_order_id VARCHAR(128);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'lemonsqueezy_customer_id'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_customer_id VARCHAR(128);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'lemonsqueezy_variant_id'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_variant_id VARCHAR(128);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'lemonsqueezy_product_id'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_product_id VARCHAR(128);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_ls_order ON public.purchases(lemonsqueezy_order_id)
WHERE lemonsqueezy_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_ls_variant ON public.purchases(lemonsqueezy_variant_id);

-- 3. Add Lemon Squeezy columns to public.licenses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'lemonsqueezy_order_id'
    ) THEN
        ALTER TABLE public.licenses ADD COLUMN lemonsqueezy_order_id VARCHAR(128);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_licenses_ls_order ON public.licenses(lemonsqueezy_order_id);

-- 4. Add Lemon Squeezy variant binding to public.products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'lemonsqueezy_variant_id'
    ) THEN
        ALTER TABLE public.products ADD COLUMN lemonsqueezy_variant_id VARCHAR(128);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_ls_variant ON public.products(lemonsqueezy_variant_id);

-- 5. Webhook Events Table (For strict idempotency and audit logs)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    payload JSONB,
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);

-- 6. Pending Checkouts & Secure Claim Correlation Table
CREATE TABLE IF NOT EXISTS public.pending_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_token VARCHAR(128) UNIQUE NOT NULL,
    plan VARCHAR(32) NOT NULL,
    customer_email VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'claimed', 'expired'
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    lemonsqueezy_order_id VARCHAR(128),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_token ON public.pending_checkouts(claim_token);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_order ON public.pending_checkouts(lemonsqueezy_order_id);

-- 7. Row Level Security
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public anon access to webhook_events" ON public.webhook_events;
CREATE POLICY "Deny public anon access to webhook_events" ON public.webhook_events FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny public anon access to pending_checkouts" ON public.pending_checkouts;
CREATE POLICY "Deny public anon access to pending_checkouts" ON public.pending_checkouts FOR ALL TO anon, authenticated USING (false);
