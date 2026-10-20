-- ============================================================
-- Migration: bc_access_tokens
-- Tabela dedicada para tokens de acesso dos BCs ao formulário
-- de intenção. Separada de bc_intencoes para não criar registros
-- placeholder que poluíam o painel de gestão.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bc_access_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id    UUID NOT NULL REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
    bombeiro_id INTEGER NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    whatsapp_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_enviado_em TIMESTAMPTZ,
    criado_em   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ciclo_id, bombeiro_id)
);

CREATE INDEX IF NOT EXISTS idx_bc_access_tokens_token     ON public.bc_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bc_access_tokens_ciclo     ON public.bc_access_tokens(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_bc_access_tokens_bombeiro  ON public.bc_access_tokens(bombeiro_id);
CREATE INDEX IF NOT EXISTS idx_bc_access_tokens_mes       ON public.bc_access_tokens(mes_referencia);

-- RLS
ALTER TABLE public.bc_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica bc_access_tokens" ON public.bc_access_tokens;
CREATE POLICY "Leitura publica bc_access_tokens"
    ON public.bc_access_tokens FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestao total bc_access_tokens" ON public.bc_access_tokens;
CREATE POLICY "Gestao total bc_access_tokens"
    ON public.bc_access_tokens FOR ALL USING (true);

-- Atualizar campo token_acesso em bc_intencoes para referenciar o token
-- (mantemos retrocompatibilidade — o campo já existe na tabela)
-- Apenas garantimos que não haja UNIQUE constraint dura que impeça
-- múltiplas intenções por bombeiro (o token é por ciclo, não por intenção)
DO $$
BEGIN
    -- Remover unique constraint de token_acesso em bc_intencoes se existir
    -- pois o token agora fica em bc_access_tokens (1 por BC por ciclo)
    -- e bc_intencoes pode ter múltiplas linhas com o mesmo token
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bc_intencoes_token_acesso_key'
        AND conrelid = 'public.bc_intencoes'::regclass
    ) THEN
        ALTER TABLE public.bc_intencoes DROP CONSTRAINT bc_intencoes_token_acesso_key;
    END IF;
END $$;

-- Criar índice simples (não unique) para consulta por token em bc_intencoes
DROP INDEX IF EXISTS idx_bc_intencoes_token;
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_token ON public.bc_intencoes(token_acesso);

NOTIFY pgrst, 'reload schema';
