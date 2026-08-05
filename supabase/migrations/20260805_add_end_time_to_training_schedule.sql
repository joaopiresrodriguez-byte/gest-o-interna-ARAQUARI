-- ============================================================
-- MIGRAÇÃO: Adicionar end_time na tabela training_schedule
-- Data: 2026-08-05
-- ============================================================

ALTER TABLE training_schedule ADD COLUMN IF NOT EXISTS end_time text;
