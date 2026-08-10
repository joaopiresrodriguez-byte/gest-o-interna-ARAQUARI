-- =========================================================
-- MIGRAÇÃO: daily_missions — novos campos de localização,
--           data/hora fim e auditoria de conclusão
-- Data: 2026-08-10
-- Tabela alvo: daily_missions
-- =========================================================

DO $$
BEGIN

  -- 1. Data fim da missão (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'end_date'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN end_date DATE;
  END IF;

  -- 2. Endereço textual da localização da missão
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'location_address'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN location_address TEXT;
  END IF;

  -- 3. Link (Google Maps / Waze) para a localização
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'location_link'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN location_link TEXT;
  END IF;

  -- 4. Flag: a missão acontece no PBM ARAQUARI (quartel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'is_pbm_araquari'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN is_pbm_araquari BOOLEAN DEFAULT FALSE;
  END IF;

  -- 5. Nome/identificação de quem concluiu/registrou a conclusão
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_missions'
    AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE daily_missions ADD COLUMN completed_by VARCHAR(200);
  END IF;

END $$;

-- =========================================================
-- VERIFICAÇÃO FINAL
-- =========================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_missions'
AND column_name IN (
  'end_date',
  'location_address',
  'location_link',
  'is_pbm_araquari',
  'completed_by'
)
ORDER BY column_name;
