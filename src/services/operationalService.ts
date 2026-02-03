import { supabase } from './supabase';
import { DailyMission, Mission, GuReport, Training } from './types';

export const OperationalService = {
    // Missions
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

    // Gu Reports
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

    // Trainings
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

    // Legacy/Core missions
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
    }
};
