-- Migração de correção de Schema Cache para tabelas do módulo BC (Escala automatizada)

CREATE TABLE IF NOT EXISTS public.bc_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia TEXT NOT NULL,
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_encerramento DATE NOT NULL DEFAULT CURRENT_DATE + INTERVAL '5 days',
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado', 'processado', 'publicado')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

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

-- Habilitar RLS
ALTER TABLE public.bc_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bc_selecionados ENABLE ROW LEVEL SECURITY;

-- Creating policies safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'acesso_autenticado_bc_ciclos' AND tablename = 'bc_ciclos') THEN
    CREATE POLICY "acesso_autenticado_bc_ciclos" ON public.bc_ciclos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'acesso_autenticado_bc_intencoes' AND tablename = 'bc_intencoes') THEN
    CREATE POLICY "acesso_autenticado_bc_intencoes" ON public.bc_intencoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'acesso_autenticado_bc_selecionados' AND tablename = 'bc_selecionados') THEN
    CREATE POLICY "acesso_autenticado_bc_selecionados" ON public.bc_selecionados FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
