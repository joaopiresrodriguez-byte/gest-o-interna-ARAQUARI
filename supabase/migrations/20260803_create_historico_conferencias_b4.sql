-- BLOCO A — Histórico de Conferências B4
-- Registra APENAS itens com status avariado ou nao_encontrado
-- para fins de rastreabilidade, relatórios e disparo de alertas.

CREATE TABLE IF NOT EXISTS historico_conferencias_b4 (
  id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  data_conferencia       DATE         NOT NULL,
  tipo_item              VARCHAR(20)  NOT NULL,
  -- 'equipamento' | 'consumo' | 'viatura'
  item_id                TEXT         NOT NULL, -- Alterado para TEXT para compatibilidade com IDs string da fleet/locais
  item_nome              VARCHAR(200),
  viatura_nome           VARCHAR(100),
  compartimento_nome     VARCHAR(100),
  local_nome             VARCHAR(100),
  status_conferencia     VARCHAR(20)  NOT NULL,
  -- 'avariado' | 'nao_encontrado'
  observacao             TEXT,
  conferido_por_nome     VARCHAR(150),
  conferido_por_id       UUID,
  conferido_em           TIMESTAMPTZ  DEFAULT NOW(),
  notificacao_enviada    BOOLEAN      DEFAULT false,
  notificacao_enviada_em TIMESTAMPTZ,
  CONSTRAINT uq_hist_b4_data_item UNIQUE (data_conferencia, item_id)
);

-- Índices para filtros do relatório
CREATE INDEX IF NOT EXISTS idx_hist_b4_data
  ON historico_conferencias_b4 (data_conferencia DESC);

CREATE INDEX IF NOT EXISTS idx_hist_b4_status
  ON historico_conferencias_b4 (status_conferencia);

CREATE INDEX IF NOT EXISTS idx_hist_b4_notif
  ON historico_conferencias_b4 (notificacao_enviada)
  WHERE notificacao_enviada = false;

-- RLS
ALTER TABLE historico_conferencias_b4 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_b4_all" ON historico_conferencias_b4;
CREATE POLICY "historico_b4_all"
  ON historico_conferencias_b4
  FOR ALL
  USING (true);
