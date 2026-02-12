import { supabase } from './supabase';
import { Personnel, DocumentB1, Vacation } from './types';
import { BaseService, ServiceError } from './baseService';
import { PAGINATION } from '../config/constants';

// Campos específicos para otimizar queries
const PERSONNEL_FIELDS = 'id, name, war_name, rank, role, status, type, address, email, birth_date, phone, blood_type, cnh, weapon_permit, image, created_at';
const DOCUMENT_FIELDS = 'id, file_name, document_type, file_url, size_kb, uploaded_by, upload_date, notes, personnel_id';
const VACATION_FIELDS = 'id, personnel_id, full_name, start_date, end_date, day_count, status, notes';

// Instâncias dos serviços base
const personnelBase = new BaseService<Personnel>('personnel', PERSONNEL_FIELDS);
const documentsBase = new BaseService<DocumentB1>('personnel_documents', DOCUMENT_FIELDS);
const vacationsBase = new BaseService<Vacation>('personnel_vacations', VACATION_FIELDS);

export const PersonnelService = {
    /**
     * Buscar todos os militares com paginação opcional
     */
    getPersonnel: async (page?: number): Promise<Personnel[]> => {
        try {
            const result = await personnelBase.getAll({
                orderBy: 'name',
                ascending: true,
                page,
                pageSize: page ? PAGINATION.PERSONNEL_PAGE_SIZE : undefined,
            });

            // Se não tem paginação, retorna array direto
            if (Array.isArray(result)) {
                return result;
            }

            // Se tem paginação, retorna apenas os dados
            return result.data;
        } catch (error) {
            console.error('Error fetching personnel:', error);
            throw error;
        }
    },

    /**
     * Adicionar novo militar
     */
    addPersonnel: async (person: Omit<Personnel, 'id'>): Promise<Personnel> => {
        try {
            return await personnelBase.create(person);
        } catch (error) {
            console.error('Error adding personnel:', error);
            throw error;
        }
    },

    /**
     * Atualizar militar existente
     */
    updatePersonnel: async (id: number, person: Partial<Personnel>): Promise<Personnel> => {
        try {
            return await personnelBase.update(id, person);
        } catch (error) {
            console.error('Error updating personnel:', error);
            throw error;
        }
    },

    /**
     * Deletar militar
     */
    deletePersonnel: async (id: number): Promise<void> => {
        try {
            await personnelBase.delete(id);
        } catch (error) {
            console.error('Error deleting personnel:', error);
            throw error;
        }
    },

    /**
     * Buscar militar por ID
     */
    getPersonnelById: async (id: number): Promise<Personnel | null> => {
        try {
            return await personnelBase.getById(id);
        } catch (error) {
            console.error('Error fetching personnel by ID:', error);
            throw error;
        }
    },

    /**
     * Buscar documentos de um militar
     */
    getDocumentsB1: async (personnelId?: number): Promise<DocumentB1[]> => {
        try {
            if (personnelId) {
                const result = await documentsBase.query(
                    { personnel_id: personnelId },
                    { orderBy: 'upload_date', ascending: false }
                );
                return Array.isArray(result) ? result : result.data;
            }

            const result = await documentsBase.getAll({
                orderBy: 'upload_date',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }
    },

    /**
     * Adicionar documento
     */
    addDocumentB1: async (doc: Omit<DocumentB1, 'id'>): Promise<DocumentB1> => {
        try {
            return await documentsBase.create(doc);
        } catch (error) {
            console.error('Error adding document:', error);
            throw error;
        }
    },

    /**
     * Deletar documento (remove do storage e do banco)
     */
    deleteDocumentB1: async (id: string, path: string): Promise<void> => {
        try {
            // Remove do storage
            const { error: storageError } = await supabase.storage
                .from('personnel-documents')
                .remove([path]);

            if (storageError) {
                throw new ServiceError('Erro ao remover arquivo do storage', storageError);
            }

            // Remove do banco
            await documentsBase.delete(id);
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    },

    /**
     * Buscar férias
     */
    getVacations: async (personnelId?: number): Promise<Vacation[]> => {
        try {
            if (personnelId) {
                const result = await vacationsBase.query(
                    { personnel_id: personnelId },
                    { orderBy: 'start_date', ascending: true }
                );
                return Array.isArray(result) ? result : result.data;
            }

            const result = await vacationsBase.getAll({
                orderBy: 'start_date',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching vacations:', error);
            throw error;
        }
    },

    /**
     * Adicionar férias
     */
    addVacation: async (vacation: Omit<Vacation, 'id'>): Promise<Vacation> => {
        try {
            return await vacationsBase.create(vacation);
        } catch (error) {
            console.error('Error adding vacation:', error);
            throw error;
        }
    },

    /**
     * Deletar férias
     */
    deleteVacation: async (id: string): Promise<void> => {
        try {
            await vacationsBase.delete(id);
        } catch (error) {
            console.error('Error deleting vacation:', error);
            throw error;
        }
    },

    /**
     * Buscar militares por status
     */
    getPersonnelByStatus: async (status: string): Promise<Personnel[]> => {
        try {
            const result = await personnelBase.query(
                { status },
                { orderBy: 'name', ascending: true }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching personnel by status:', error);
            throw error;
        }
    },

    /**
     * Contar militares por status
     */
    countByStatus: async (status: string): Promise<number> => {
        try {
            return await personnelBase.count({ status });
        } catch (error) {
            console.error('Error counting personnel by status:', error);
            throw error;
        }
    },

    /**
     * Buscar escala por data
     */
    getEscalaByDate: async (date: string): Promise<any> => {
        try {
            const { data, error } = await supabase
                .from('escalas')
                .select('*')
                .eq('data', date)
                .single();

            if (error && error.code !== 'PGRST116') { // Ignorar erro de não encontrado
                console.error('Error fetching escala:', error);
                throw error;
            }
            return data;
        } catch (error) {
            return null; // Retorna null se não encontrar
        }
    },

    /**
     * Salvar escala do dia
     */
    saveEscala: async (escala: { data: string, equipe: string, militares: number[] }): Promise<any> => {
        try {
            // Verificar se já existe
            const existing = await PersonnelService.getEscalaByDate(escala.data);

            if (existing) {
                const { data, error } = await supabase
                    .from('escalas')
                    .update({ equipe: escala.equipe, militares: escala.militares })
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
    }
};
