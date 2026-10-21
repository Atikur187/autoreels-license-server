-- ==============================================================================
-- AutoReels Scroll — Supabase Migration: 003_complete_production_schema.sql
-- Description: Adds webhook_events, orders table, and upgrades licenses and activations
-- with required production columns and Row Level Security (RLS).
-- ==============================================================================

-- 1. Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Trigger function for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. UPGRADE TABLE: licenses
-- Add email, device_limit, activation_count, paddle IDs, last_validated_at
-- -----------------------------------------------------------------------------
ALTER TABLE public.licenses 
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS device_limit INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS activation_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paddle_customer_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS paddle_transaction_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS paddle_subscription_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- Backfill device_limit from max_devices if null
UPDATE public.licenses 
SET device_limit = max_devices 
WHERE device_limit IS NULL OR device_limit = 1;

CREATE INDEX IF NOT EXISTS idx_licenses_email ON public.licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_paddle_txn ON public.licenses(paddle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_licenses_paddle_sub ON public.licenses(paddle_subscription_id);

-- -----------------------------------------------------------------------------
-- 4. UPGRADE TABLE: activations
-- Add device_id (alias for installation_id), browser, user_agent
-- -----------------------------------------------------------------------------
ALTER TABLE public.activations 
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS browser VARCHAR(64),
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Backfill device_id from installation_id if empty
UPDATE public.activations 
SET device_id = installation_id 
WHERE device_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_activations_device_id ON public.activations(device_id);

-- -----------------------------------------------------------------------------
-- 5. TABLE: webhook_events (Strict Idempotency Log)
-- Ensures duplicate Paddle events are never processed more than once.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) UNIQUE NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'processing'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);

CREATE OR REPLACE TRIGGER set_webhook_events_updated_at
BEFORE UPDATE ON public.webhook_events
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 6. TABLE: orders (Mirror of completed Paddle transactions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    amount NUMERIC(10, 2),
    currency VARCHAR(8) DEFAULT 'USD',
    paddle_transaction_id VARCHAR(128) UNIQUE,
    paddle_customer_id VARCHAR(128),
    paddle_subscription_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'completed', -- 'completed', 'refunded', 'canceled'
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_paddle_txn ON public.orders(paddle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_paddle_sub ON public.orders(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_orders_license ON public.orders(license_id);

CREATE OR REPLACE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Configuration
-- All tables are completely private. Only SUPABASE_SERVICE_ROLE_KEY bypasses RLS safely.
-- -----------------------------------------------------------------------------
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public anon access to webhook_events" ON public.webhook_events;
CREATE POLICY "Deny public anon access to webhook_events" 
    ON public.webhook_events 
    FOR ALL 
    TO anon, authenticated 
    USING (false);

DROP POLICY IF EXISTS "Deny public anon access to orders" ON public.orders;
CREATE POLICY "Deny public anon access to orders" 
    ON public.orders 
    FOR ALL 
    TO anon, authenticated 
    USING (false);
