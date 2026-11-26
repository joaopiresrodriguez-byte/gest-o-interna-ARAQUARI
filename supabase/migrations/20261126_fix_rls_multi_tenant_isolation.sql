-- ============================================================
-- MIGRAÇÃO SAAS FASE 3: ISOLAMENTO COMPLETO MULTI-TENANT (RLS)
-- Data: 2026-11-26
-- Objetivo:
--   1. Adicionar organization_id (com índice e DEFAULT dinâmico) nas 35 tabelas restantes.
--   2. Atualizar o DEFAULT das 13 tabelas existentes para resolver dinamicamente a org do usuário autenticado.
--   3. Remover TODAS as políticas RLS permissivas antigas (USING true / has_* sem org) das 48 tabelas operacionais.
--   4. Garantir tenant_isolation_policy única e estrita para authenticated em todas as 48 tabelas.
--   5. Atualizar trigger sync_fleet_to_checklist para propagar organization_id corretamente.
--   6. Proteger organizations, tenant_settings e profiles contra alterações cross-tenant.
-- ============================================================

-- 1. FUNÇÕES AUXILIARES SEGURAS
CREATE OR REPLACE FUNCTION public.get_auth_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_manager = true
      AND status = 'ativo'
      AND organization_id = target_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_manager()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_manager = true
      AND status = 'ativo'
  );
END;
$$;

-- 2. ATUALIZAR TRIGGER sync_fleet_to_checklist PARA MULTITENANCY
CREATE OR REPLACE FUNCTION public.sync_fleet_to_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_local_id TEXT;
  v_descricao TEXT;
BEGIN
  IF NEW.type = 'Viatura' THEN
    RETURN NEW;
  END IF;

  IF NEW.local_id IS NOT NULL THEN
    v_local_id := NEW.local_id::text;
  ELSE
    SELECT le.id::text INTO v_local_id
    FROM public.locais_equipamento le
    WHERE le.organization_id = NEW.organization_id
      AND LOWER(TRIM(le.nome)) = LOWER(TRIM(COALESCE(NEW.location, '')))
    LIMIT 1;
  END IF;

  IF v_local_id IS NULL THEN
    SELECT le.id::text INTO v_local_id
    FROM public.locais_equipamento le
    WHERE le.organization_id = NEW.organization_id
      AND LOWER(le.nome) LIKE '%reserva%'
    LIMIT 1;
  END IF;

  IF v_local_id IS NULL THEN
    SELECT le.id::text INTO v_local_id
    FROM public.locais_equipamento le
    WHERE le.organization_id = NEW.organization_id
      AND LOWER(le.nome) LIKE '%central%'
    LIMIT 1;
  END IF;

  BEGIN
    IF NEW.details IS NOT NULL AND NEW.details::text LIKE '{%' THEN
      v_descricao := COALESCE(
        (NEW.details::jsonb->>'raw'),
        (NEW.details::jsonb->>'descricao'),
        ''
      );
    ELSE
      v_descricao := COALESCE(NEW.details::text, '');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_descricao := '';
  END;

  INSERT INTO public.checklist_items (
    id,
    item_name,
    category,
    description,
    is_active,
    sort_order,
    quantidade,
    viatura_id,
    compartimento_id,
    organization_id,
    created_at
  ) VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.type, 'Equipamento'),
    v_descricao,
    CASE WHEN NEW.status = 'active' OR NEW.status IS NULL THEN true ELSE false END,
    0,
    COALESCE(NEW.quantidade, 1),
    v_local_id,
    NEW.compartimento_id,
    NEW.organization_id,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    item_name        = EXCLUDED.item_name,
    category         = EXCLUDED.category,
    description      = EXCLUDED.description,
    is_active        = EXCLUDED.is_active,
    quantidade       = EXCLUDED.quantidade,
    viatura_id       = COALESCE(EXCLUDED.viatura_id, checklist_items.viatura_id),
    compartimento_id = COALESCE(EXCLUDED.compartimento_id, checklist_items.compartimento_id),
    organization_id  = EXCLUDED.organization_id;

  RETURN NEW;
