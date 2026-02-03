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

export interface VehicleChecklist {
    id?: string;
    vehicle_id: string;
    date: string;
    status: 'ok' | 'issue';
    notes: string;
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
    course_id?: string; // Mantido para compatibilidade inicial, mas será linkado via materia_id no futuro se necessário
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

// --- NEW INTERFACES ---

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
    viatura_id?: string; // Link to fleet.id
    descricao?: string;
    ativo?: boolean;
    ordem?: number;
}

export interface DailyChecklist {
    id?: string;
    item_id: string;
    viatura_id?: string; // ID of the vehicle being checked
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

export const SupabaseService = {
    // --- STORAGE ---
    uploadFile: async (bucket: string, path: string, file: File) => {
        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true
        });
        if (error) throw error;
        return data;
    },

    getPublicUrl: (bucket: string, path: string) => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },

    // --- MISSIONS ---
    getMissions: async (): Promise<Mission[]> => {
        const { data, error } = await supabase.from('missions').select('*').order('date', { ascending: true });
        if (error) console.error('Error fetching missions:', error);
        return (data as Mission[]) || [];
    },

    addMission: async (mission: Mission) => {
        const { data, error } = await supabase.from('missions').insert([mission]).select();
        if (error) console.error('Error adding mission:', error);
        return data;
    },

    toggleMission: async (id: number, currentStatus: boolean) => {
        const { error } = await supabase.from('missions').update({ completed: !currentStatus }).eq('id', id);
        if (error) console.error('Error toggling mission:', error);
    },

    deleteMission: async (id: number) => {
        const { error } = await supabase.from('missions').delete().eq('id', id);
        if (error) throw error;
    },

    // --- DAILY MISSIONS (B4/AVISOS) ---
    getDailyMissions: async (filters?: { data?: string, responsavel?: string, status?: string[] }): Promise<DailyMission[]> => {
        let query = supabase.from('missoes_diarias').select('*');

        if (filters?.data) query = query.eq('data_missao', filters.data);
        if (filters?.responsavel) query = query.eq('responsavel_id', filters.responsavel);
        if (filters?.status) query = query.in('status', filters.status);

        const { data, error } = await query.order('prioridade', { ascending: false }).order('hora_inicio', { ascending: true });
        if (error) console.error('Error fetching daily missions:', error);
        return (data as DailyMission[]) || [];
    },

    addDailyMission: async (mission: DailyMission) => {
        const { data, error } = await supabase.from('missoes_diarias').insert([mission]).select();
        if (error) throw error;
        return data[0];
    },

    updateDailyMission: async (id: string, updates: Partial<DailyMission>) => {
        const { data, error } = await supabase.from('missoes_diarias').update({ ...updates, ultima_atualizacao: new Date().toISOString() }).eq('id', id).select();
        if (error) throw error;
        return data[0];
    },

    deleteDailyMission: async (id: string) => {
        const { error } = await supabase.from('missoes_diarias').delete().eq('id', id);
        if (error) throw error;
    },

    getMissionsForToday: async (): Promise<DailyMission[]> => {
        const hoje = new Date().toISOString().split('T')[0];
        return SupabaseService.getDailyMissions({
            data: hoje,
            status: ['agendada', 'em_andamento']
        });
    },

    // --- FLEET ---
    getFleet: async (): Promise<Vehicle[]> => {
        const { data, error } = await supabase.from('fleet').select('*').order('id', { ascending: true });
        if (error) console.error('Error fetching fleet:', error);
        return (data as Vehicle[]) || [];
    },

    addVehicle: async (vehicle: Vehicle) => {
        const { error } = await supabase.from('fleet').insert([vehicle]);
        if (error) console.error('Error adding vehicle:', error);
    },

    updateVehicleStatus: async (id: string, status: Vehicle['status']) => {
        const { error } = await supabase.from('fleet').update({ status }).eq('id', id);
        if (error) console.error('Error updating vehicle:', error);
    },

    deleteVehicle: async (id: string) => {
        const { error } = await supabase.from('fleet').delete().eq('id', id);
        if (error) throw error;
    },

    // --- PERSONNEL ---
    getPersonnel: async (): Promise<Personnel[]> => {
        const { data, error } = await supabase.from('personnel').select('*').order('name', { ascending: true });
        if (error) console.error('Error fetching personnel:', error);
        return (data as Personnel[]) || [];
    },

    addPersonnel: async (person: Personnel) => {
        const { error } = await supabase.from('personnel').insert([person]);
        if (error) console.error('Error adding personnel:', error);
    },

    deletePersonnel: async (id: number) => {
        const { error } = await supabase.from('personnel').delete().eq('id', id);
        if (error) throw error;
    },

    // --- GU REPORTS ---
    getGuReports: async (): Promise<GuReport[]> => {
        const { data, error } = await supabase.from('gu_reports').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching reports:', error);
        return (data as GuReport[]) || [];
    },

    addGuReport: async (report: GuReport) => {
        const { error } = await supabase.from('gu_reports').insert([report]);
        if (error) console.error('Error adding report:', error);
    },

    deleteGuReport: async (id: string) => {
        const { error } = await supabase.from('gu_reports').delete().eq('id', id);
        if (error) throw error;
    },

    // --- INSTRUCTION (B3) ---
    getMateriasInstrucao: async (filtros?: { categoria?: string, nivel?: string, status?: string }): Promise<MateriaInstrucao[]> => {
        let query = supabase.from('materias_instrucao').select('*').order('nome_materia', { ascending: true });
        if (filtros?.categoria) query = query.eq('categoria', filtros.categoria);
        if (filtros?.nivel) query = query.eq('nivel', filtros.nivel);
        if (filtros?.status) query = query.eq('status', filtros.status);

        const { data, error } = await query;
        if (error) console.error('Error fetching materias:', error);
        return (data as MateriaInstrucao[]) || [];
    },

    addMateriaInstrucao: async (materia: MateriaInstrucao) => {
        const { data, error } = await supabase.from('materias_instrucao').insert([materia]).select();
        if (error) throw error;
        return data[0];
    },

    updateMateriaInstrucao: async (id: string, updates: Partial<MateriaInstrucao>) => {
        const { data, error } = await supabase.from('materias_instrucao').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select();
        if (error) throw error;
        return data[0];
    },

    // Materials - Presentations
    getMateriaApresentacoes: async (materiaId: string): Promise<MateriaApresentacao[]> => {
        const { data, error } = await supabase.from('materia_apresentacoes').select('*').eq('materia_id', materiaId).order('ordem', { ascending: true });
        if (error) console.error('Error fetching presentations:', error);
        return (data as MateriaApresentacao[]) || [];
    },

    addMateriaApresentacao: async (apresentacao: MateriaApresentacao) => {
        const { error } = await supabase.from('materia_apresentacoes').insert([apresentacao]);
        if (error) throw error;
        await SupabaseService.atualizarContadoresMateriais(apresentacao.materia_id);
    },

    deleteMateriaApresentacao: async (id: string, materiaId: string) => {
        const { error } = await supabase.from('materia_apresentacoes').delete().eq('id', id);
        if (error) throw error;
        await SupabaseService.atualizarContadoresMateriais(materiaId);
    },

    // Materials - Videos
    getMateriaVideos: async (materiaId: string): Promise<MateriaVideo[]> => {
        const { data, error } = await supabase.from('materia_videos').select('*').eq('materia_id', materiaId).order('ordem', { ascending: true });
        if (error) console.error('Error fetching videos:', error);
        return (data as MateriaVideo[]) || [];
    },

    addMateriaVideo: async (video: MateriaVideo) => {
        const { error } = await supabase.from('materia_videos').insert([video]);
        if (error) throw error;
        await SupabaseService.atualizarContadoresMateriais(video.materia_id);
    },

    deleteMateriaVideo: async (id: string, materiaId: string) => {
        const { error } = await supabase.from('materia_videos').delete().eq('id', id);
        if (error) throw error;
        await SupabaseService.atualizarContadoresMateriais(materiaId);
    },

    atualizarContadoresMateriais: async (materiaId: string) => {
        const [presCount, vidCount] = await Promise.all([
            supabase.from('materia_apresentacoes').select('*', { count: 'exact', head: true }).eq('materia_id', materiaId),
            supabase.from('materia_videos').select('*', { count: 'exact', head: true }).eq('materia_id', materiaId)
        ]);

        await supabase.from('materias_instrucao').update({
            total_apresentacoes: presCount.count || 0,
            total_videos: vidCount.count || 0,
            updated_at: new Date().toISOString()
        }).eq('id', materiaId);
    },

    // trainings
    getTrainings: async (): Promise<Training[]> => {
        const { data, error } = await supabase.from('trainings').select('*, materia:materias_instrucao(*)').order('date', { ascending: true });
        if (error) console.error('Error fetching trainings:', error);
        return (data as any[]) || [];
    },

    addTraining: async (training: Training) => {
        const { error } = await supabase.from('trainings').insert([training]);
        if (error) console.error('Error adding training:', error);
    },

    deleteTraining: async (id: string) => {
        const { error } = await supabase.from('trainings').delete().eq('id', id);
        if (error) throw error;
    },

    deleteMateriaInstrucao: async (id: string) => {
        // Cascade delete should handle presentations and videos if configured in DB, 
        // otherwise we might need to delete from storage too.
        // For now, focusing on DB.
        const { error } = await supabase.from('materias_instrucao').delete().eq('id', id);
        if (error) throw error;
    },

    // --- OLD COMPATIBILITY (REMOVED OR REDIRECTED) ---
    // Removendo Course legados para usar MateriaInstrucao
    getCourses: async () => SupabaseService.getMateriasInstrucao(),
    addCourse: async (materia: any) => SupabaseService.addMateriaInstrucao({
        nome_materia: materia.name,
        carga_horaria: materia.hours,
        categoria: materia.category
    }),

    // --- PURCHASES (B4) ---
    getPurchases: async (): Promise<Purchase[]> => {
        const { data, error } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching purchases:', error);
        return (data as Purchase[]) || [];
    },

    addPurchase: async (purchase: Purchase) => {
        const { error } = await supabase.from('purchases').insert([purchase]);
        if (error) console.error('Error adding purchase:', error);
    },

    deletePurchase: async (id: number) => {
        const { error } = await supabase.from('purchases').delete().eq('id', id);
        if (error) throw error;
    },

    // --- SOCIAL (B5) ---
    getSocialPosts: async (): Promise<SocialPost[]> => {
        const { data, error } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching social posts:', error);
        return (data as SocialPost[]) || [];
    },

    addSocialPost: async (post: SocialPost) => {
        const { error } = await supabase.from('social_posts').insert([post]);
        if (error) console.error('Error adding post:', error);
    },

    deleteSocialPost: async (id: string) => {
        const { error } = await supabase.from('social_posts').delete().eq('id', id);
        if (error) throw error;
    },

    // --- NEW FEATURES METHODS ---

    // Recebimento de Produtos
    getProductsReceipts: async (): Promise<ProductReceipt[]> => {
        const { data, error } = await supabase.from('produtos_recebidos').select('*').order('created_at', { ascending: false }).limit(10);
        if (error) console.error('Error fetching receipts:', error);
        return (data as ProductReceipt[]) || [];
    },

    addProductReceipt: async (receipt: ProductReceipt) => {
        const { data, error } = await supabase.from('produtos_recebidos').insert([receipt]).select();
        if (error) throw error;
        return data;
    },

    deleteProductReceipt: async (id: string) => {
        const { error } = await supabase.from('produtos_recebidos').delete().eq('id', id);
        if (error) throw error;
    },

    // Conferência
    getChecklistItems: async (categoria?: string, viaturaId?: string): Promise<ChecklistItem[]> => {
        let query = supabase.from('itens_conferencia').select('*').eq('ativo', true).order('ordem', { ascending: true });

        if (categoria) query = query.eq('categoria', categoria);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching items:', error);
            return [];
        }

        let items = (data as ChecklistItem[]) || [];

        // Apply filtering logic: 
        // 1. Items with no viatura_id (general items)
        // 2. Items specifically linked to the selected viaturaId
        if (viaturaId) {
            items = items.filter(it => !it.viatura_id || it.viatura_id === viaturaId);
        }

        return items;
    },

    saveDailyChecklist: async (entry: DailyChecklist) => {
        const { data, error } = await supabase.from('conferencias_diarias').insert([entry]).select();
        if (error) throw error;

        // Automatic notification logic
        if (entry.status === 'faltante') {
            const { data: itemData } = await supabase.from('itens_conferencia').select('*').eq('id', entry.item_id).single();
            if (itemData) {
                const notice: Partial<PendingNotice> = {
                    conferencia_id: data[0].id,
                    tipo: itemData.categoria === 'viaturas' ? 'viatura' : 'material',
                    destino_modulo: 'B4',
                    viatura_id: entry.viatura_id || itemData.viatura_id,
                    descricao: `Faltante: ${itemData.nome_item} reportado na conferência diária.`,
                    status: 'pendente'
                };

                await supabase.from('avisos_pendencias').insert([notice]);
            }
        }
        return data;
    },

    // New method to add conference item directly (used in B4)
    addChecklistItem: async (item: Partial<ChecklistItem>) => {
        const { data, error } = await supabase.from('itens_conferencia').insert([item]).select();
        if (error) throw error;
        return data[0];
    },

    // Avisos/Pendências
    getPendingNotices: async (filters?: { tipo?: string, status?: string, viatura_id?: string }): Promise<PendingNotice[]> => {
        let query = supabase.from('avisos_pendencias').select('*').order('created_at', { ascending: false });
        if (filters?.tipo) query = query.eq('tipo', filters.tipo);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.viatura_id) query = query.eq('viatura_id', filters.viatura_id);
        const { data, error } = await query;
        if (error) console.error('Error fetching notices:', error);
        return (data as PendingNotice[]) || [];
    },

    resolveNotice: async (id: string) => {
        const { error } = await supabase.from('avisos_pendencias').update({ status: 'resolvido' }).eq('id', id);
        if (error) throw error;
    },

    // Documentos B1
    getDocumentsB1: async (): Promise<DocumentB1[]> => {
        const { data, error } = await supabase.from('documentos').select('*').order('data_upload', { ascending: false });
        if (error) console.error('Error fetching documents:', error);
        return (data as DocumentB1[]) || [];
    },

    addDocumentB1: async (doc: DocumentB1) => {
        const { error } = await supabase.from('documentos').insert([doc]);
        if (error) throw error;
    },

    deleteDocumentB1: async (id: string, path: string) => {
        await supabase.storage.from('documentos-b1').remove([path]);
        const { error } = await supabase.from('documentos').delete().eq('id', id);
        if (error) throw error;
    },

    // Férias B1
    getVacations: async (): Promise<Vacation[]> => {
        const { data, error } = await supabase.from('ferias').select('*').order('data_inicio', { ascending: true });
        if (error) console.error('Error fetching vacations:', error);
        return (data as Vacation[]) || [];
    },

    addVacation: async (vacation: Vacation) => {
        const { error } = await supabase.from('ferias').insert([vacation]);
        if (error) throw error;
    },

    deleteVacation: async (id: string) => {
        const { error } = await supabase.from('ferias').delete().eq('id', id);
        if (error) throw error;
    },

    // --- SSCI MODULE ---

    // Análises
    getSSCIAnalyses: async (): Promise<SSCIAnalysis[]> => {
        const { data, error } = await supabase.from('ssci_analises').select('*').order('data_analise', { ascending: false });
        if (error) console.error('Error fetching SSCI analyses:', error);
        return (data as SSCIAnalysis[]) || [];
    },

    addSSCIAnalysis: async (analysis: SSCIAnalysis) => {
        const { data, error } = await supabase.from('ssci_analises').insert([analysis]).select();
        if (error) throw error;
        return data;
    },

    deleteSSCIAnalysis: async (id: string) => {
        const { error } = await supabase.from('ssci_analises').delete().eq('id', id);
        if (error) throw error;
    },

    // Chat
    getSSCIChatSessions: async (): Promise<SSCIChatSession[]> => {
        const { data, error } = await supabase.from('ssci_sessoes_chat').select('*').order('data_inicio', { ascending: false });
        if (error) console.error('Error fetching chat sessions:', error);
        return (data as SSCIChatSession[]) || [];
    },

    createSSCIChatSession: async (session: SSCIChatSession) => {
        const { data, error } = await supabase.from('ssci_sessoes_chat').insert([session]).select();
        if (error) throw error;
        return data[0];
    },

    deleteSSCIChatSession: async (id: string) => {
        const { error } = await supabase.from('ssci_sessoes_chat').delete().eq('id', id);
        if (error) throw error;
    },

    getSSCIChatMessages: async (sessionId: string): Promise<SSCIChatMessage[]> => {
        const { data, error } = await supabase.from('ssci_consultas_chat').select('*').eq('sessao_id', sessionId).order('timestamp_pergunta', { ascending: true });
        if (error) console.error('Error fetching chat messages:', error);
        return (data as SSCIChatMessage[]) || [];
    },

    addSSCIChatMessage: async (message: SSCIChatMessage) => {
        const { data, error } = await supabase.from('ssci_consultas_chat').insert([message]).select();
        if (error) throw error;
        return data[0];
    },

    // Banco de Conhecimento
    getSSCINormativeDocuments: async (): Promise<SSCINormativeDocument[]> => {
        const { data, error } = await supabase.from('ssci_documentos_normativos').select('*').order('data_upload', { ascending: false });
        if (error) console.error('Error fetching normative docs:', error);
        return (data as SSCINormativeDocument[]) || [];
    },

    addSSCINormativeDocument: async (doc: SSCINormativeDocument) => {
        const { data, error } = await supabase.from('ssci_documentos_normativos').insert([doc]).select();
        if (error) throw error;
        return data[0];
    },

    deleteSSCINormativeDocument: async (id: string, fileName: string) => {
        await supabase.storage.from('ssci-documentos-normativos').remove([fileName]);
        const { error } = await supabase.from('ssci_documentos_normativos').delete().eq('id', id);
        if (error) throw error;
    },

    trackDocumentUsage: async (usage: { documento_id: string, tipo_uso: string, referencia_id: string }) => {
        await supabase.from('ssci_uso_documentos').insert([usage]);
        // Increment usage count
        const { data: doc } = await supabase.from('ssci_documentos_normativos').select('vezes_referenciado').eq('id', usage.documento_id).single();
        if (doc) {
            await supabase.from('ssci_documentos_normativos').update({ vezes_referenciado: (doc.vezes_referenciado || 0) + 1 }).eq('id', usage.documento_id);
        }
    },

    // Helpers
    getTodayDate: () => new Date().toISOString().split('T')[0],
};
