import { supabase } from './supabase';
import { Personnel, DocumentB1, Vacation, RankHistory, ServiceSwap, DisciplinaryRecord, Bulletin, BulletinNote, BulletinVersion, SigrhExport, AlertItem, B1Course, EpiDelivery, InternalNotification } from './types';
import { BaseService, ServiceError } from './baseService';
import { PAGINATION } from '../config/constants';

// Field selectors for optimized queries
const PERSONNEL_FIELDS = 'id, name, war_name, rank, role, status, type, address, email, birth_date, phone, blood_type, cnh, weapon_permit, image, created_at, education_level, cnh_category, cnh_number, cnh_expiry_date, cpf, emergency_phone, emergency_contact_name, cve_active, cve_issue_date, cve_expiry_date, toxicological_date, toxicological_expiry_date, graduation, last_cadastro_review';
const DOCUMENT_FIELDS = 'id, file_name, document_type, file_url, size_kb, uploaded_by, upload_date, notes, personnel_id';
const VACATION_FIELDS = 'id, personnel_id, full_name, start_date, end_date, day_count, leave_type, status, notes';

const personnelBase = new BaseService<Personnel>('personnel', PERSONNEL_FIELDS);
const documentsBase = new BaseService<DocumentB1>('personnel_documents', DOCUMENT_FIELDS);
const vacationsBase = new BaseService<Vacation>('personnel_vacations', VACATION_FIELDS);

