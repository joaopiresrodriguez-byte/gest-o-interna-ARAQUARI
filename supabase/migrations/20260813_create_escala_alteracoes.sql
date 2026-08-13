-- ============================================================
-- MIGRAÇÃO: Tabela escala_alteracoes (BLOCO 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.escala_alteracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_alteracao TEXT NOT NULL, -- 'troca_militares' | 'troca_individual' | 'transferencia_guarnicao'
    militar_a_id BIGINT REFERENCES public.personnel(id) ON DELETE SET NULL,
    militar_b_id BIGINT REFERENCES public.personnel(id) ON DELETE SET NULL,
    dia_original_a DATE,
    dia_original_b DATE,
    guarnicao_origem_id UUID REFERENCES public.guarnicoes(id) ON DELETE SET NULL,
    guarnicao_destino_id UUID REFERENCES public.guarnicoes(id) ON DELETE SET NULL,
    data_vigencia DATE,
    detalhes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    criado_por TEXT DEFAULT 'Administrador B1'
);

-- Habilitar RLS
ALTER TABLE public.escala_alteracoes ENABLE ROW LEVEL SECURITY;

-- Politica permissiva para leitura e escrita autenticada
DROP POLICY IF EXISTS allow_all_escala_alteracoes ON public.escala_alteracoes;
CREATE POLICY allow_all_escala_alteracoes ON public.escala_alteracoes FOR ALL USING (true);
