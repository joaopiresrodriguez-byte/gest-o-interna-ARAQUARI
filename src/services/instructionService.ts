import { supabase } from './supabase';
import { MateriaInstrucao, MateriaApresentacao, MateriaVideo, Training } from './types';

export const InstructionService = {
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

    deleteMateriaInstrucao: async (id: string) => {
        const { error } = await supabase.from('materias_instrucao').delete().eq('id', id);
        if (error) throw error;
    },

    getMateriaApresentacoes: async (materiaId: string): Promise<MateriaApresentacao[]> => {
        const { data, error } = await supabase.from('materia_apresentacoes').select('*').eq('materia_id', materiaId).order('ordem', { ascending: true });
        if (error) console.error('Error fetching presentations:', error);
        return (data as MateriaApresentacao[]) || [];
    },

    addMateriaApresentacao: async (apresentacao: MateriaApresentacao) => {
        const { error } = await supabase.from('materia_apresentacoes').insert([apresentacao]);
        if (error) throw error;
        await InstructionService.atualizarContadoresMateriais(apresentacao.materia_id);
    },

    deleteMateriaApresentacao: async (id: string, materiaId: string) => {
        const { error } = await supabase.from('materia_apresentacoes').delete().eq('id', id);
        if (error) throw error;
        await InstructionService.atualizarContadoresMateriais(materiaId);
    },

    getMateriaVideos: async (materiaId: string): Promise<MateriaVideo[]> => {
        const { data, error } = await supabase.from('materia_videos').select('*').eq('materia_id', materiaId).order('ordem', { ascending: true });
        if (error) console.error('Error fetching videos:', error);
        return (data as MateriaVideo[]) || [];
    },

    addMateriaVideo: async (video: MateriaVideo) => {
        const { error } = await supabase.from('materia_videos').insert([video]);
        if (error) throw error;
        await InstructionService.atualizarContadoresMateriais(video.materia_id);
    },

    deleteMateriaVideo: async (id: string, materiaId: string) => {
        const { error } = await supabase.from('materia_videos').delete().eq('id', id);
        if (error) throw error;
        await InstructionService.atualizarContadoresMateriais(materiaId);
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
    }
};
