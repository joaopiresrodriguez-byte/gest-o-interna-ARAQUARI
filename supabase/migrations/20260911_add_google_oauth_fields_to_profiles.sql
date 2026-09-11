-- ============================================================
-- MIGRAÇÃO: Campos para Google OAuth — 2026-09-11
-- Adiciona: avatar_url, full_name, status, provider, updated_at
-- em public.profiles para suportar login via Google OAuth.
-- ============================================================

-- Adicionar colunas necessárias (seguro via IF NOT EXISTS)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS full_name    TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS provider     TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- Garantir que todos os usuários existentes ficam com status 'ativo'
-- (não bloquear ninguém que já tinha acesso)
UPDATE public.profiles
SET status = 'ativo'
WHERE status IS NULL;

-- Índice para buscas por status (aprovação, listagem de pendentes)
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles(status);

-- Notificar PostgREST para recarregar o schema em cache
NOTIFY pgrst, 'reload schema';
