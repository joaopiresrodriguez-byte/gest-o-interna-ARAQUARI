-- ============================================================
-- MIGRAÇÃO: Adicionar campos cadastrado_por e created_by em product_receipts
-- Data: 2026-10-07
-- ============================================================

ALTER TABLE product_receipts ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE product_receipts ADD COLUMN IF NOT EXISTS cadastrado_por text;
