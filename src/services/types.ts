import { supabase } from './supabase';

export interface Mission {
    id?: number;
    text: string;
    time: string;
    date: string;
    completed: boolean;
}

export interface Vehicle {
    id: string;
    name: string;
    type: 'Viatura' | 'Equipamento' | 'Material' | 'Outro';
    status: 'active' | 'down' | 'maintenance';
    details: string;
    plate?: string;
}

export interface Personnel {
    id?: number;
    name: string;
    rank: string;
    role: string;
    status: 'ATIVO' | 'FÉRIAS' | 'EM CURSO';
    type: 'BM' | 'BC';
    image?: string;
}

export interface GuReport {
    id?: string;
    report_text: string;
    date: string;
}

export interface MateriaInstrucao {
    id?: string;
    nome_materia: string;
    carga_horaria: number;
    categoria?: string;
    nivel?: 'basico' | 'intermediario' | 'avancado';
    descricao_ementa?: string;
    instrutor_principal?: string;
    observacoes?: string;
    status?: 'ativa' | 'inativa';
    total_apresentacoes?: number;
    total_videos?: number;
    criado_por?: string;
    created_at?: string;
    updated_at?: string;
}

export interface MateriaApresentacao {
    id?: string;
    materia_id: string;
    titulo_apresentacao: string;
    arquivo_url: string;
    nome_arquivo: string;
    tamanho_kb?: number;
    numero_paginas?: number;
    ordem?: number;
    uploaded_by?: string;
    data_upload?: string;
}

export interface MateriaVideo {
    id?: string;
    materia_id: string;
    titulo_video: string;
    arquivo_url: string;
    thumbnail_url?: string;
    nome_arquivo: string;
    tamanho_mb?: number;
    duracao_segundos?: number;
    formato?: string;
    resolucao?: string;
    ordem?: number;
    uploaded_by?: string;
    data_upload?: string;
}

export interface Training {
    id?: string;
    course_id?: string;
    materia_id?: string;
    date: string;
    time: string;
    instructor: string;
    status: string;
    materia?: MateriaInstrucao;
}

export interface Purchase {
    id?: string;
    item_name: string;
    cost: number;
    status: 'Pendente' | 'Aprovado';
    requester: string;
}

export interface SocialPost {
    id?: string;
    content: string;
    platform: 'Instagram' | 'Facebook';
    likes: number;
    image_url: string;
    created_at?: string;
}

export interface ProductReceipt {
    id?: string;
    foto_url: string;
    numero_nota_fiscal: string;
    data_recebimento?: string;
    observacoes?: string;
    created_at?: string;
}

export interface ChecklistItem {
    id: string;
    categoria: 'materiais' | 'equipamentos' | 'viaturas';
    nome_item: string;
    viatura_id?: string;
    descricao?: string;
    ativo?: boolean;
    ordem?: number;
}

export interface DailyChecklist {
    id?: string;
    item_id: string;
    viatura_id?: string;
    data_conferencia?: string;
    status: 'ok' | 'faltante';
    observacoes?: string;
    responsavel?: string;
    item?: ChecklistItem;
}

export interface PendingNotice {
    id?: string;
    conferencia_id?: string;
    tipo: 'viatura' | 'material';
    destino_modulo: 'B4';
    viatura_id?: string;
    descricao: string;
    status: 'pendente' | 'resolvido';
    created_at?: string;
}

export interface DocumentB1 {
    id?: string;
    nome_arquivo: string;
    tipo_documento: string;
    arquivo_url: string;
    tamanho_kb?: number;
    uploaded_by?: string;
    data_upload?: string;
    observacoes?: string;
}

export interface Vacation {
    id?: string;
    bm_bc_id: number;
    nome_completo: string;
    data_inicio: string;
    data_fim: string;
    quantidade_dias: number;
    status?: 'planejado' | 'aprovado' | 'em_andamento' | 'concluido';
    observacoes?: string;
}

export interface SSCIAnalysis {
    id?: string;
    tipo_solicitacao: 'requerimento' | 'recurso';
    numero_protocolo: string;
    descricao_solicitacao: string;
    resposta_ia: string;
    documentos_anexados?: string[];
    data_analise?: string;
    usuario_responsavel?: string;
    status?: string;
    fonte_web?: any;
    links_cbmsc?: string[];
    modelo_ia?: string;
    normativas_citadas?: string[];
}

export interface DailyMission {
    id?: string;
    titulo: string;
    descricao?: string;
    data_missao: string;
    hora_inicio?: string;
    hora_termino?: string;
    responsavel_id?: string;
    responsavel_nome?: string;
    prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
    status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
    observacoes?: string;
    cadastrado_por?: string;
    data_cadastro?: string;
    ultima_atualizacao?: string;
    created_at?: string;
}

export interface SSCIChatSession {
    id?: string;
    usuario?: string;
    titulo_sessao?: string;
    data_inicio?: string;
    data_fim?: string;
    status?: string;
}

export interface SSCIChatMessage {
    id?: string;
    sessao_id: string;
    usuario?: string;
    mensagem_usuario: string;
    resposta_ia: string;
    normativas_referenciadas?: any;
    documentos_referenciados?: any;
    timestamp_pergunta?: string;
    timestamp_resposta?: string;
}

export interface SSCINormativeDocument {
    id?: string;
    nome_documento: string;
    tipo_documento: string;
    numero_codigo?: string;
    orgao_emissor?: string;
    data_publicacao?: string;
    data_vigencia?: string;
    resumo_ementa?: string;
    tags?: string[];
    categoria?: string;
    arquivo_url: string;
    tamanho_kb?: number;
    status?: string;
    vezes_referenciado?: number;
    uploaded_by?: string;
    data_upload?: string;
}
