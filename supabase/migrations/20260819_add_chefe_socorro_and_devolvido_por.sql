-- Migration: Add chefe_socorro to daily_missions and devolvido_por to cautelas
-- Date: 2026-08-19

-- 1. Adicionar campos de Chefe de Socorro na tabela daily_missions
ALTER TABLE public.daily_missions
  ADD COLUMN IF NOT EXISTS chefe_socorro_id TEXT,
  ADD COLUMN IF NOT EXISTS chefe_socorro_nome TEXT;

-- 2. Adicionar campo de quem realizou a devolução na tabela cautelas
ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS devolvido_por TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
