-- ============================================================
-- MIGRAÇÃO: Adiciona coluna mtcl_cpf_retirada na tabela cautelas
-- Date: 2026-08-27
-- ============================================================

ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS mtcl_cpf_retirada TEXT;

COMMENT ON COLUMN public.cautelas.mtcl_cpf_retirada
  IS 'MTCL ou CPF de quem está fisicamente retirando o item cautelado.';

NOTIFY pgrst, 'reload schema';
