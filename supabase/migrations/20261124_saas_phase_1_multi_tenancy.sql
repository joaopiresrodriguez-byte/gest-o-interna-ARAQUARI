-- ============================================================
-- MIGRAÇÃO SAAS FASE 1: FUNDAÇÃO MULTI-TENANCY (COMPATÍVEL SUPABASE SQL EDITOR)
-- Data: 2026-11-24
-- Execução: Direta sem blocos PL/pgSQL aninhados
-- ============================================================

-- 1. TABELA DE ORGANIZAÇÕES (TENANTS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(32),
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'enterprise',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE CONFIGURAÇÕES DE BRANDING / WHITELABEL
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color VARCHAR(16) DEFAULT '#b91c1c',
    secondary_color VARCHAR(16) DEFAULT '#78350f',
    unit_name VARCHAR(128) DEFAULT 'Corpo de Bombeiros Militar',
    station_name VARCHAR(128) DEFAULT 'Araquari',
    custom_domain VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_settings_org UNIQUE (organization_id)
);

-- 3. INSERÇÃO DO TENANT PADRÃO CANÔNICO (CBMSC ARAQUARI)
INSERT INTO public.organizations (id, slug, name, plan_tier, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'cbmsc-araquari',
    'Corpo de Bombeiros Militar de Araquari - CBMSC',
    'enterprise',
    true
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    plan_tier = EXCLUDED.plan_tier;

INSERT INTO public.tenant_settings (organization_id, unit_name, station_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Corpo de Bombeiros Militar de Santa Catarina',
    'Araquari'
)
ON CONFLICT (organization_id) DO NOTHING;

-- 4. ADIÇÃO DIRETA DAS COLUNAS (DDL PURO POSTGRESQL 9.6+)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_personnel_organization_id ON public.personnel(organization_id);

ALTER TABLE public.fleet ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_fleet_organization_id ON public.fleet(organization_id);

ALTER TABLE public.cautelas ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_cautelas_organization_id ON public.cautelas(organization_id);

ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_conferencia_itens_organization_id ON public.conferencia_itens(organization_id);

ALTER TABLE public.daily_missions ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_daily_missions_organization_id ON public.daily_missions(organization_id);

ALTER TABLE public.escalas ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_escalas_organization_id ON public.escalas(organization_id);

ALTER TABLE public.guarnicoes ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_guarnicoes_organization_id ON public.guarnicoes(organization_id);

ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_organization_id ON public.checklist_items(organization_id);

ALTER TABLE public.product_receipts ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_product_receipts_organization_id ON public.product_receipts(organization_id);

ALTER TABLE public.baixa_patrimonio ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_baixa_patrimonio_organization_id ON public.baixa_patrimonio(organization_id);

ALTER TABLE public.b1_courses ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_b1_courses_organization_id ON public.b1_courses(organization_id);

ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_occurrences_organization_id ON public.occurrences(organization_id);

ALTER TABLE public.training_schedule ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_training_schedule_organization_id ON public.training_schedule(organization_id);

-- 5. SEGURANÇA E POLÍTICAS RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_organizations" ON public.organizations;
CREATE POLICY "allow_read_organizations" ON public.organizations FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_tenant_settings" ON public.tenant_settings;
CREATE POLICY "allow_read_tenant_settings" ON public.tenant_settings FOR SELECT USING (true);
