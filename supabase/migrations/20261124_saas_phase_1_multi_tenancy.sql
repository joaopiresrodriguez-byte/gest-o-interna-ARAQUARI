-- ============================================================
-- MIGRAÇÃO SAAS FASE 1: FUNDAÇÃO MULTI-TENANCY & COMPATIBILIDADE RETROATIVA
-- Data: 2026-11-24
-- Autor: Equipe de Engenharia SaaS
-- Descrição:
--   1. Criação das tabelas centrais `organizations` e `tenant_settings`.
--   2. Inserção do tenant padrão canônico (Araquari / CBMSC) para preservar 100% dos dados existentes.
--   3. Adição da coluna `organization_id` com valor default nas tabelas operacionais.
--   4. Criação de índices otimizados para alta performance em consultas multi-tenant.
-- ============================================================

-- 1. TABELA DE ORGANIZAÇÕES (TENANTS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(32), -- CNPJ ou Identificador Governamental
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'enterprise', -- starter | pro | enterprise
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE CONFIGURAÇÕES ESPECÍFICAS DE CADA TENANT (BRANDING & WHITELABEL)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color VARCHAR(16) DEFAULT '#b91c1c', -- Cor padrão Bombeiro
    secondary_color VARCHAR(16) DEFAULT '#78350f',
    unit_name VARCHAR(128) DEFAULT 'Corpo de Bombeiros Militar',
    station_name VARCHAR(128) DEFAULT 'Araquari',
    custom_domain VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_settings_org UNIQUE (organization_id)
);

-- 3. INSERÇÃO DO TENANT PADRÃO CANÔNICO (CBMSC ARAQUARI)
-- O UUID fixo garante idempotência e fácil referência em scripts de migração e fallback.
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

-- Inserir configurações do tenant padrão
INSERT INTO public.tenant_settings (organization_id, unit_name, station_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Corpo de Bombeiros Militar de Santa Catarina',
    'Araquari'
)
ON CONFLICT (organization_id) DO NOTHING;

-- 4. ADIÇÃO DE ORGANIZATION_ID NAS TABELAS CENTRAIS COM VALOR PADRÃO
-- Usamos '00000000-0000-0000-0000-000000000001' como DEFAULT para garantir que todos os dados
-- existentes e novas inserções legadas continuem funcionando sem qualquer alteração obrigatória no código.

DO $$
BEGIN
    -- PROFILES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
    END IF;

    -- PERSONNEL (Efetivo)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personnel') THEN
        ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_personnel_organization_id ON public.personnel(organization_id);
    END IF;

    -- FLEET (Viaturas, Equipamentos e Materiais)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fleet') THEN
        ALTER TABLE public.fleet ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_fleet_organization_id ON public.fleet(organization_id);
    END IF;

    -- CAUTELAS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cautelas') THEN
        ALTER TABLE public.cautelas ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_cautelas_organization_id ON public.cautelas(organization_id);
    END IF;

    -- CONFERENCIA_ITENS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conferencia_itens') THEN
        ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_conferencia_itens_organization_id ON public.conferencia_itens(organization_id);
    END IF;

    -- DAILY_MISSIONS (Missões Diárias)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_missions') THEN
        ALTER TABLE public.daily_missions ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_daily_missions_organization_id ON public.daily_missions(organization_id);
    END IF;

    -- ESCALAS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'escalas') THEN
        ALTER TABLE public.escalas ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_escalas_organization_id ON public.escalas(organization_id);
    END IF;

    -- GUARNICOES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guarnicoes') THEN
        ALTER TABLE public.guarnicoes ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_guarnicoes_organization_id ON public.guarnicoes(organization_id);
    END IF;

    -- CHECKLIST_ITEMS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_items') THEN
        ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_checklist_items_organization_id ON public.checklist_items(organization_id);
    END IF;

    -- PRODUCT_RECEIPTS (Recebimentos)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_receipts') THEN
        ALTER TABLE public.product_receipts ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_product_receipts_organization_id ON public.product_receipts(organization_id);
    END IF;

    -- BAIXA_PATRIMONIO
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'baixa_patrimonio') THEN
        ALTER TABLE public.baixa_patrimonio ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_baixa_patrimonio_organization_id ON public.baixa_patrimonio(organization_id);
    END IF;

    -- B1_COURSES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b1_courses') THEN
        ALTER TABLE public.b1_courses ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_b1_courses_organization_id ON public.b1_courses(organization_id);
    END IF;

    -- OCCURRENCES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'occurrences') THEN
        ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_occurrences_organization_id ON public.occurrences(organization_id);
    END IF;

    -- TRAINING_SCHEDULE
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'training_schedule') THEN
        ALTER TABLE public.training_schedule ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id);
        CREATE INDEX IF NOT EXISTS idx_training_schedule_organization_id ON public.training_schedule(organization_id);
    END IF;
END $$;

-- 5. POLÍTICAS DE ACESSO (RLS) - Permissivas para a organização atual
-- Mantém acesso total para membros da organização ou registros sem organização
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "allow_read_organizations" ON public.organizations;
    CREATE POLICY "allow_read_organizations" ON public.organizations FOR SELECT USING (true);

    DROP POLICY IF EXISTS "allow_read_tenant_settings" ON public.tenant_settings;
    CREATE POLICY "allow_read_tenant_settings" ON public.tenant_settings FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
