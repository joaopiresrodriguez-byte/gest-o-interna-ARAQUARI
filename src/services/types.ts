

export interface Mission {
    id?: string;
    title: string;
    description?: string;
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
    current_km?: number;
    last_revision?: string;
}

export interface Personnel {
    id?: number;
    name: string;
    war_name?: string;
    rank: string;
    role: string;
    status: 'ATIVO' | 'FÉRIAS' | 'EM CURSO';
    type: 'BM' | 'BC';
    address?: string;
    email?: string;
    birth_date?: string;
    phone?: string;
    blood_type?: string;
    cnh?: string;
    weapon_permit?: boolean;
    image?: string;
}

export interface GuReport {
    id?: string;
    title: string;
    description: string;
    type: string;
    report_date: string;
    responsible_id: string;
    created_at?: string;
}

export interface MateriaInstrucao {
    id?: string;
    name: string;
    credit_hours: number;
    category?: string;
    level?: 'basico' | 'intermediario' | 'avancado';
    description?: string;
    instructor?: string;
    notes?: string;
    status?: 'active' | 'inactive';
    total_presentations?: number;
    total_videos?: number;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

export interface MateriaApresentacao {
    id?: string;
    materia_id: string;
    title: string;
    file_url: string;
    file_name: string;
    size_kb?: number;
    page_count?: number;
    sort_order?: number;
    uploaded_by?: string;
    upload_date?: string;
}

export interface MateriaVideo {
    id?: string;
    materia_id: string;
    title: string;
    file_url: string;
    thumbnail_url?: string;
    file_name: string;
    size_mb?: number;
    duration_seconds?: number;
    format?: string;
    resolution?: string;
    sort_order?: number;
    uploaded_by?: string;
    upload_date?: string;
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
    item: string;
    quantity: number;
    unit_price: number;
    supplier?: string;
    status: 'Pendente' | 'Aprovado';
    requester: string;
    created_at?: string;
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
    photo_url: string;
    fiscal_note_number: string;
    receipt_date?: string;
    product?: string;
    quantity?: number;
    supplier?: string;
    notes?: string;
    created_at?: string;
}

export interface ChecklistItem {
    id: string;
    category: 'materiais' | 'equipamentos' | 'viaturas';
    item_name: string;
    viatura_id?: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
}

export interface DailyChecklist {
    id?: string;
    item_id: string;
    viatura_id?: string;
    inspection_date?: string;
    status: 'ok' | 'faltante';
    notes?: string;
    responsible?: string;
    item?: ChecklistItem;
    vehicle?: Vehicle;
    created_at?: string;
}

export interface PendingNotice {
    id?: string;
    inspection_id?: string;
    type: 'viatura' | 'material';
    target_module: 'B4';
    viatura_id?: string;
    description: string;
    status: 'pendente' | 'resolvido';
    created_at?: string;
}

export interface DocumentB1 {
    id?: string;
    file_name: string;
    document_type: string;
    file_url: string;
    size_kb?: number;
    uploaded_by?: string;
    upload_date?: string;
    notes?: string;
}

export interface Vacation {
    id?: string;
    personnel_id: number;
    full_name: string;
    start_date: string;
    end_date: string;
    day_count: number;
    status?: 'planejado' | 'aprovado' | 'em_andamento' | 'concluido';
    notes?: string;
}

export interface SSCIAnalysis {
    id?: string;
    request_type: 'requerimento' | 'recurso';
    protocol_number: string;
    request_description: string;
    ai_response: string;
    attached_documents?: string[];
    analysis_date?: string;
    responsible_user?: string;
    status?: string;
    web_source?: any;
    cbmsc_links?: string[];
    ai_model?: string;
    cited_normatives?: string[];
}

export interface DailyMission {
    id?: string;
    title: string;
    description?: string;
    mission_date: string;
    start_time?: string;
    end_time?: string;
    responsible_id?: string;
    responsible_name?: string;
    status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
    notes?: string;
    created_by?: string;
    registration_date?: string;
    updated_at?: string;
    created_at?: string;
}

export interface SSCIChatSession {
    id?: string;
    user?: string;
    session_title?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
}

export interface SSCIChatMessage {
    id?: string;
    session_id: string;
    user?: string;
    user_message: string;
    ai_response: string;
    referenced_normatives?: any;
    referenced_documents?: any;
    query_timestamp?: string;
    response_timestamp?: string;
}

export interface SSCINormativeDocument {
    id?: string;
    document_name: string;
    document_type: string;
    code_number?: string;
    issuing_body?: string;
    publication_date?: string;
    validity_date?: string;
    summary?: string;
    tags?: string[];
    category?: string;
    file_url: string;
    size_kb?: number;
    status?: string;
    times_referenced?: number;
    upload_date?: string;
}

export interface Escala {
    id?: string;
    data: string;
    equipe: string;
    militares: number[]; // IDs dos militares
    created_at?: string;
}
