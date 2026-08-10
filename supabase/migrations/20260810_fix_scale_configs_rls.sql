-- =========================================================
-- MIGRAÇÃO: Correção de RLS para a tabela scale_configs e escalas
-- Data: 2026-08-10
-- Tabela alvo: scale_configs, escalas
-- =========================================================

DO $$
BEGIN
    -- Fix scale_configs policy
    BEGIN
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users full access to scale_configs" ON scale_configs';
        EXECUTE 'DROP POLICY IF EXISTS "Enable all access for authenticated users" ON scale_configs';
    EXCEPTION WHEN others THEN NULL;
    END;

    EXECUTE 'CREATE POLICY "Enable all access for authenticated users" ON scale_configs FOR ALL USING (true) WITH CHECK (true)';

    -- Fix escalas policy
    BEGIN
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users full access to escalas" ON escalas';
        EXECUTE 'DROP POLICY IF EXISTS "Enable all access for authenticated users" ON escalas';
    EXCEPTION WHEN others THEN NULL;
    END;

    EXECUTE 'CREATE POLICY "Enable all access for authenticated users" ON escalas FOR ALL USING (true) WITH CHECK (true)';
END $$;