export const PersonnelService = {
    // ===== PERSONNEL CRUD =====
    getPersonnel: async (page?: number): Promise<Personnel[]> => {
        try {
            const result = await personnelBase.getAll({
                orderBy: 'name',
                ascending: true,
                page,
                pageSize: page ? PAGINATION.PERSONNEL_PAGE_SIZE : undefined,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching personnel:', error);
            throw error;
        }
    },

    addPersonnel: async (person: Omit<Personnel, 'id'>): Promise<Personnel> => {
        try {
            return await personnelBase.create(person);
        } catch (error) {
            console.error('Error adding personnel:', error);
            throw error;
        }
    },

    updatePersonnel: async (id: number, person: Partial<Personnel>): Promise<Personnel> => {
        try {
            return await personnelBase.update(id, person);
        } catch (error) {
            console.error('Error updating personnel:', error);
            throw error;
        }
    },

    deletePersonnel: async (id: number): Promise<void> => {
        try {
            await personnelBase.delete(id);
        } catch (error) {
            console.error('Error deleting personnel:', error);
            throw error;
        }
    },

    getPersonnelById: async (id: number): Promise<Personnel | null> => {
        try {
            return await personnelBase.getById(id);
        } catch (error) {
            console.error('Error fetching personnel by ID:', error);
            throw error;
        }
    },

    // ===== DOCUMENTS CRUD =====
    getDocumentsB1: async (personnelId?: number): Promise<DocumentB1[]> => {
        try {
            if (personnelId) {
                const result = await documentsBase.query(
                    { personnel_id: personnelId },
                    { orderBy: 'upload_date', ascending: false }
                );
                return Array.isArray(result) ? result : result.data;
            }
            const result = await documentsBase.getAll({ orderBy: 'upload_date', ascending: false });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }
    },

    addDocumentB1: async (doc: Omit<DocumentB1, 'id'>): Promise<DocumentB1> => {
        try {
            return await documentsBase.create(doc);
        } catch (error) {
            console.error('Error adding document:', error);
            throw error;
        }
    },

    deleteDocumentB1: async (id: string, path: string): Promise<void> => {
        try {
            const { error: storageError } = await supabase.storage
                .from('personnel-documents')
                .remove([path]);
            if (storageError) throw new ServiceError('Erro ao remover arquivo do storage', storageError);
            await documentsBase.delete(id);
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    },

    // ===== VACATIONS / LEAVES =====
    getVacations: async (personnelId?: number): Promise<Vacation[]> => {
        try {
            if (personnelId) {
                const result = await vacationsBase.query(
                    { personnel_id: personnelId },
                    { orderBy: 'start_date', ascending: true }
                );
                return Array.isArray(result) ? result : result.data;
            }
            const result = await vacationsBase.getAll({ orderBy: 'start_date', ascending: true });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching vacations:', error);
            throw error;
        }
    },

    addVacation: async (vacation: Omit<Vacation, 'id'>): Promise<Vacation> => {
        try {
            return await vacationsBase.create(vacation);
        } catch (error) {
            console.error('Error adding vacation:', error);
            throw error;
        }
    },

    updateVacation: async (id: string, data: Partial<Vacation>): Promise<Vacation> => {
        try {
            return await vacationsBase.update(id, data);
        } catch (error) {
            console.error('Error updating vacation:', error);
            throw error;
        }
    },

    deleteVacation: async (id: string): Promise<void> => {
        try {
            await vacationsBase.delete(id);
        } catch (error) {
            console.error('Error deleting vacation:', error);
            throw error;
        }
    },

    // ===== PERSONNEL STATUS QUERIES =====
    getPersonnelByStatus: async (status: string): Promise<Personnel[]> => {
        try {
            const result = await personnelBase.query({ status }, { orderBy: 'name', ascending: true });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching personnel by status:', error);
            throw error;
        }
    },

    countByStatus: async (status: string): Promise<number> => {
        try {
            return await personnelBase.count({ status });
        } catch (error) {
            console.error('Error counting personnel by status:', error);
            throw error;
        }
    },

    // ===== ESCALA =====
    getEscalaByDate: async (date: string): Promise<any> => {
        try {
            const { data, error } = await supabase
                .from('escalas')
                .select('*')
                .eq('data', date)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            return null;
        }
    },

    saveEscala: async (escala: { data: string, equipe: string, militares: number[], shift_type?: string }): Promise<any> => {
        try {
            const existing = await PersonnelService.getEscalaByDate(escala.data);
            if (existing) {
                const { data, error } = await supabase
                    .from('escalas')
                    .update({ equipe: escala.equipe, militares: escala.militares, shift_type: escala.shift_type })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from('escalas')
                    .insert(escala)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        } catch (error) {
            console.error('Error saving escala:', error);
            throw error;
        }
    },

    // ===== RANK HISTORY =====
    getRankHistory: async (personnelId: number): Promise<RankHistory[]> => {
        try {
            const { data, error } = await supabase
                .from('rank_history')
                .select('*')
                .eq('personnel_id', personnelId)
                .order('change_date', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching rank history:', error);
            return [];
        }
    },

    addRankHistory: async (entry: Omit<RankHistory, 'id'>): Promise<RankHistory> => {
        const { data, error } = await supabase
            .from('rank_history')
            .insert(entry)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== SERVICE SWAPS =====
    getServiceSwaps: async (personnelId?: number, monthRef?: string): Promise<ServiceSwap[]> => {
        try {
            let query = supabase.from('service_swaps').select('*').order('swap_date', { ascending: false });
            if (personnelId) query = query.eq('personnel_id', personnelId);
            if (monthRef) query = query.eq('month_ref', monthRef);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching service swaps:', error);
            return [];
        }
    },

    getSwapCountThisMonth: async (personnelId: number, monthRef: string): Promise<number> => {
        try {
            const { count, error } = await supabase
                .from('service_swaps')
                .select('*', { count: 'exact', head: true })
                .eq('personnel_id', personnelId)
                .eq('month_ref', monthRef);
            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error counting swaps:', error);
            return 0;
        }
    },

    addServiceSwap: async (swap: Omit<ServiceSwap, 'id'>): Promise<ServiceSwap> => {
        const { data, error } = await supabase
            .from('service_swaps')
            .insert(swap)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== DISCIPLINARY RECORDS =====
    getDisciplinaryRecords: async (personnelId?: number): Promise<DisciplinaryRecord[]> => {
        try {
            let query = supabase.from('disciplinary_records').select('*').order('date', { ascending: false });
            if (personnelId) query = query.eq('personnel_id', personnelId);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching disciplinary records:', error);
            return [];
        }
    },

    addDisciplinaryRecord: async (record: Omit<DisciplinaryRecord, 'id'>): Promise<DisciplinaryRecord> => {
        const { data, error } = await supabase
            .from('disciplinary_records')
            .insert(record)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    deleteDisciplinaryRecord: async (id: string): Promise<void> => {
        const { error } = await supabase.from('disciplinary_records').delete().eq('id', id);
        if (error) throw error;
    },

    // ===== BULLETINS =====
    getBulletins: async (): Promise<Bulletin[]> => {
        try {
            const { data, error } = await supabase
                .from('bulletins')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching bulletins:', error);
            return [];
        }
    },

    addBulletin: async (bulletin: Omit<Bulletin, 'id'>): Promise<Bulletin> => {
        const { data, error } = await supabase
            .from('bulletins')
            .insert(bulletin)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateBulletin: async (id: string, updates: Partial<Bulletin>): Promise<Bulletin> => {
        const { data, error } = await supabase
            .from('bulletins')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== BULLETIN NOTES =====
    getBulletinNotes: async (bulletinId: string): Promise<BulletinNote[]> => {
        const { data, error } = await supabase
            .from('bulletin_notes')
            .select('*')
            .eq('bulletin_id', bulletinId)
            .order('submitted_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    addBulletinNote: async (note: Omit<BulletinNote, 'id'>): Promise<BulletinNote> => {
        const { data, error } = await supabase
            .from('bulletin_notes')
            .insert(note)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== BULLETIN VERSIONS =====
    getBulletinVersions: async (bulletinId: string): Promise<BulletinVersion[]> => {
        const { data, error } = await supabase
            .from('bulletin_versions')
            .select('*')
            .eq('bulletin_id', bulletinId)
            .order('edited_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    addBulletinVersion: async (version: Omit<BulletinVersion, 'id'>): Promise<BulletinVersion> => {
        const { data, error } = await supabase
            .from('bulletin_versions')
            .insert(version)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== SIGRH EXPORTS =====
    getSigrhExports: async (): Promise<SigrhExport[]> => {
        const { data, error } = await supabase
            .from('sigrh_exports')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    addSigrhExport: async (exp: Omit<SigrhExport, 'id'>): Promise<SigrhExport> => {
        const { data, error } = await supabase
            .from('sigrh_exports')
            .insert(exp)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ===== B1 COURSES CRUD =====
    getCourses: async (personnelId?: number): Promise<B1Course[]> => {
        try {
            let query = supabase.from('b1_courses').select('*').order('completion_date', { ascending: false });
            if (personnelId) query = query.eq('personnel_id', personnelId);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching courses:', error);
            return [];
        }
    },

    addCourse: async (course: Omit<B1Course, 'id'>): Promise<B1Course> => {
        const { data, error } = await supabase.from('b1_courses').insert(course).select().single();
        if (error) throw error;
        return data;
    },

    updateCourse: async (id: string, updates: Partial<B1Course>): Promise<B1Course> => {
        const { data, error } = await supabase.from('b1_courses').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    deleteCourse: async (id: string): Promise<void> => {
        const { error } = await supabase.from('b1_courses').delete().eq('id', id);
        if (error) throw error;
    },

    // ===== EPI DELIVERIES CRUD =====
    getEpiDeliveries: async (personnelId?: number): Promise<EpiDelivery[]> => {
        try {
            let query = supabase.from('epi_deliveries').select('*').order('delivery_date', { ascending: false });
            if (personnelId) query = query.eq('personnel_id', personnelId);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching EPI deliveries:', error);
            return [];
        }
    },

    addEpiDelivery: async (delivery: Omit<EpiDelivery, 'id'>): Promise<EpiDelivery> => {
        const { data, error } = await supabase.from('epi_deliveries').insert(delivery).select().single();
        if (error) throw error;
        return data;
    },

    deleteEpiDelivery: async (id: string): Promise<void> => {
        const { error } = await supabase.from('epi_deliveries').delete().eq('id', id);
        if (error) throw error;
    },

    getFleetByPatrimonio: async (patrimonioNumber: string): Promise<{ name: string; details: string } | null> => {
        try {
            const { data, error } = await supabase
                .from('fleet')
                .select('name, details')
                .eq('patrimonio_number', patrimonioNumber)
                .single();
            if (error) return null;
            return data;
        } catch {
            return null;
        }
    },

    // ===== INTERNAL NOTIFICATIONS CRUD =====
    getNotifications: async (limit = 50): Promise<InternalNotification[]> => {
        try {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const { data, error } = await supabase
                .from('internal_notifications')
                .select('*')
                .is('archived_at', null)
                .gte('created_at', ninetyDaysAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            const now = new Date();
            return (data || []).map(n => ({
                ...n,
                time_ago: (() => {
                    const diff = Math.floor((now.getTime() - new Date(n.created_at).getTime()) / 60000);
                    if (diff < 60) return `${diff}min atrás`;
                    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
                    return `${Math.floor(diff / 1440)}d atrás`;
                })(),
            }));
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },

    getUnreadCount: async (): Promise<number> => {
        try {
            const { count, error } = await supabase
                .from('internal_notifications')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .is('archived_at', null);
            if (error) throw error;
            return count || 0;
        } catch {
            return 0;
        }
    },

    addNotification: async (notif: Omit<InternalNotification, 'id'>): Promise<InternalNotification> => {
        const { data, error } = await supabase.from('internal_notifications').insert(notif).select().single();
        if (error) throw error;
        return data;
    },

    markAsRead: async (id: string): Promise<void> => {
        const { error } = await supabase.from('internal_notifications').update({ is_read: true }).eq('id', id);
        if (error) throw error;
    },

    markAllAsRead: async (): Promise<void> => {
        const { error } = await supabase.from('internal_notifications').update({ is_read: true }).eq('is_read', false);
        if (error) throw error;
    },

    sendBulkNotification: async (title: string, message: string, sourceEvent: string): Promise<void> => {
        const notif = { title, message, source_event: sourceEvent, is_read: false };
        await supabase.from('internal_notifications').insert(notif);
    },

    // ===== ALERTS ENGINE =====
    generateAlerts: (personnelList: Personnel[], vacations: Vacation[], swapCounts: Map<number, number>, courses?: B1Course[], epiDeliveries?: EpiDelivery[]): AlertItem[] => {
        const alerts: AlertItem[] = [];
        const today = new Date();
        const in60Days = new Date(today);
        in60Days.setDate(in60Days.getDate() + 60);
        const in90Days = new Date(today);
        in90Days.setDate(in90Days.getDate() + 90);
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);
        const monthsAgo12 = new Date(today);
        monthsAgo12.setMonth(monthsAgo12.getMonth() - 12);

        for (const p of personnelList) {
            if (p.cve_expiry_date) {
                const expiry = new Date(p.cve_expiry_date);
                if (expiry <= today) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'CVE Expirado', referenceDate: p.cve_expiry_date, severity: 'critical', message: `CVE expirado em ${new Date(p.cve_expiry_date).toLocaleDateString('pt-BR')}` });
                } else if (expiry <= in60Days) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'CVE Expirando', referenceDate: p.cve_expiry_date, severity: 'warning', message: `CVE expira em ${new Date(p.cve_expiry_date).toLocaleDateString('pt-BR')}` });
                }
            }
            if (p.cnh_category && p.cnh_category.includes('D') && p.toxicological_expiry_date) {
                const expiry = new Date(p.toxicological_expiry_date);
                if (expiry <= today) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'Toxicológico Expirado', referenceDate: p.toxicological_expiry_date, severity: 'critical', message: `Exame toxicológico expirado em ${new Date(p.toxicological_expiry_date).toLocaleDateString('pt-BR')}` });
                } else if (expiry <= in60Days) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'Toxicológico Expirando', referenceDate: p.toxicological_expiry_date, severity: 'warning', message: `Exame toxicológico expira em ${new Date(p.toxicological_expiry_date).toLocaleDateString('pt-BR')}` });
                }
            }
            if (p.cnh_expiry_date) {
                const expiry = new Date(p.cnh_expiry_date);
                if (expiry <= today) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'CNH Expirada', referenceDate: p.cnh_expiry_date, severity: 'critical', message: `CNH expirada em ${new Date(p.cnh_expiry_date).toLocaleDateString('pt-BR')}` });
                } else if (expiry <= in90Days) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'CNH Expirando', referenceDate: p.cnh_expiry_date, severity: 'warning', message: `CNH expira em ${new Date(p.cnh_expiry_date).toLocaleDateString('pt-BR')}` });
                }
            }
            const swaps = swapCounts.get(p.id!) || 0;
            if (swaps >= 2) {
                alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'Limite de Trocas', referenceDate: today.toISOString().split('T')[0], severity: 'warning', message: `Atingiu o limite de ${swaps} trocas de serviço neste mês` });
            }
            if (p.last_cadastro_review) {
                const lastReview = new Date(p.last_cadastro_review);
                if (lastReview <= monthsAgo12) {
                    alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'Cadastro Desatualizado', referenceDate: p.last_cadastro_review, severity: 'info', message: `Cadastro não revisado desde ${new Date(p.last_cadastro_review).toLocaleDateString('pt-BR')}` });
                }
            } else {
                alerts.push({ personnelId: p.id!, personnelName: p.name, alertType: 'Cadastro Sem Revisão', referenceDate: '', severity: 'info', message: 'Cadastro nunca foi revisado' });
            }
        }

        for (const v of vacations) {
            const start = new Date(v.start_date);
            if (start >= today && start <= in30Days) {
                alerts.push({ personnelId: v.personnel_id, personnelName: v.full_name, alertType: 'Férias Próximas', referenceDate: v.start_date, severity: 'info', message: `Férias iniciam em ${new Date(v.start_date).toLocaleDateString('pt-BR')} (${v.day_count} dias)` });
            }
        }

        // Course qualification expiry alerts
        if (courses) {
            const personnelMap = new Map(personnelList.map(p => [p.id!, p]));
            for (const c of courses) {
                if (!c.expiry_date) continue;
                const expiry = new Date(c.expiry_date);
                const person = personnelMap.get(c.personnel_id);
                const personName = person?.name || c.personnel_name || 'Desconhecido';
                if (expiry <= today) {
                    alerts.push({ personnelId: c.personnel_id, personnelName: personName, alertType: 'Qualificação Expirada', referenceDate: c.expiry_date, severity: 'critical', message: `Qualificação "${c.course_name}" expirou em ${new Date(c.expiry_date).toLocaleDateString('pt-BR')}` });
                } else if (expiry <= in60Days) {
                    alerts.push({ personnelId: c.personnel_id, personnelName: personName, alertType: 'Qualificação Expirando', referenceDate: c.expiry_date, severity: 'warning', message: `Qualificação "${c.course_name}" expira em ${new Date(c.expiry_date).toLocaleDateString('pt-BR')}` });
                }
            }
        }

        // EPI replacement date alerts
        if (epiDeliveries) {
            const personnelMap = new Map(personnelList.map(p => [p.id!, p]));
            for (const e of epiDeliveries) {
                if (!e.replacement_date) continue;
                const replDate = new Date(e.replacement_date);
                const person = personnelMap.get(e.personnel_id);
                const personName = person?.name || e.personnel_name || 'Desconhecido';
                if (replDate <= today) {
                    alerts.push({ personnelId: e.personnel_id, personnelName: personName, alertType: 'EPI/Uniforme Vencido', referenceDate: e.replacement_date, severity: 'warning', message: `Item "${e.item_name}" passou da data de reposição prevista (${new Date(e.replacement_date).toLocaleDateString('pt-BR')})` });
                }
            }
        }

        const severityOrder = { critical: 0, warning: 1, info: 2 };
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        return alerts;
    },
};
