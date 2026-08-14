-- Migração para Módulo de Bombeiros Comunitários (Escala Automatizada)
-- Tabelas: bc_ciclos, bc_intencoes, bc_selecionados
-- Referências: personnel(id)

-- 1. TABELA bc_ciclos
CREATE TABLE IF NOT EXISTS public.bc_ciclos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mes_referencia TEXT NOT NULL,
    data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
    data_encerramento DATE NOT NULL DEFAULT CURRENT_DATE + INTERVAL '5 days',
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado', 'processado', 'publicado')),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_ciclos_mes_status ON public.bc_ciclos(mes_referencia, status);

-- 2. TABELA bc_intencoes
CREATE TABLE IF NOT EXISTS public.bc_intencoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bombeiro_id INTEGER NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    dia DATE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    total_horas NUMERIC(4,1) NOT NULL CHECK (total_horas IN (12, 24)),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'rejeitada')),
    token_acesso TEXT UNIQUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_intencoes_token ON public.bc_intencoes(token_acesso);
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_bombeiro_mes ON public.bc_intencoes(bombeiro_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_dia ON public.bc_intencoes(dia);

-- 3. TABELA bc_selecionados
CREATE TABLE IF NOT EXISTS public.bc_selecionados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bombeiro_id INTEGER NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
    dia DATE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    total_horas NUMERIC(4,1) NOT NULL,
    criterio_aplicado TEXT,
    posicao_ranking INTEGER DEFAULT 1,
    origem TEXT NOT NULL DEFAULT 'motor' CHECK (origem IN ('motor', 'excecao_manual')),
    motivo_excecao TEXT,
    motivo_substituicao TEXT,
    substituido_por_gestor BOOLEAN DEFAULT FALSE,
    notificado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_selecionados_dia ON public.bc_selecionados(dia);
CREATE INDEX IF NOT EXISTS idx_bc_selecionados_bombeiro ON public.bc_selecionados(bombeiro_id);

-- Habilitar RLS nas tabelas
ALTER TABLE public.bc_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_selecionados ENABLE ROW LEVEL SECURITY;

-- POLICIES DE RLS
-- bc_ciclos
DROP POLICY IF EXISTS "Permitir leitura pública de bc_ciclos" ON public.bc_ciclos;
CREATE POLICY "Permitir leitura pública de bc_ciclos" ON public.bc_ciclos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gestão total de bc_ciclos" ON public.bc_ciclos;
CREATE POLICY "Permitir gestão total de bc_ciclos" ON public.bc_ciclos FOR ALL USING (true);

-- bc_intencoes
DROP POLICY IF EXISTS "Permitir operacao publica com token em bc_intencoes" ON public.bc_intencoes;
CREATE POLICY "Permitir operacao publica com token em bc_intencoes" ON public.bc_intencoes FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir gestão total de bc_intencoes" ON public.bc_intencoes;
CREATE POLICY "Permitir gestão total de bc_intencoes" ON public.bc_intencoes FOR ALL USING (true);

-- bc_selecionados
DROP POLICY IF EXISTS "Permitir gestão total de bc_selecionados" ON public.bc_selecionados;
CREATE POLICY "Permitir gestão total de bc_selecionados" ON public.bc_selecionados FOR ALL USING (true);

-- personnel (leitura pública para consulta de nome por token de BC)
DROP POLICY IF EXISTS "Permitir leitura publica de personnel" ON public.personnel;
CREATE POLICY "Permitir leitura publica de personnel" ON public.personnel FOR SELECT USING (true);

-- BLOCO 2 — RECARREGAR SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
