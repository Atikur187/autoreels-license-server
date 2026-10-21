-- AutoReels Scroll - Supabase Seed Data for Local Development & Testing
-- Seed File: seed.sql

-- Clear existing test records if re-seeding
DELETE FROM public.activations WHERE installation_id LIKE 'test-%';
DELETE FROM public.licenses WHERE license_key LIKE 'TEST-ARS-%';

-- 1. Valid Lifetime License (1 Device)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'TEST-ARS-LIFETIME-001',
    'lifetime',
    'active',
    NULL,
    1
);

-- 2. Valid 30-Day License (2 Devices)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'TEST-ARS-30DAY-001',
    '30day',
    'active',
    now() + INTERVAL '30 days',
    2
);

-- 3. Valid 7-Day Test License (1 Device)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'TEST-ARS-7DAY-001',
    '7day',
    'active',
    now() + INTERVAL '7 days',
    1
);

-- 4. Valid 1-Year License (1 Device)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000004',
    'TEST-ARS-YEARLY-001',
    'yearly',
    'active',
    now() + INTERVAL '1 year',
    1
);

-- 5. Expired License (Expired 2 days ago)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000005',
    'TEST-ARS-EXPIRED-001',
    '30day',
    'expired',
    now() - INTERVAL '2 days',
    1
);

-- 6. Revoked License
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000006',
    'TEST-ARS-REVOKED-001',
    'lifetime',
    'revoked',
    NULL,
    1
);

-- 7. Max Limit Reached License (1 device limit, already active on test-device-uuid-1)
INSERT INTO public.licenses (id, license_key, plan, status, expires_at, max_devices)
VALUES (
    'a0000000-0000-0000-0000-000000000007',
    'TEST-ARS-LIMIT-001',
    'lifetime',
    'active',
    NULL,
    1
);

-- Existing activation for TEST-ARS-LIMIT-001 to test activation limit
INSERT INTO public.activations (id, license_id, installation_id, status, activated_at, last_seen_at)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000007',
    'test-device-uuid-existing-001',
    'active',
    now(),
    now()
);
