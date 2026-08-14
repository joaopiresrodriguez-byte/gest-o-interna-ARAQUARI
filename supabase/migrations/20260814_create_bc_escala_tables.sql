-- Migração para o Módulo de Bombeiros Comunitários (Escala Automatizada)
-- Tabelas: bc_ciclos, bc_intencoes, bc_selecionados

-- 1. Tabela bc_ciclos (Controla os ciclos mensais de coleta)
CREATE TABLE IF NOT EXISTS public.bc_ciclos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mes_referencia TEXT NOT NULL, -- Ex: '2026-09'
    data_abertura TIMESTAMPTZ NOT NULL,
    data_encerramento TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado', 'processado', 'publicado')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para busca rápida por mes_referencia e status
CREATE INDEX IF NOT EXISTS idx_bc_ciclos_mes_status ON public.bc_ciclos(mes_referencia, status);

-- 2. Tabela bc_intencoes (Armazena intenções de serviço)
CREATE TABLE IF NOT EXISTS public.bc_intencoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bombeiro_id INTEGER NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    dia TEXT NOT NULL, -- Format YYYY-MM-DD
    horario_inicio TEXT NOT NULL, -- Format HH:mm (Ex: '07:00')
    horario_fim TEXT NOT NULL, -- Format HH:mm (Ex: '19:00')
    total_horas NUMERIC(4, 1) NOT NULL, -- 12.0 ou 24.0
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'rejeitada')),
    token_acesso TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para consulta de token e bombeiro por mês
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_token ON public.bc_intencoes(token_acesso);
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_bombeiro_mes ON public.bc_intencoes(bombeiro_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_bc_intencoes_dia ON public.bc_intencoes(dia);

-- 3. Tabela bc_selecionados (Armazena bombeiros selecionados pelo motor ou gestor)
CREATE TABLE IF NOT EXISTS public.bc_selecionados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bombeiro_id INTEGER NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    dia TEXT NOT NULL, -- Format YYYY-MM-DD
    horario_inicio TEXT NOT NULL,
    horario_fim TEXT NOT NULL,
    total_horas NUMERIC(4, 1) NOT NULL,
    criterio_aplicado TEXT NOT NULL, -- Ex: 'Critério 1 (Promoção)', 'Critério 2 (CNH/CVE)', 'Inserção Manual Gestor'
    posicao_ranking INTEGER NOT NULL DEFAULT 1,
    notificado BOOLEAN NOT NULL DEFAULT FALSE,
    substituido_por_gestor BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_substituicao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_selecionados_dia ON public.bc_selecionados(dia);
CREATE INDEX IF NOT EXISTS idx_bc_selecionados_bombeiro ON public.bc_selecionados(bombeiro_id);

-- Desabilitar RLS ou permitir leitura/escrita pública com anon se necessário para token público
ALTER TABLE public.bc_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_selecionados ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura anonima de bc_ciclos" ON public.bc_ciclos FOR SELECT USING (true);
CREATE POLICY "Permitir gestao total de bc_ciclos" ON public.bc_ciclos FOR ALL USING (true);

CREATE POLICY "Permitir operacao publica com token em bc_intencoes" ON public.bc_intencoes FOR ALL USING (true);
CREATE POLICY "Permitir gestao total de bc_intencoes" ON public.bc_intencoes FOR ALL USING (true);

CREATE POLICY "Permitir gestao total de bc_selecionados" ON public.bc_selecionados FOR ALL USING (true);
