-- ==============================================================================
-- MIGRAÇÃO SQL COMPLETA E AUTOSSUFICIENTE: TABELA CONFERENCIA_ITENS
-- Copie e cole todo este bloco no Editor SQL do Supabase e clique em RUN.
-- ==============================================================================

-- 1. Criar a tabela conferencia_itens se ela ainda não existir
CREATE TABLE IF NOT EXISTS public.conferencia_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_conferencia DATE NOT NULL DEFAULT CURRENT_DATE,
  equipamento_id UUID,
  material_id UUID,
  viatura_id TEXT,
  fleet_item_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  status_item TEXT DEFAULT 'ok',
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

-- 2. Garantir a existência das colunas status_item e observacao
ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS status_item TEXT DEFAULT 'ok';
ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 3. Atualizar registros onde status_item esteja nulo
UPDATE public.conferencia_itens 
SET status_item = CASE 
    WHEN status = 'ok' THEN 'ok' 
    ELSE 'ocorrencia' 
  END 
WHERE status_item IS NULL;

-- 4. Criar índices únicos por item e data
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_equip ON public.conferencia_itens (data_conferencia, equipamento_id) WHERE equipamento_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_mat ON public.conferencia_itens (data_conferencia, material_id) WHERE material_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_vtr ON public.conferencia_itens (data_conferencia, viatura_id) WHERE viatura_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_data_fleet ON public.conferencia_itens (data_conferencia, fleet_item_id) WHERE fleet_item_id IS NOT NULL;

-- 5. Configurar RLS (Row Level Security)
ALTER TABLE public.conferencia_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conferencia_all" ON public.conferencia_itens;
CREATE POLICY "conferencia_all" ON public.conferencia_itens FOR ALL USING (true);

-- 6. Recarregar Schema Cache do PostgREST
NOTIFY pgrst, 'reload schema';
