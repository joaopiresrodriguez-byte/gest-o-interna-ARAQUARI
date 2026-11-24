-- ============================================================
-- SCRIPT DE ROLLBACK TOTAL DA FASE 1 SAAS
-- Data: 2026-11-24
-- Execução: Caso queira reverter 100% das alterações da Fase 1,
--           basta executar este arquivo no Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
    -- 1. REMOVER COLUNAS ORGANIZATION_ID DAS TABELAS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id') THEN
        ALTER TABLE public.profiles DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personnel' AND column_name = 'organization_id') THEN
        ALTER TABLE public.personnel DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fleet' AND column_name = 'organization_id') THEN
        ALTER TABLE public.fleet DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautelas' AND column_name = 'organization_id') THEN
        ALTER TABLE public.cautelas DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conferencia_itens' AND column_name = 'organization_id') THEN
        ALTER TABLE public.conferencia_itens DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_missions' AND column_name = 'organization_id') THEN
        ALTER TABLE public.daily_missions DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'escalas' AND column_name = 'organization_id') THEN
        ALTER TABLE public.escalas DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'guarnicoes' AND column_name = 'organization_id') THEN
        ALTER TABLE public.guarnicoes DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checklist_items' AND column_name = 'organization_id') THEN
        ALTER TABLE public.checklist_items DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_receipts' AND column_name = 'organization_id') THEN
        ALTER TABLE public.product_receipts DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'baixa_patrimonio' AND column_name = 'organization_id') THEN
        ALTER TABLE public.baixa_patrimonio DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'b1_courses' AND column_name = 'organization_id') THEN
        ALTER TABLE public.b1_courses DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'occurrences' AND column_name = 'organization_id') THEN
        ALTER TABLE public.occurrences DROP COLUMN organization_id CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'training_schedule' AND column_name = 'organization_id') THEN
        ALTER TABLE public.training_schedule DROP COLUMN organization_id CASCADE;
    END IF;

    -- 2. REMOVER TABELAS SAAS FASE 1
    DROP TABLE IF EXISTS public.tenant_settings CASCADE;
    DROP TABLE IF EXISTS public.organizations CASCADE;
END $$;
