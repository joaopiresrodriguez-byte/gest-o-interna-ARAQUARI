-- ==============================================================================
-- MIGRAÇÃO DE VINCULAÇÃO E LIMPEZA DE SCHEMA
-- Execute este bloco no Editor SQL do Supabase e clique em RUN.
-- ==============================================================================

-- 1. Garantir existência da coluna compartimento_id em checklist_items
ALTER TABLE public.checklist_items 
  ADD COLUMN IF NOT EXISTS compartimento_id UUID REFERENCES public.compartimentos_viatura(id) ON DELETE SET NULL;

-- 2. Garantir existência da coluna quantidade em checklist_items
ALTER TABLE public.checklist_items 
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;

-- 3. Criar índices para acelerar a busca de itens por compartimento e viatura
CREATE INDEX IF NOT EXISTS idx_checklist_items_compartimento 
  ON public.checklist_items (compartimento_id) 
  WHERE compartimento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_items_viatura 
  ON public.checklist_items (viatura_id) 
  WHERE viatura_id IS NOT NULL;

-- 4. Notificar PostgREST para recarregar o cache do schema
NOTIFY pgrst, 'reload schema';
