-- ============================================================
-- MIGRAÇÃO COMPLETA: Renomear colunas PT → EN
-- Para executar: Supabase Dashboard → SQL Editor → New Query
-- Data: 2026-02-11
-- ============================================================

-- ============================================================
-- 1. PERSONNEL (6 renames)
-- ============================================================
ALTER TABLE personnel RENAME COLUMN nome_guerra TO war_name;
ALTER TABLE personnel RENAME COLUMN endereco TO address;
ALTER TABLE personnel RENAME COLUMN data_nascimento TO birth_date;
ALTER TABLE personnel RENAME COLUMN telefone TO phone;
ALTER TABLE personnel RENAME COLUMN tipo_sanguineo TO blood_type;
ALTER TABLE personnel RENAME COLUMN porte_arma TO weapon_permit;

-- ============================================================
-- 2. PERSONNEL_DOCUMENTS (4 renames + 3 new columns)
-- ============================================================
ALTER TABLE personnel_documents RENAME COLUMN nome_arquivo TO file_name;
ALTER TABLE personnel_documents RENAME COLUMN tipo_documento TO document_type;
ALTER TABLE personnel_documents RENAME COLUMN tamanho_kb TO size_kb;
ALTER TABLE personnel_documents RENAME COLUMN observacoes TO notes;

ALTER TABLE personnel_documents ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE personnel_documents ADD COLUMN IF NOT EXISTS upload_date timestamptz DEFAULT now();
ALTER TABLE personnel_documents ADD COLUMN IF NOT EXISTS personnel_id bigint;

-- ============================================================
-- 3. PERSONNEL_VACATIONS (4 renames + 2 new columns)
-- ============================================================
ALTER TABLE personnel_vacations RENAME COLUMN nome_completo TO full_name;
ALTER TABLE personnel_vacations RENAME COLUMN data_inicio TO start_date;
ALTER TABLE personnel_vacations RENAME COLUMN data_fim TO end_date;
ALTER TABLE personnel_vacations RENAME COLUMN observacoes TO notes;

ALTER TABLE personnel_vacations ADD COLUMN IF NOT EXISTS personnel_id bigint;
ALTER TABLE personnel_vacations ADD COLUMN IF NOT EXISTS day_count integer;

-- ============================================================
-- 4. CHECKLIST_ITEMS (5 renames)
-- ============================================================
ALTER TABLE checklist_items RENAME COLUMN categoria TO category;
ALTER TABLE checklist_items RENAME COLUMN nome_item TO item_name;
ALTER TABLE checklist_items RENAME COLUMN descricao TO description;
ALTER TABLE checklist_items RENAME COLUMN ativo TO is_active;
ALTER TABLE checklist_items RENAME COLUMN ordem TO sort_order;

-- ============================================================
-- 5. DAILY_CHECKLISTS (3 renames)
-- ============================================================
ALTER TABLE daily_checklists RENAME COLUMN data_conferencia TO inspection_date;
ALTER TABLE daily_checklists RENAME COLUMN observacoes TO notes;
ALTER TABLE daily_checklists RENAME COLUMN responsavel TO responsible;

-- ============================================================
-- 6. PENDING_NOTICES (4 renames)
-- ============================================================
ALTER TABLE pending_notices RENAME COLUMN conferencia_id TO inspection_id;
ALTER TABLE pending_notices RENAME COLUMN tipo TO type;
ALTER TABLE pending_notices RENAME COLUMN destino_modulo TO target_module;
ALTER TABLE pending_notices RENAME COLUMN descricao TO description;

-- ============================================================
-- 7. DAILY_MISSIONS (6 renames + 2 new columns)
-- Nota: observacoes → notes (rename)
-- ============================================================
ALTER TABLE daily_missions RENAME COLUMN titulo TO title;
ALTER TABLE daily_missions RENAME COLUMN descricao TO description;
ALTER TABLE daily_missions RENAME COLUMN data_missao TO mission_date;
ALTER TABLE daily_missions RENAME COLUMN hora_inicio TO start_time;
ALTER TABLE daily_missions RENAME COLUMN responsavel_id TO responsible_id;
ALTER TABLE daily_missions RENAME COLUMN prioridade TO priority;
ALTER TABLE daily_missions RENAME COLUMN observacoes TO notes;

ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS responsible_name text;
ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS created_by text;

