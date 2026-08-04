-- Migration: Adicionar viatura_id na tabela fleet
-- Permite vincular equipamentos/materiais diretamente à viatura,
-- sem depender exclusivamente de compartimento_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fleet' AND column_name = 'viatura_id'
  ) THEN
    ALTER TABLE fleet
      ADD COLUMN viatura_id UUID REFERENCES fleet(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_fleet_viatura_id ON fleet(viatura_id);

    -- Popular viatura_id nos registros existentes que têm compartimento_id
    UPDATE fleet f
    SET viatura_id = fv.id
    FROM compartimentos_viatura cv
    JOIN fleet fv ON fv.id::text = cv.viatura_id::text AND fv.type = 'Viatura'
    WHERE f.compartimento_id = cv.id
      AND f.viatura_id IS NULL;
  END IF;
END $$;
