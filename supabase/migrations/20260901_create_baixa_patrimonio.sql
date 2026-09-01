-- Migration: 20260901_create_baixa_patrimonio.sql
-- Descrição: Tabela para controle e gestão do submódulo Baixa Patrimônio (B4) e roteamento de avarias/baixas

CREATE TABLE IF NOT EXISTS baixa_patrimonio (
  id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id                TEXT         NOT NULL,
  item_nome              VARCHAR(200) NOT NULL,
  tipo_item              VARCHAR(50),
  viatura_nome           VARCHAR(100),
  compartimento_nome     VARCHAR(100),
  local_nome             VARCHAR(100),
  motivo_baixa           TEXT         NOT NULL,
  status                 VARCHAR(30)  DEFAULT 'pendente_baixa', -- 'pendente_baixa' | 'concluido_baixado' | 'rejeitado'
  conferencia_id         UUID,
  cadastrado_por_nome     VARCHAR(150),
  cadastrado_em          TIMESTAMPTZ  DEFAULT NOW(),
  processado_por_nome     VARCHAR(150),
  processado_em          TIMESTAMPTZ,
  observacao_gestor      TEXT
);

CREATE INDEX IF NOT EXISTS idx_baixa_patrimonio_status ON baixa_patrimonio(status);
CREATE INDEX IF NOT EXISTS idx_baixa_patrimonio_item ON baixa_patrimonio(item_id);

-- Habilitar RLS
ALTER TABLE baixa_patrimonio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "baixa_patrimonio_all" ON baixa_patrimonio;
CREATE POLICY "baixa_patrimonio_all"
  ON baixa_patrimonio
  FOR ALL
  USING (true);

NOTIFY pgrst, 'reload schema';