-- ============================================================
-- 8. GU_REPORTS (5 new columns)
-- ============================================================
ALTER TABLE gu_reports ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE gu_reports ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE gu_reports ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE gu_reports ADD COLUMN IF NOT EXISTS report_date date;
ALTER TABLE gu_reports ADD COLUMN IF NOT EXISTS responsible_id text;

-- ============================================================
-- 9. PRODUCT_RECEIPTS (4 renames)
-- ============================================================
ALTER TABLE product_receipts RENAME COLUMN foto_url TO photo_url;
ALTER TABLE product_receipts RENAME COLUMN numero_nota_fiscal TO fiscal_note_number;
ALTER TABLE product_receipts RENAME COLUMN data_recebimento TO receipt_date;
ALTER TABLE product_receipts RENAME COLUMN observacoes TO notes;

-- ============================================================
-- 10. MATERIAS_INSTRUCAO (3 renames + 1 new)
-- Nota: carga_horaria permanece (pode ser mapeado para credit_hours depois)
-- ============================================================
ALTER TABLE materias_instrucao RENAME COLUMN categoria TO category;
ALTER TABLE materias_instrucao RENAME COLUMN nivel TO level;
ALTER TABLE materias_instrucao RENAME COLUMN total_apresentacoes TO total_presentations;

ALTER TABLE materias_instrucao ADD COLUMN IF NOT EXISTS name text;

-- ============================================================
-- 11. MATERIAS_APRESENTACOES (3 renames + 3 new)
-- ============================================================
ALTER TABLE materias_apresentacoes RENAME COLUMN nome_arquivo TO file_name;
ALTER TABLE materias_apresentacoes RENAME COLUMN tamanho_kb TO size_kb;
ALTER TABLE materias_apresentacoes RENAME COLUMN ordem TO sort_order;

ALTER TABLE materias_apresentacoes ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE materias_apresentacoes ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE materias_apresentacoes ADD COLUMN IF NOT EXISTS upload_date timestamptz DEFAULT now();

-- ============================================================
-- 12. MATERIAS_VIDEOS (6 renames + 3 new)
-- ============================================================
ALTER TABLE materias_videos RENAME COLUMN nome_arquivo TO file_name;
ALTER TABLE materias_videos RENAME COLUMN tamanho_mb TO size_mb;
ALTER TABLE materias_videos RENAME COLUMN duracao_segundos TO duration_seconds;
ALTER TABLE materias_videos RENAME COLUMN formato TO format;
ALTER TABLE materias_videos RENAME COLUMN resolucao TO resolution;
ALTER TABLE materias_videos RENAME COLUMN ordem TO sort_order;

ALTER TABLE materias_videos ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE materias_videos ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE materias_videos ADD COLUMN IF NOT EXISTS upload_date timestamptz DEFAULT now();
ALTER TABLE materias_videos ADD COLUMN IF NOT EXISTS video_url text;

-- ============================================================
-- 13. SSCI_ANALYSES (11 renames)
-- ============================================================
ALTER TABLE ssci_analyses RENAME COLUMN tipo_solicitacao TO request_type;
ALTER TABLE ssci_analyses RENAME COLUMN numero_protocolo TO protocol_number;
ALTER TABLE ssci_analyses RENAME COLUMN descricao_solicitacao TO request_description;
ALTER TABLE ssci_analyses RENAME COLUMN resposta_ia TO ai_response;
ALTER TABLE ssci_analyses RENAME COLUMN documentos_anexados TO attached_documents;
ALTER TABLE ssci_analyses RENAME COLUMN normativas_citadas TO cited_normatives;
ALTER TABLE ssci_analyses RENAME COLUMN data_analise TO analysis_date;
ALTER TABLE ssci_analyses RENAME COLUMN usuario_responsavel TO responsible_user;
ALTER TABLE ssci_analyses RENAME COLUMN fonte_web TO web_source;
ALTER TABLE ssci_analyses RENAME COLUMN links_cbmsc TO cbmsc_links;
ALTER TABLE ssci_analyses RENAME COLUMN modelo_ia TO ai_model;

