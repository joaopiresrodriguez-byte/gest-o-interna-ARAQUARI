-- Tabela de Registros de Conferência Diária por Item e Viatura
CREATE TABLE IF NOT EXISTS conferencia_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_conferencia DATE NOT NULL DEFAULT CURRENT_DATE,
  equipamento_id UUID,
  material_id UUID,
  viatura_id TEXT,
  fleet_item_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  observacao TEXT,
  conferido_por_id UUID,
  conferido_por_nome VARCHAR(150),
  conferido_em TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT item_obrigatorio CHECK (
    equipamento_id IS NOT NULL OR
    material_id IS NOT NULL OR
    viatura_id IS NOT NULL OR
    fleet_item_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_equip ON conferencia_itens (data_conferencia, equipamento_id) WHERE equipamento_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_mat ON conferencia_itens (data_conferencia, material_id) WHERE material_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_vtr ON conferencia_itens (data_conferencia, viatura_id) WHERE viatura_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_fleet ON conferencia_itens (data_conferencia, fleet_item_id) WHERE fleet_item_id IS NOT NULL;

ALTER TABLE conferencia_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conferencia_all" ON conferencia_itens;
CREATE POLICY "conferencia_all" ON conferencia_itens FOR ALL USING (true);
