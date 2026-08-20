-- Migração para adicionar coluna de quantidade na tabela fleet do B4

ALTER TABLE public.fleet ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;

NOTIFY pgrst, 'reload schema';
