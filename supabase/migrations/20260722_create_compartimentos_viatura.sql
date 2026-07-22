-- Migração: Tabela de compartimentos de viatura e relacionamento em equipamentos/fleet

-- 1. Criar tabela compartimentos_viatura
CREATE TABLE IF NOT EXISTS compartimentos_viatura (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  viatura_id UUID NOT NULL REFERENCES viaturas(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  posicao VARCHAR(50),
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viatura_id, nome)
);

-- 2. Habilitar RLS e criar política de acesso
ALTER TABLE compartimentos_viatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_viatura_all" ON compartimentos_viatura;
CREATE POLICY "comp_viatura_all" ON compartimentos_viatura FOR ALL USING (true);

-- 3. Adicionar coluna compartimento_id na tabela de equipamentos (e fleet se aplicável)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'equipamentos'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name = 'equipamentos' AND column_name = 'compartimento_id'
    ) THEN
      ALTER TABLE equipamentos ADD COLUMN compartimento_id UUID REFERENCES compartimentos_viatura(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'fleet'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name = 'fleet' AND column_name = 'compartimento_id'
    ) THEN
      ALTER TABLE fleet ADD COLUMN compartimento_id UUID REFERENCES compartimentos_viatura(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
