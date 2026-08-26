-- ============================================================
-- MIGRAÇÃO: Múltiplos módulos — 2026-08-26
-- 1. cautelas: adicionar matricula_solicitante
-- 2. materias_instrucao: adicionar tema
-- 3. user_access_logs: nova tabela de logs de acesso
-- ============================================================

-- 1. Matrícula do Solicitante na Cautela
ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS matricula_solicitante TEXT;

-- 2. Tema da Instrução B3
ALTER TABLE public.materias_instrucao
  ADD COLUMN IF NOT EXISTS tema TEXT;

-- 3. Tabela de Logs de Acesso ao Sistema
CREATE TABLE IF NOT EXISTS public.user_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_email TEXT NOT NULL,
    user_name TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_email ON public.user_access_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_accessed_at ON public.user_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON public.user_access_logs(user_id);

-- RLS para user_access_logs
ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to authenticated users on user_access_logs" ON public.user_access_logs;
CREATE POLICY "Allow all access to authenticated users on user_access_logs"
    ON public.user_access_logs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to anon on user_access_logs" ON public.user_access_logs;
CREATE POLICY "Allow all access to anon on user_access_logs"
    ON public.user_access_logs FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