-- ============================================================
-- 14. SSCI_CHAT_SESSIONS (4 renames)
-- ============================================================
ALTER TABLE ssci_chat_sessions RENAME COLUMN usuario TO "user";
ALTER TABLE ssci_chat_sessions RENAME COLUMN titulo_sessao TO session_title;
ALTER TABLE ssci_chat_sessions RENAME COLUMN data_inicio TO start_date;
ALTER TABLE ssci_chat_sessions RENAME COLUMN data_fim TO end_date;

-- ============================================================
-- 15. SSCI_CHAT_MESSAGES (8 renames)
-- ============================================================
ALTER TABLE ssci_chat_messages RENAME COLUMN sessao_id TO session_id;
ALTER TABLE ssci_chat_messages RENAME COLUMN usuario TO "user";
ALTER TABLE ssci_chat_messages RENAME COLUMN mensagem_usuario TO user_message;
ALTER TABLE ssci_chat_messages RENAME COLUMN resposta_ia TO ai_response;
ALTER TABLE ssci_chat_messages RENAME COLUMN normativas_referenciadas TO referenced_normatives;
ALTER TABLE ssci_chat_messages RENAME COLUMN documentos_referenciados TO referenced_documents;
ALTER TABLE ssci_chat_messages RENAME COLUMN timestamp_pergunta TO query_timestamp;
ALTER TABLE ssci_chat_messages RENAME COLUMN timestamp_resposta TO response_timestamp;

-- ============================================================
-- 16. SSCI_NORMATIVE_DOCUMENTS (8 renames + 1 new)
-- ============================================================
ALTER TABLE ssci_normative_documents RENAME COLUMN nome_documento TO document_name;
ALTER TABLE ssci_normative_documents RENAME COLUMN tipo_documento TO document_type;
ALTER TABLE ssci_normative_documents RENAME COLUMN numero_codigo TO code_number;
ALTER TABLE ssci_normative_documents RENAME COLUMN orgao_emissor TO issuing_body;
ALTER TABLE ssci_normative_documents RENAME COLUMN data_publicacao TO publication_date;
ALTER TABLE ssci_normative_documents RENAME COLUMN vezes_referenciado TO times_referenced;
ALTER TABLE ssci_normative_documents RENAME COLUMN data_upload TO upload_date;
ALTER TABLE ssci_normative_documents RENAME COLUMN resumo_ementa TO summary;

ALTER TABLE ssci_normative_documents ADD COLUMN IF NOT EXISTS file_url text;

-- ============================================================
-- 17. TRAINING_SCHEDULE (2 new columns)
-- ============================================================
ALTER TABLE training_schedule ADD COLUMN IF NOT EXISTS materia_id uuid;
ALTER TABLE training_schedule ADD COLUMN IF NOT EXISTS location text;

-- ============================================================
-- 18. CRIAR TABELA MISSIONS (nova)
-- ============================================================
CREATE TABLE IF NOT EXISTS missions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    date date NOT NULL,
    completed boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to missions" ON missions
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 19. CRIAR TABELA PURCHASES (nova)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item text NOT NULL,
    quantity integer DEFAULT 1,
    unit_price numeric DEFAULT 0,
    supplier text,
    status text DEFAULT 'Pendente',
    requester text,
    request_date timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to purchases" ON purchases
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 20. RLS POLICIES (garantir acesso para tabelas existentes)
-- ============================================================
-- Nota: Só criar se não existir. Erros de "policy already exists" podem ser ignorados.
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'personnel', 'personnel_documents', 'personnel_vacations',
        'fleet', 'checklist_items', 'daily_checklists', 'pending_notices',
        'daily_missions', 'gu_reports', 'product_receipts',
        'materias_instrucao', 'materias_apresentacoes', 'materias_videos',
        'social_posts', 'training_schedule',
        'ssci_analyses', 'ssci_chat_sessions', 'ssci_chat_messages',
        'ssci_normative_documents', 'ssci_document_usage'
    ])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        BEGIN
            EXECUTE format(
                'CREATE POLICY "Allow authenticated full access" ON %I FOR ALL USING (auth.role() = ''authenticated'')',
                tbl
            );
        EXCEPTION WHEN duplicate_object THEN
            -- Policy already exists, skip
            NULL;
        END;
    END LOOP;
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
-- Resultado esperado: Todas as tabelas com colunas em inglês
-- Próximo passo: Rodar verify-all-tables.ts para confirmar
