-- ============================================================
-- MIGRAÇÃO: Corrigir coluna cadastrado_por em product_receipts
-- Data: 2026-10-14
-- Motivo: Erro "Could not find the 'cadastrado_por' column of
--         'product_receipts' in the schema cache" ao registrar
--         recebimentos no módulo operacional.
-- ============================================================

-- Garante que as colunas existam (idempotente)
ALTER TABLE product_receipts ADD COLUMN IF NOT EXISTS created_by     text;
ALTER TABLE product_receipts ADD COLUMN IF NOT EXISTS cadastrado_por  text;

-- Força o PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
