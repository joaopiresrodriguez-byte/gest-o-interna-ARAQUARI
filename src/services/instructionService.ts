import { supabase } from './supabase';
import { MateriaInstrucao, MateriaApresentacao, MateriaVideo, Training } from './types';
import { BaseService } from './baseService';

// Campos específicos para otimizar queries
const MATERIA_FIELDS = 'id, name, category, level, status, total_presentations, total_videos, created_at, updated_at';
const APRESENTACAO_FIELDS = 'id, materia_id, title, file_path, sort_order';
const VIDEO_FIELDS = 'id, materia_id, title, video_url, duration, sort_order';
const TRAINING_FIELDS = 'id, materia_id, date, instructor, location, status';

// Instâncias dos serviços base
const materiasBase = new BaseService<MateriaInstrucao>('materias_instrucao', MATERIA_FIELDS);
const apresentacoesBase = new BaseService<MateriaApresentacao>('materias_apresentacoes', APRESENTACAO_FIELDS);
const videosBase = new BaseService<MateriaVideo>('materias_videos', VIDEO_FIELDS);
const trainingsBase = new BaseService<Training>('training_schedule', TRAINING_FIELDS);

export const InstructionService = {
    // ==================== MATÉRIAS DE INSTRUÇÃO ====================

    /**
     * Buscar matérias de instrução com filtros opcionais
     */
    getMateriasInstrucao: async (filtros?: {
        categoria?: string;
        nivel?: string;
        status?: string;
    }): Promise<MateriaInstrucao[]> => {
        try {
            if (filtros && Object.keys(filtros).length > 0) {
                const result = await materiasBase.query(filtros as Record<string, unknown>, {
                    orderBy: 'name',
                    ascending: true,
                });
                return Array.isArray(result) ? result : result.data;
            }

            const result = await materiasBase.getAll({
                orderBy: 'name',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching materias:', error);
            throw error;
        }
    },

    /**
     * Adicionar matéria de instrução
     */
    addMateriaInstrucao: async (materia: Omit<MateriaInstrucao, 'id'>): Promise<MateriaInstrucao> => {
        try {
            return await materiasBase.create(materia);
        } catch (error) {
            console.error('Error adding materia:', error);
            throw error;
        }
    },

    /**
     * Atualizar matéria de instrução
     */
    updateMateriaInstrucao: async (
        id: string,
        updates: Partial<MateriaInstrucao>
    ): Promise<MateriaInstrucao> => {
        try {
            const updatesWithTimestamp = {
                ...updates,
                updated_at: new Date().toISOString(),
            };
            return await materiasBase.update(id, updatesWithTimestamp);
        } catch (error) {
            console.error('Error updating materia:', error);
            throw error;
        }
    },

    /**
     * Deletar matéria de instrução
     */
    deleteMateriaInstrucao: async (id: string): Promise<void> => {
        try {
            await materiasBase.delete(id);
        } catch (error) {
            console.error('Error deleting materia:', error);
            throw error;
        }
    },

    // ==================== APRESENTAÇÕES ====================

    /**
     * Buscar apresentações de uma matéria
     */
    getMateriaApresentacoes: async (materiaId: string): Promise<MateriaApresentacao[]> => {
        try {
            const result = await apresentacoesBase.query(
                { materia_id: materiaId },
                { orderBy: 'sort_order', ascending: true }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching presentations:', error);
            throw error;
        }
    },

    /**
     * Adicionar apresentação (atualiza contadores automaticamente)
     */
    addMateriaApresentacao: async (apresentacao: Omit<MateriaApresentacao, 'id'>): Promise<MateriaApresentacao> => {
        try {
            const created = await apresentacoesBase.create(apresentacao);
            await InstructionService.atualizarContadoresMateriais(apresentacao.materia_id);
            return created;
        } catch (error) {
            console.error('Error adding presentation:', error);
            throw error;
        }
    },

    /**
     * Deletar apresentação (atualiza contadores automaticamente)
     */
    deleteMateriaApresentacao: async (id: string, materiaId: string): Promise<void> => {
        try {
            await apresentacoesBase.delete(id);
            await InstructionService.atualizarContadoresMateriais(materiaId);
        } catch (error) {
            console.error('Error deleting presentation:', error);
            throw error;
        }
    },

    // ==================== VÍDEOS ====================

    /**
     * Buscar vídeos de uma matéria
     */
    getMateriaVideos: async (materiaId: string): Promise<MateriaVideo[]> => {
        try {
            const result = await videosBase.query(
                { materia_id: materiaId },
                { orderBy: 'sort_order', ascending: true }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching videos:', error);
            throw error;
        }
    },

    /**
     * Adicionar vídeo (atualiza contadores automaticamente)
     */
    addMateriaVideo: async (video: Omit<MateriaVideo, 'id'>): Promise<MateriaVideo> => {
        try {
            const created = await videosBase.create(video);
            await InstructionService.atualizarContadoresMateriais(video.materia_id);
            return created;
        } catch (error) {
            console.error('Error adding video:', error);
            throw error;
        }
    },

    /**
     * Deletar vídeo (atualiza contadores automaticamente)
     */
    deleteMateriaVideo: async (id: string, materiaId: string): Promise<void> => {
        try {
            await videosBase.delete(id);
            await InstructionService.atualizarContadoresMateriais(materiaId);
        } catch (error) {
            console.error('Error deleting video:', error);
            throw error;
        }
    },

    // ==================== LÓGICA DE NEGÓCIO ====================

    /**
     * Atualizar contadores de materiais (apresentações e vídeos)
     */
    atualizarContadoresMateriais: async (materiaId: string): Promise<void> => {
        try {
            const [presCount, vidCount] = await Promise.all([
                apresentacoesBase.count({ materia_id: materiaId }),
                videosBase.count({ materia_id: materiaId }),
            ]);

            await materiasBase.update(materiaId, {
                total_apresentacoes: presCount,
                total_videos: vidCount,
                updated_at: new Date().toISOString(),
            } as Partial<MateriaInstrucao>);
        } catch (error) {
            console.error('Error updating material counters:', error);
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
};
