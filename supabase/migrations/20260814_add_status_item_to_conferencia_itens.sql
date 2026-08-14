-- BLOCO 1 — Ajuste na tabela de conferência de itens
-- Adiciona colunas status_item e observacao para suportar a marcação ok / ocorrência

ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS status_item TEXT DEFAULT 'ok';
ALTER TABLE public.conferencia_itens ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Atualiza registros pré-existentes garantindo alinhamento
UPDATE public.conferencia_itens 
SET status_item = CASE 
    WHEN status = 'ok' THEN 'ok' 
    ELSE 'ocorrencia' 
  END 
WHERE status_item IS NULL;

-- Notificar PostgREST para recarregar schema cache
NOTIFY pgrst, 'reload schema';
