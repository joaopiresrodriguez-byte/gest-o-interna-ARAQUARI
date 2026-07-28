-- =========================================================
-- MIGRAÇÃO: daily_missions — status expandido + auditoria
-- Data: 2026-07-28
-- Tabela alvo: daily_missions (não 'missoes')
-- =========================================================

DO $$
BEGIN

  -- 1. Campo observacoes (campo notes já existe, mas observacoes é novo)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN observacoes TEXT;
  END IF;

  -- 2. ID do usuário que editou (FK para auth.users)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'editado_por_id'
  ) THEN
    ALTER TABLE daily_missions
      ADD COLUMN editado_por_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
  END IF;

  -- 3. Email/nome do usuário salvo no momento da edição
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'editado_por_nome'
  ) THEN
    ALTER TABLE daily_missions
      ADD COLUMN editado_por_nome VARCHAR(150);
  END IF;

  -- 4. Timestamp da última edição de status/observações
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'editado_em'
  ) THEN
    ALTER TABLE daily_missions
      ADD COLUMN editado_em TIMESTAMPTZ;
  END IF;

END $$;

-- =========================================================
-- BLOCO B: Expandir CHECK constraint do status
-- Mantém fluxo: agendada → em_andamento → [conclusão]
-- Adiciona 3 opções finais: concluida, parcialmente_concluida, nao_realizada
-- Remove: cancelada → mantida para compatibilidade
-- =========================================================

ALTER TABLE daily_missions
  DROP CONSTRAINT IF EXISTS daily_missions_status_check;

ALTER TABLE daily_missions
  ADD CONSTRAINT daily_missions_status_check
  CHECK (status IN (
    'agendada',
    'em_andamento',
    'cancelada',
    'concluida',
    'parcialmente_concluida',
    'nao_realizada'
  ));

-- =========================================================
-- VERIFICAÇÃO FINAL — deve retornar 4 colunas:
-- observacoes, editado_por_id, editado_por_nome, editado_em
-- =========================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_missions'
AND column_name IN (
  'status',
  'observacoes',
  'editado_por_id',
  'editado_por_nome',
  'editado_em'
)
ORDER BY column_name;
