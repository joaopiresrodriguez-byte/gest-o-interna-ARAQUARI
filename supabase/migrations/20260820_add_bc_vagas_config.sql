-- ============================================================
-- ADICIONA SUPORTE A LIMITE DE HORAS/VAGAS DIÁRIAS NA ESCALA BC
-- ============================================================

-- 1. Adiciona coluna de horas padrão por dia no ciclo (padrão: 36h)
ALTER TABLE public.bc_ciclos 
ADD COLUMN IF NOT EXISTS horas_padrao_dia INTEGER DEFAULT 36;

-- 2. Tabela para exceções de limite de horas em dias específicos do mês
CREATE TABLE IF NOT EXISTS public.bc_config_vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID REFERENCES public.bc_ciclos(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  dia DATE NOT NULL,
  horas_disponiveis INTEGER NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes_referencia, dia)
);

-- 3. Habilitar RLS
ALTER TABLE public.bc_config_vagas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acesso_bc_config_vagas" ON public.bc_config_vagas;
CREATE POLICY "acesso_bc_config_vagas"
  ON public.bc_config_vagas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Reload no schema cache
NOTIFY pgrst, 'reload schema';