END;
$$;

-- 3. TRIGGER PARA HERDAR organization_id EM SOLICITAÇÕES PÚBLICAS DE APOIO (B3)
CREATE OR REPLACE FUNCTION public.fn_set_solicitacao_apoio_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.whatsapp_origem_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.b3_whatsapp_cadastros
    WHERE id = NEW.whatsapp_origem_id
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      NEW.organization_id := v_org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. ADICIONAR organization_id NAS TABELAS QUE AINDA NÃO POSSUEM + APLICAR RLS ESTRITO EM TODAS AS 48 TABELAS
DO $$
DECLARE
  v_tables_missing_org text[] := ARRAY[
    'b3_solicitacoes_apoio',
    'b3_whatsapp_cadastros',
    'b4_relatorios',
    'bc_ciclos',
    'bc_config_vagas',
    'bc_intencoes',
    'bc_selecionados',
    'compartimentos_viatura',
    'daily_checklists',
    'disciplinary_records',
    'epi_deliveries',
    'escala_alteracoes',
    'gu_reports',
    'guarnicao_membros',
    'historico_graduacao',
    'internal_notifications',
    'materias_apresentacoes',
    'materias_instrucao',
    'materias_videos',
    'pending_notices',
    'personnel_documents',
    'personnel_vacations',
    'purchases',
    'rank_history',
    'scale_audit_log',
    'scale_configs',
    'scale_exceptions',
    'service_swaps',
    'social_posts',
    'ssci_analyses',
    'ssci_chat_messages',
    'ssci_chat_sessions',
    'ssci_document_usage',
    'ssci_normative_documents',
    'user_access_logs'
  ];

  v_all_tenant_tables text[] := ARRAY[
    'b1_courses',
    'b3_solicitacoes_apoio',
    'b3_whatsapp_cadastros',
    'b4_relatorios',
    'baixa_patrimonio',
    'bc_ciclos',
    'bc_config_vagas',
    'bc_intencoes',
    'bc_selecionados',
    'cautelas',
    'checklist_items',
    'compartimentos_viatura',
    'daily_checklists',
    'daily_missions',
    'disciplinary_records',
    'epi_deliveries',
    'escala_alteracoes',
    'escalas',
    'fleet',
    'gu_reports',
    'guarnicao_membros',
    'guarnicoes',
    'historico_conferencias_b4',
    'historico_graduacao',
    'internal_notifications',
    'locais_equipamento',
    'materias_apresentacoes',
    'materias_instrucao',
    'materias_videos',
    'pending_notices',
    'personnel',
    'personnel_documents',
    'personnel_vacations',
    'product_receipts',
    'purchases',
    'rank_history',
    'scale_audit_log',
    'scale_configs',
    'scale_exceptions',
    'service_swaps',
    'social_posts',
    'ssci_analyses',
    'ssci_chat_messages',
    'ssci_chat_sessions',
    'ssci_document_usage',
    'ssci_normative_documents',
    'training_schedule',
    'user_access_logs'
  ];

  tbl text;
  pol record;
BEGIN
  -- 4a. Adicionar coluna organization_id (todos os dados legados recebem a org padrão CBMSC Araquari)
  FOREACH tbl IN ARRAY v_tables_missing_org LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT ''00000000-0000-0000-0000-000000000001''::uuid REFERENCES public.organizations(id);',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id);',
      'idx_' || tbl || '_organization_id',
      tbl
    );
  END LOOP;

  -- 4b. Atualizar DEFAULT para resolver dinamicamente a org do usuário autenticado
  --     (fallback para org padrão apenas se auth.uid() for nulo, ex: scripts/triggers anon)
  --     e remover TODAS as políticas antigas permissivas, aplicando apenas tenant_isolation_policy.
  FOREACH tbl IN ARRAY v_all_tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT COALESCE(public.get_auth_user_organization_id(), ''00000000-0000-0000-0000-000000000001''::uuid);',
      tbl
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY "tenant_isolation_policy" ON public.%I FOR ALL TO authenticated USING (organization_id = public.get_auth_user_organization_id()) WITH CHECK (organization_id = public.get_auth_user_organization_id());',
      tbl
    );
  END LOOP;
