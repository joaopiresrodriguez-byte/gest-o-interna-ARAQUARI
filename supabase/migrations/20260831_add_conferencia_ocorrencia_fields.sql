-- Migration: 20260831_add_conferencia_ocorrencia_fields.sql
-- Descrição: Adiciona colunas para detalhamento de ocorrências e reposição reserva na conferência de materiais

ALTER TABLE conferencia_itens ADD COLUMN IF NOT EXISTS tipo_ocorrencia TEXT;
ALTER TABLE conferencia_itens ADD COLUMN IF NOT EXISTS sub_tipo_avaria TEXT;
ALTER TABLE conferencia_itens ADD COLUMN IF NOT EXISTS quantidade_falta INTEGER;
ALTER TABLE conferencia_itens ADD COLUMN IF NOT EXISTS reposto_reserva BOOLEAN DEFAULT FALSE;
ALTER TABLE conferencia_itens ADD COLUMN IF NOT EXISTS observacao_ocorrencia TEXT;

NOTIFY pgrst, 'reload schema';
