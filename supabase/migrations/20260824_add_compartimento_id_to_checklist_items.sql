-- ==============================================================================
-- MIGRAÇÃO: Adicionar compartimento_id e quantidade à tabela checklist_items
-- Execute este bloco inteiro no Editor SQL do Supabase e clique em RUN.
-- ==============================================================================

-- 1. Adicionar coluna compartimento_id (FK para compartimentos_viatura)
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS compartimento_id UUID REFERENCES public.compartimentos_viatura(id) ON DELETE SET NULL;

-- 2. Adicionar coluna quantidade (padrão 1)
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;

-- 3. Criar índice para performance nas queries por compartimento
CREATE INDEX IF NOT EXISTS idx_checklist_items_compartimento 
  ON public.checklist_items (compartimento_id)
  WHERE compartimento_id IS NOT NULL;

-- 4. Criar índice para queries por viatura
CREATE INDEX IF NOT EXISTS idx_checklist_items_viatura
  ON public.checklist_items (viatura_id)
  WHERE viatura_id IS NOT NULL;

-- 5. Garantir que RLS está habilitado
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_items_all" ON public.checklist_items;
CREATE POLICY "checklist_items_all" ON public.checklist_items FOR ALL USING (true);

-- 6. Recarregar cache do schema PostgREST
NOTIFY pgrst, 'reload schema';