END $$;

-- Vincular trigger de b3_solicitacoes_apoio após coluna organization_id existir
DROP TRIGGER IF EXISTS trg_set_solicitacao_apoio_org ON public.b3_solicitacoes_apoio;
CREATE TRIGGER trg_set_solicitacao_apoio_org
  BEFORE INSERT ON public.b3_solicitacoes_apoio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_solicitacao_apoio_org();

-- 5. PROTEGER TABELAS DE REGISTRO DE TENANT (organizations, tenant_settings, profiles)
DO $$
DECLARE
  pol record;
BEGIN
  -- organizations
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations;', pol.policyname);
  END LOOP;

  CREATE POLICY "organizations_select_all" ON public.organizations
    FOR SELECT USING (true);
  CREATE POLICY "organizations_insert_signup" ON public.organizations
    FOR INSERT TO authenticated, anon WITH CHECK (true);
  CREATE POLICY "organizations_manager_update" ON public.organizations
    FOR UPDATE TO authenticated
    USING (public.is_manager_of_org(id))
    WITH CHECK (public.is_manager_of_org(id));

  -- tenant_settings
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_settings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_settings;', pol.policyname);
  END LOOP;

  CREATE POLICY "tenant_settings_select_all" ON public.tenant_settings
    FOR SELECT USING (true);
  CREATE POLICY "tenant_settings_manager_insert" ON public.tenant_settings
    FOR INSERT TO authenticated
    WITH CHECK (public.is_manager_of_org(organization_id));
  CREATE POLICY "tenant_settings_manager_update" ON public.tenant_settings
    FOR UPDATE TO authenticated
    USING (public.is_manager_of_org(organization_id))
    WITH CHECK (public.is_manager_of_org(organization_id));
  CREATE POLICY "tenant_settings_manager_delete" ON public.tenant_settings
    FOR DELETE TO authenticated
    USING (public.is_manager_of_org(organization_id));

  -- profiles
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname);
  END LOOP;

  CREATE POLICY "profiles_select_isolated" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_manager_of_org(organization_id));

  CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "profiles_update_isolated" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.is_manager_of_org(organization_id))
    WITH CHECK (
      public.is_manager_of_org(organization_id)
      OR (auth.uid() = id AND organization_id = public.get_auth_user_organization_id())
    );
END $$;

-- 6. POLÍTICAS PÚBLICAS (EXCLUSIVAMENTE TO anon — NUNCA AFETAM USUÁRIOS AUTENTICADOS)
-- Mantêm funcionamento das rotas públicas (/solicitar-apoio, /escala-publica, /bc-intencao, /extrato)
CREATE POLICY "anon_select_b3_whatsapp" ON public.b3_whatsapp_cadastros
  FOR SELECT TO anon USING (ativo = true);

CREATE POLICY "anon_insert_b3_solicitacoes" ON public.b3_solicitacoes_apoio
  FOR INSERT TO anon WITH CHECK (whatsapp_origem_id IS NOT NULL);

CREATE POLICY "anon_select_bc_ciclos" ON public.bc_ciclos
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_bc_config_vagas" ON public.bc_config_vagas
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_bc_selecionados" ON public.bc_selecionados
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_bc_intencoes" ON public.bc_intencoes
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "anon_insert_bc_intencoes" ON public.bc_intencoes
  FOR INSERT TO anon WITH CHECK (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "anon_delete_bc_intencoes" ON public.bc_intencoes
  FOR DELETE TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_escalas" ON public.escalas
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_personnel" ON public.personnel
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_personnel_vacations" ON public.personnel_vacations
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_fleet" ON public.fleet
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_locais_equipamento" ON public.locais_equipamento
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_compartimentos_viatura" ON public.compartimentos_viatura
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_checklist_items" ON public.checklist_items
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "anon_select_cautelas" ON public.cautelas
  FOR SELECT TO anon USING (organization_id = '00000000-0000-0000-0000-000000000001'::uuid);
