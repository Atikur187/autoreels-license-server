-- ==============================================================================
-- AutoReels Scroll — Paddle Fulfillment & Subscription Mirroring Schema
-- Run this script in your Supabase Dashboard SQL Editor (or Postgres terminal)
-- ==============================================================================

-- 1. Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at trigger function if not already present
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Customers Table
-- Stores Paddle customer IDs and their associated email addresses
CREATE TABLE IF NOT EXISTS public.customers (
    customer_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- If a legacy customers table existed with UUID id, add customer_id column as fallback
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'customers' 
        AND column_name = 'id' 
        AND column_name != 'customer_id'
    ) THEN
        ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_id ON public.customers(customer_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- 4. Subscriptions Table
-- Authoritative mirror of Paddle subscription state
CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    status TEXT NOT NULL,
    price_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    scheduled_change_action TEXT,
    scheduled_change_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON public.subscriptions(price_id);

-- Optional foreign key constraint if customers.customer_id is primary key
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_subscriptions_customer'
    ) THEN
        BEGIN
            ALTER TABLE public.subscriptions 
            ADD CONSTRAINT fk_subscriptions_customer 
            FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping FK constraint if customer_id is not yet unique primary key: %', SQLERRM;
        END;
    END IF;
END $$;

-- Triggers for automatic updated_at timestamp
DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();
