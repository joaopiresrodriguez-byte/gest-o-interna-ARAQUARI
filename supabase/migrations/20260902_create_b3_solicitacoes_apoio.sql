-- ============================================================
-- MIGRAÇÃO B3: Cadastro WhatsApp e Solicitações de Apoio
-- Data: 2026-09-02
-- ============================================================

-- Números de WhatsApp cadastrados para receber o link de solicitação
CREATE TABLE IF NOT EXISTS public.b3_whatsapp_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  nome_contato TEXT,
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  token_link TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  cadastrado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações de apoio enviadas pelos cidadãos via link público
CREATE TABLE IF NOT EXISTS public.b3_solicitacoes_apoio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_solicitacao TEXT UNIQUE,
  whatsapp_origem_id UUID REFERENCES public.b3_whatsapp_cadastros(id),
  responsavel_nome TEXT NOT NULL,
  responsavel_telefone TEXT,
  tema TEXT NOT NULL,
  dia DATE NOT NULL,
  horario TIME NOT NULL,
  endereco TEXT NOT NULL,
  complemento TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'deferida', 'indeferida', 'em_analise')),
  parecer_gestor TEXT,
  analisado_por UUID,
  analisado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.b3_whatsapp_cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_solicitacoes_apoio ENABLE ROW LEVEL SECURITY;

-- Limpar policies existentes se re-executado
DROP POLICY IF EXISTS "b3_whatsapp_auth" ON public.b3_whatsapp_cadastros;
DROP POLICY IF EXISTS "b3_solicitacoes_auth" ON public.b3_solicitacoes_apoio;
DROP POLICY IF EXISTS "b3_solicitacoes_insert_anon" ON public.b3_solicitacoes_apoio;
DROP POLICY IF EXISTS "b3_whatsapp_select_anon" ON public.b3_whatsapp_cadastros;

-- Policies autenticados
CREATE POLICY "b3_whatsapp_auth"
  ON public.b3_whatsapp_cadastros
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "b3_solicitacoes_auth"
  ON public.b3_solicitacoes_apoio
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Policy pública para inserção via formulário sem login
CREATE POLICY "b3_solicitacoes_insert_anon"
  ON public.b3_solicitacoes_apoio
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "b3_whatsapp_select_anon"
  ON public.b3_whatsapp_cadastros
  FOR SELECT TO anon
  USING (ativo = true);

-- Function e Trigger para geração de número automático SAP-[ANO]-[SEQUENCIAL 4 DÍGITOS]
CREATE OR REPLACE FUNCTION public.gerar_numero_solicitacao()
RETURNS TRIGGER AS $$
DECLARE
  ano TEXT := TO_CHAR(NOW(), 'YYYY');
  seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM public.b3_solicitacoes_apoio
  WHERE numero_solicitacao LIKE 'SAP-' || ano || '-%';

  NEW.numero_solicitacao := 'SAP-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_numero_solicitacao ON public.b3_solicitacoes_apoio;

CREATE TRIGGER trigger_numero_solicitacao
  BEFORE INSERT ON public.b3_solicitacoes_apoio
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_numero_solicitacao();

NOTIFY pgrst, 'reload schema';
