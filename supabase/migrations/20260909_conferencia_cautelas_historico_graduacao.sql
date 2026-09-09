-- ============================================================
-- MIGRAÇÃO: 2026-09-09
-- 1. Campos de conferência na tabela cautelas (Bloco 3)
-- 2. Tabela historico_graduacao para BCs (Bloco 6)
-- 3. Constraint UNIQUE em fleet por (name, local_id) (Bloco 1)
-- ============================================================

-- 1. Campos de conferência do item na cautela
ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS conferencia_retirada TEXT,
  ADD COLUMN IF NOT EXISTS conferencia_devolucao TEXT;

-- 2. Tabela historico_graduacao (promoções de militares e BCs)
CREATE TABLE IF NOT EXISTS public.historico_graduacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id BIGINT NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  graduacao TEXT NOT NULL,
  data_promocao DATE NOT NULL,
  observacao TEXT,
  registrado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.historico_graduacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hist_grad_auth" ON public.historico_graduacao;
CREATE POLICY "hist_grad_auth"
  ON public.historico_graduacao FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- Índice para buscas por personnel_id
CREATE INDEX IF NOT EXISTS idx_historico_graduacao_personnel_id
  ON public.historico_graduacao(personnel_id);

-- 3. Constraint UNIQUE em fleet para evitar duplicatas por (name, local_id)
-- Usar IF NOT EXISTS via bloco DO para compatibilidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_name_local_unique'
      AND conrelid = 'public.fleet'::regclass
  ) THEN
    ALTER TABLE public.fleet
      ADD CONSTRAINT fleet_name_local_unique UNIQUE (name, local_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint fleet_name_local_unique não pôde ser criada (possível duplicata existente): %', SQLERRM;
END $$;

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
