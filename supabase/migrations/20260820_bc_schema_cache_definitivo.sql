-- ============================================================
-- BLOCO 0 — CORREÇÃO DEFINITIVA DO SCHEMA CACHE BC
-- Execute este script INTEIRO no Supabase SQL Editor
-- ============================================================

-- PASSO 2: Drop e recriação completa com UUID (sem FK para personnel pois bombeiro_id é livre)
DROP TABLE IF EXISTS public.bc_selecionados CASCADE;
DROP TABLE IF EXISTS public.bc_intencoes CASCADE;
DROP TABLE IF EXISTS public.bc_ciclos CASCADE;

-- bc_ciclos
CREATE TABLE public.bc_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia TEXT NOT NULL UNIQUE,
  data_abertura DATE NOT NULL,
  data_encerramento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- bc_intencoes (bombeiro_id TEXT para compatibilidade com INTEGER e UUID)
CREATE TABLE public.bc_intencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bombeiro_id TEXT,
  ciclo_id UUID REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  dia DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  total_horas INTEGER NOT NULL CHECK (total_horas IN (12, 24)),
  status TEXT NOT NULL DEFAULT 'pendente',
  token_acesso TEXT UNIQUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- bc_selecionados
CREATE TABLE public.bc_selecionados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bombeiro_id TEXT,
  ciclo_id UUID REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  total_horas INTEGER NOT NULL,
  criterio_aplicado TEXT,
  posicao_ranking INTEGER,
  origem TEXT DEFAULT 'motor',
  motivo_excecao TEXT,
  motivo_substituicao TEXT,
  substituido_por_gestor BOOLEAN DEFAULT FALSE,
  notificado BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- PASSO 3: Habilitar RLS e criar policies
ALTER TABLE public.bc_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_selecionados ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "acesso_bc_ciclos" ON public.bc_ciclos;
DROP POLICY IF EXISTS "acesso_bc_intencoes" ON public.bc_intencoes;
DROP POLICY IF EXISTS "acesso_bc_selecionados" ON public.bc_selecionados;
DROP POLICY IF EXISTS "publico_bc_intencoes" ON public.bc_intencoes;
DROP POLICY IF EXISTS "acesso_autenticado_bc_ciclos" ON public.bc_ciclos;
DROP POLICY IF EXISTS "acesso_autenticado_bc_intencoes" ON public.bc_intencoes;
DROP POLICY IF EXISTS "acesso_autenticado_bc_selecionados" ON public.bc_selecionados;

-- Policies para usuários autenticados
CREATE POLICY "acesso_bc_ciclos"
  ON public.bc_ciclos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "acesso_bc_intencoes"
  ON public.bc_intencoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "acesso_bc_selecionados"
  ON public.bc_selecionados FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Policy pública para página de intenção (acesso sem login via token)
CREATE POLICY "publico_bc_intencoes"
  ON public.bc_intencoes FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "publico_bc_ciclos"
  ON public.bc_ciclos FOR SELECT TO anon
  USING (true);

-- PASSO 4: Forçar reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
