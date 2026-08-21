-- ============================================================
-- CORREÇÃO: Acesso Público (anon) para página de intenção BC
-- Garante que bombeiros comunitários sem conta possam acessar
-- o link de intenção via token sem autenticação.
-- ============================================================

-- 1. Garantir que RLS está ativado nas tabelas
ALTER TABLE IF EXISTS public.bc_ciclos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bc_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personnel    ENABLE ROW LEVEL SECURITY;

-- 2. Remover policies anon conflitantes
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bc_ciclos', 'bc_intencoes', 'personnel')
      AND roles::text LIKE '%anon%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3. Recriar políticas anon definitivas

-- bc_ciclos: leitura pública
CREATE POLICY "anon_select_bc_ciclos"
  ON public.bc_ciclos FOR SELECT TO anon USING (true);

-- bc_intencoes: select, insert e delete públicos (fluxo de intenção via token)
CREATE POLICY "anon_select_bc_intencoes"
  ON public.bc_intencoes FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_bc_intencoes"
  ON public.bc_intencoes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_bc_intencoes"
  ON public.bc_intencoes FOR DELETE TO anon USING (true);

-- personnel: leitura pública para exibir nome do BC pelo token
CREATE POLICY "anon_select_personnel"
  ON public.personnel FOR SELECT TO anon USING (true);

-- 4. Reload do schema cache
NOTIFY pgrst, 'reload schema';
