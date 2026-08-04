-- Migration: Adicionar viatura_id na tabela fleet (tipo TEXT para bater com fleet.id)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fleet' AND column_name = 'viatura_id'
  ) THEN
    ALTER TABLE fleet
      ADD COLUMN viatura_id TEXT REFERENCES fleet(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_fleet_viatura_id ON fleet(viatura_id);

    -- Popular viatura_id nos registros existentes que têm compartimento_id
    UPDATE fleet f
    SET viatura_id = cv.viatura_id::text
    FROM compartimentos_viatura cv
    WHERE f.compartimento_id = cv.id
      AND f.viatura_id IS NULL;
  END IF;
END $$;
