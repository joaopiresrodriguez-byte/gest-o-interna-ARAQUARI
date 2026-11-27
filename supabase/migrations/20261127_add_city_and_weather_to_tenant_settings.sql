-- ============================================================
-- MIGRAÇÃO SAAS: LOCALIZAÇÃO E CLIMA POR ORGANIZAÇÃO
-- Data: 2026-11-27
-- ============================================================

ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS city_name VARCHAR(100) DEFAULT 'Araquari - SC',
ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) DEFAULT -26.3731,
ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) DEFAULT -48.7239;

UPDATE public.tenant_settings
SET city_name = 'Araquari - SC', latitude = -26.3731, longitude = -48.7239
WHERE city_name IS NULL;
