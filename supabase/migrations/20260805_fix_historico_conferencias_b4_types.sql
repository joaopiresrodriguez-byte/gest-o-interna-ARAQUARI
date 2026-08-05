-- Alterar item_id e conferido_por_id para TEXT para evitar erros de uuid casting
ALTER TABLE historico_conferencias_b4 ALTER COLUMN item_id TYPE TEXT;
ALTER TABLE historico_conferencias_b4 ALTER COLUMN conferido_por_id TYPE TEXT;

-- Adicionar colunas de resolução se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'historico_conferencias_b4' AND column_name = 'resolvido'
  ) THEN
    ALTER TABLE historico_conferencias_b4 ADD COLUMN resolvido BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'historico_conferencias_b4' AND column_name = 'resolvido_em'
  ) THEN
    ALTER TABLE historico_conferencias_b4 ADD COLUMN resolvido_em TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'historico_conferencias_b4' AND column_name = 'resolvido_por'
  ) THEN
    ALTER TABLE historico_conferencias_b4 ADD COLUMN resolvido_por VARCHAR(150);
  END IF;
END $$;
