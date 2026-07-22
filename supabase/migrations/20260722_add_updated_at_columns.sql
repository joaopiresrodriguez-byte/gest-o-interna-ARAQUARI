-- Add updated_at column to tables if it does not exist
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'personnel','equipamentos','escalas','guarnicoes',
    'materias_instrucao','fleet','locais_equipamento'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = tbl
      AND table_schema = 'public'
    ) AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_name = tbl
      AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()', tbl
      );
    END IF;
  END LOOP;
END $$;
