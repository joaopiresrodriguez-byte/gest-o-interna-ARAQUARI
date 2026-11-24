-- ============================================================
-- SCRIPT DE ROLLBACK TOTAL DA FASE 1 SAAS (COMPATÍVEL SUPABASE SQL EDITOR)
-- Data: 2026-11-24
-- Execução: Direta sem blocos PL/pgSQL
-- ============================================================

-- 1. REMOVER COLUNAS ORGANIZATION_ID DAS TABELAS
ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.personnel DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.fleet DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.cautelas DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.conferencia_itens DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.daily_missions DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.escalas DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.guarnicoes DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.checklist_items DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.product_receipts DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.baixa_patrimonio DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.b1_courses DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.occurrences DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.training_schedule DROP COLUMN IF EXISTS organization_id CASCADE;

-- 2. REMOVER TABELAS SAAS FASE 1
DROP TABLE IF EXISTS public.tenant_settings CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
