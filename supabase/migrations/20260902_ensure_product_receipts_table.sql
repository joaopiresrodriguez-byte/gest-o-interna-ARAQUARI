-- ============================================================
-- MIGRAÇÃO: Garantir tabela product_receipts com estrutura correta
-- Data: 2026-09-02
-- Motivo: Nenhuma migration anterior criava a tabela explicitamente
--         (só renomeava colunas assumindo que ela já existia).
--         Se o banco foi recriado ou a tabela não existe, recebimentos
--         são inseridos mas nunca listados (erro silenciado no serviço).
-- ============================================================

-- Cria a tabela caso não exista (safe para re-executar)
CREATE TABLE IF NOT EXISTS product_receipts (
    id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    photo_url          text,
    fiscal_note_number text,
    receipt_date       timestamptz DEFAULT now(),
    notes              text,
    created_at         timestamptz DEFAULT now()
);

-- Garante RLS habilitado
ALTER TABLE product_receipts ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas conflitantes e cria uma permissiva
DROP POLICY IF EXISTS "Allow authenticated full access" ON product_receipts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON product_receipts;

CREATE POLICY "Enable all access for authenticated users"
    ON product_receipts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
