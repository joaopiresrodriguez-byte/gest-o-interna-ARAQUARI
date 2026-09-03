-- ============================================================
-- MIGRAÇÃO B3: Adicionar campo Empresa / Entidade nas solicitações de apoio
-- Data: 2026-09-03
-- ============================================================

ALTER TABLE public.b3_solicitacoes_apoio
  ADD COLUMN IF NOT EXISTS empresa_entidade TEXT;
