-- Migration: adiciona coluna atividades_responsavel à tabela personnel
-- Permite vincular militares como responsáveis por atividades operacionais do B4

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS atividades_responsavel text[] DEFAULT '{}';

-- Índice GIN para buscas eficientes dentro do array
CREATE INDEX IF NOT EXISTS idx_personnel_atividades_responsavel
  ON public.personnel USING GIN (atividades_responsavel);

COMMENT ON COLUMN public.personnel.atividades_responsavel
  IS 'Atividades operacionais B4 pelas quais este militar é responsável (array de strings)';
