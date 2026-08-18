-- Migration: Create cautelas table and update vehicles for loan management
-- Date: 2026-08-18

CREATE TABLE IF NOT EXISTS public.cautelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_cautela TEXT UNIQUE NOT NULL,
    item_id TEXT, -- Alterado de UUID para TEXT para aceitar IDs como 'ITEM-1786118218427'
    tipo_item TEXT NOT NULL DEFAULT 'equipamento', -- 'equipamento' | 'viatura' | 'Material'
    item_nome TEXT NOT NULL,
    solicitante TEXT NOT NULL,
    retirado_por TEXT NOT NULL,
    data_retirada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_prevista_devolucao TIMESTAMPTZ,
    data_devolucao_real TIMESTAMPTZ,
    condicao_devolucao TEXT, -- 'perfeito_estado' | 'avaria_leve' | 'avaria_grave' | 'item_perdido'
    observacoes TEXT,
    observacoes_devolucao TEXT,
    motivo_cancelamento TEXT,
    status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'devolvido' | 'cancelado'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que a coluna item_id seja do tipo TEXT se a tabela já existia
DO $$
BEGIN
    ALTER TABLE public.cautelas ALTER COLUMN item_id TYPE TEXT USING item_id::text;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_cautelas_status ON public.cautelas(status);
CREATE INDEX IF NOT EXISTS idx_cautelas_item_id ON public.cautelas(item_id);
CREATE INDEX IF NOT EXISTS idx_cautelas_numero ON public.cautelas(numero_cautela);

-- Enable RLS
ALTER TABLE public.cautelas ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated users
DROP POLICY IF EXISTS "Allow all access to authenticated users on cautelas" ON public.cautelas;
CREATE POLICY "Allow all access to authenticated users on cautelas"
    ON public.cautelas FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow read/write access for anon users
DROP POLICY IF EXISTS "Allow anon read access on cautelas" ON public.cautelas;
DROP POLICY IF EXISTS "Allow all access to anon users on cautelas" ON public.cautelas;
CREATE POLICY "Allow all access to anon users on cautelas"
    ON public.cautelas FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_cautelas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cautelas_updated_at ON public.cautelas;
CREATE TRIGGER trigger_update_cautelas_updated_at
    BEFORE UPDATE ON public.cautelas
    FOR EACH ROW
    EXECUTE FUNCTION update_cautelas_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
