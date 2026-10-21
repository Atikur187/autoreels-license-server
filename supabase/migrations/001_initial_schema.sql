-- AutoReels Scroll - Supabase Database Schema Migration
-- Migration: 001_initial_schema.sql
-- Description: Creates licenses, activations, and customers tables with Row Level Security (RLS)

-- 1. Enable pgcrypto for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at automatic trigger function
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TABLE: licenses
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('7day', '30day', '90day', 'yearly', 'lifetime')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ, -- NULL means lifetime license
    max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast license key lookup
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

-- Automatic updated_at trigger for licenses
CREATE OR REPLACE TRIGGER set_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- 4. TABLE: activations
CREATE TABLE IF NOT EXISTS public.activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_license_installation UNIQUE (license_id, installation_id)
);

-- Indexes for activations queries
CREATE INDEX IF NOT EXISTS idx_activations_license_id ON public.activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_installation_id ON public.activations(installation_id);
CREATE INDEX IF NOT EXISTS idx_activations_status ON public.activations(status);

-- Automatic updated_at trigger for activations
CREATE OR REPLACE TRIGGER set_activations_updated_at
BEFORE UPDATE ON public.activations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- 5. TABLE: customers (Minimal customer mapping)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- Automatic updated_at trigger for customers
CREATE OR REPLACE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- 6. Row Level Security (RLS) Configuration
-- CRITICAL SECURITY RULE: The public extension client MUST NEVER get direct table access.
-- Only the backend License API using the SUPABASE_SERVICE_ROLE_KEY may query and modify these tables.

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Deny all public anon/authenticated access by default
DROP POLICY IF EXISTS "Deny anon access to licenses" ON public.licenses;
CREATE POLICY "Deny anon access to licenses"
    ON public.licenses
    FOR ALL
    TO anon, authenticated
    USING (false);

DROP POLICY IF EXISTS "Deny anon access to activations" ON public.activations;
CREATE POLICY "Deny anon access to activations"
    ON public.activations
    FOR ALL
    TO anon, authenticated
    USING (false);

DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
CREATE POLICY "Deny anon access to customers"
    ON public.customers
    FOR ALL
    TO anon, authenticated
    USING (false);
