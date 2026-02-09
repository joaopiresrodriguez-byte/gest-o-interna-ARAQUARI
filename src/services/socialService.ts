import { SocialPost } from './types';
import { BaseService } from './baseService';

// Campos específicos para otimizar queries
const SOCIAL_POST_FIELDS = 'id, titulo, descricao, tipo, data_evento, responsavel, status, created_at';

// Instância do serviço base
const socialPostsBase = new BaseService<SocialPost>('social_posts', SOCIAL_POST_FIELDS);

export const SocialService = {
    /**
     * Buscar todos os posts sociais
     */
    getSocialPosts: async (): Promise<SocialPost[]> => {
        try {
            const result = await socialPostsBase.getAll({
                orderBy: 'created_at',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching social posts:', error);
            throw error;
        }
    },

    /**
     * Adicionar post social
     */
    addSocialPost: async (post: Omit<SocialPost, 'id'>): Promise<SocialPost> => {
        try {
            return await socialPostsBase.create(post);
        } catch (error) {
            console.error('Error adding social post:', error);
            throw error;
        }
    },

    /**
     * Atualizar post social
     */
    updateSocialPost: async (id: string, post: Partial<SocialPost>): Promise<SocialPost> => {
        try {
            return await socialPostsBase.update(id, post);
        } catch (error) {
            console.error('Error updating social post:', error);
            throw error;
        }
    },

    /**
     * Deletar post social
     */
    deleteSocialPost: async (id: string): Promise<void> => {
        try {
            await socialPostsBase.delete(id);
        } catch (error) {
            console.error('Error deleting social post:', error);
            throw error;
        }
    },

    /**
     * Buscar posts por tipo
     */
    getSocialPostsByType: async (tipo: string): Promise<SocialPost[]> => {
        try {
            const result = await socialPostsBase.query(
                { tipo },
                { orderBy: 'created_at', ascending: false }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching social posts by type:', error);
            throw error;
        }
    },

    /**
     * Buscar posts por status
     */
    getSocialPostsByStatus: async (status: string): Promise<SocialPost[]> => {
        try {
            const result = await socialPostsBase.query(
                { status },
                { orderBy: 'data_evento', ascending: true }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching social posts by status:', error);
            throw error;
        }
    },
};
