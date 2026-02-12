import { supabase } from './supabase';
import { DailyMission, Mission, GuReport, Training } from './types';
import { BaseService } from './baseService';

// Campos específicos para otimizar queries
const DAILY_MISSION_FIELDS = 'id, title, description, mission_date, start_time, end_time, responsible_id, status, priority, created_at, updated_at, responsible:personnel(name, rank)';
const GU_REPORT_FIELDS = 'id, title, description, type, report_date, responsible_id, created_at';
const TRAINING_FIELDS = 'id, materia_id, date, instructor, location, status';
const MISSION_FIELDS = 'id, title, description, date, completed';

// Instâncias dos serviços base
const dailyMissionsBase = new BaseService<DailyMission>('missoes_diarias', DAILY_MISSION_FIELDS);
const guReportsBase = new BaseService<GuReport>('gu_reports', GU_REPORT_FIELDS);
const trainingsBase = new BaseService<Training>('training_schedule', TRAINING_FIELDS);
const missionsBase = new BaseService<Mission>('missions', MISSION_FIELDS);

export const OperationalService = {
    // ==================== DAILY MISSIONS ====================

    /**
     * Buscar missões diárias com filtros opcionais
     */
    getDailyMissions: async (filters?: {
        data?: string;
        responsavel?: string;
        status?: string[];
    }): Promise<DailyMission[]> => {
        try {
            // Se tem filtro de status (array), precisa usar query customizada
            if (filters?.status && filters.status.length > 0) {
                let query = supabase
                    .from('missoes_diarias')
                    .select(DAILY_MISSION_FIELDS)
                    .in('status', filters.status);

                if (filters.data) {
                    query = query.eq('mission_date', filters.data);
                }
                if (filters.responsavel) {
                    query = query.eq('responsible_id', filters.responsavel);
                }

                const { data, error } = await query
                    .order('priority', { ascending: false })
                    .order('start_time', { ascending: true });

                if (error) {
                    console.error('Error fetching daily missions:', error);
                    throw error;
                }

                return (data || []).map((m: any) => ({
                    ...m,
                    responsible_name: m.responsible // Already exists or mapped
                        ? `${m.responsible.rank ? m.responsible.rank + ' ' : ''}${m.responsible.name}`
                        : m.responsible_name
                }));
            }

            // Filtros simples podem usar o BaseService
            const simpleFilters: Record<string, unknown> = {};
            if (filters?.data) simpleFilters.mission_date = filters.data;
            if (filters?.responsavel) simpleFilters.responsible_id = filters.responsavel;

            const result = Object.keys(simpleFilters).length > 0
                ? await dailyMissionsBase.query(simpleFilters, {
                    orderBy: 'priority',
                    ascending: false,
                })
                : await dailyMissionsBase.getAll({
                    orderBy: 'priority',
                    ascending: false,
                });

            const flatData = Array.isArray(result) ? result : result.data;

            return flatData.map((m: any) => ({
                ...m,
                responsible_name: m.responsible
                    ? `${m.responsible.rank ? m.responsible.rank + ' ' : ''}${m.responsible.name}`
                    : m.responsible_name
            }));
        } catch (error) {
            console.error('Error fetching daily missions:', error);
            throw error;
        }
    },

    /**
     * Adicionar missão diária
     */
    addDailyMission: async (mission: Omit<DailyMission, 'id'>): Promise<DailyMission> => {
        try {
            return await dailyMissionsBase.create(mission);
        } catch (error) {
            console.error('Error adding daily mission:', error);
            throw error;
        }
    },

    /**
     * Atualizar missão diária
     */
    updateDailyMission: async (id: string, updates: Partial<DailyMission>): Promise<DailyMission> => {
        try {
            const updatesWithTimestamp = {
                ...updates,
                updated_at: new Date().toISOString(),
            };
            return await dailyMissionsBase.update(id, updatesWithTimestamp);
        } catch (error) {
            console.error('Error updating daily mission:', error);
            throw error;
        }
    },

    /**
     * Deletar missão diária
     */
    deleteDailyMission: async (id: string): Promise<void> => {
        try {
            await dailyMissionsBase.delete(id);
        } catch (error) {
            console.error('Error deleting daily mission:', error);
            throw error;
        }
    },

    // ==================== GU REPORTS ====================

    /**
     * Buscar relatórios GU
     */
    getGuReports: async (): Promise<GuReport[]> => {
        try {
            const result = await guReportsBase.getAll({
                orderBy: 'created_at',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching GU reports:', error);
            throw error;
        }
    },

    /**
     * Adicionar relatório GU
     */
    addGuReport: async (report: Omit<GuReport, 'id'>): Promise<GuReport> => {
        try {
            return await guReportsBase.create(report);
        } catch (error) {
            console.error('Error adding GU report:', error);
            throw error;
        }
    },

    /**
     * Deletar relatório GU
     */
    deleteGuReport: async (id: string): Promise<void> => {
        try {
            await guReportsBase.delete(id);
        } catch (error) {
            console.error('Error deleting GU report:', error);
            throw error;
        }
    },

    // ==================== TRAININGS ====================

    /**
     * Buscar treinamentos (com join de matéria)
     */
    getTrainings: async (): Promise<Training[]> => {
        try {
            // Query com join precisa ser feita manualmente
            const { data, error } = await supabase
                .from('training_schedule')
                .select('*, materia:materias_instrucao(*)')
                .order('date', { ascending: true });

            if (error) {
                console.error('Error fetching trainings:', error);
                throw error;
            }

            return (data as unknown as Training[]) || [];
        } catch (error) {
            console.error('Error fetching trainings:', error);
            throw error;
        }
    },

    /**
     * Adicionar treinamento
     */
    addTraining: async (training: Omit<Training, 'id'>): Promise<Training> => {
        try {
            return await trainingsBase.create(training);
        } catch (error) {
            console.error('Error adding training:', error);
            throw error;
        }
    },

    /**
     * Deletar treinamento
     */
    deleteTraining: async (id: string): Promise<void> => {
        try {
            await trainingsBase.delete(id);
        } catch (error) {
            console.error('Error deleting training:', error);
            throw error;
        }
    },

    // ==================== LEGACY MISSIONS ====================

    /**
     * Buscar missões (legacy)
     */
    getMissions: async (): Promise<Mission[]> => {
        try {
            const result = await missionsBase.getAll({
                orderBy: 'date',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching missions:', error);
            throw error;
        }
    },

    /**
     * Adicionar missão (legacy)
     */
    addMission: async (mission: Omit<Mission, 'id'>): Promise<Mission> => {
        try {
            return await missionsBase.create(mission);
        } catch (error) {
            console.error('Error adding mission:', error);
            throw error;
        }
    },

    /**
     * Alternar status de missão (legacy)
     */
    toggleMission: async (id: number, currentStatus: boolean): Promise<void> => {
        try {
            await missionsBase.update(id, { completed: !currentStatus } as Partial<Mission>);
        } catch (error) {
            console.error('Error toggling mission:', error);
            throw error;
        }
    },

    /**
     * Deletar missão (legacy)
     */
    deleteMission: async (id: number): Promise<void> => {
        try {
            await missionsBase.delete(id);
        } catch (error) {
            console.error('Error deleting mission:', error);
            throw error;
        }
    },
};
