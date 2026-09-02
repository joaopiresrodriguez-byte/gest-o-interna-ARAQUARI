-- ============================================================
-- MIGRAÇÃO B3: Colunas de deferimento integrado
-- Data: 2026-09-02
-- ============================================================

ALTER TABLE public.b3_solicitacoes_apoio
  ADD COLUMN IF NOT EXISTS tipo_deferimento TEXT
    CHECK (tipo_deferimento IN ('palestra_instrucao', 'operacao_presenca'));

ALTER TABLE public.b3_solicitacoes_apoio
  ADD COLUMN IF NOT EXISTS referencia_criada_id UUID;

CREATE INDEX IF NOT EXISTS idx_b3_solicitacoes_tipo_deferimento
  ON public.b3_solicitacoes_apoio (tipo_deferimento)
  WHERE tipo_deferimento IS NOT NULL;

NOTIFY pgrst, 'reload schema';
