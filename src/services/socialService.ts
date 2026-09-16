import { SocialPost, Occurrence, PressContact, PortaVoz } from './types';
import { BaseService } from './baseService';

// Fields for optimized queries
const SOCIAL_POST_FIELDS = 'id, content, platform, likes, image_url, created_at, title, category, event_date';
const OCCURRENCE_FIELDS = 'id, created_at, occurrence_type, occurrence_date, location, units_involved, description, outcome, visibility, status, image_url';
const PRESS_CONTACT_FIELDS = 'id, created_at, name, vehicle, type, phone, email, notes';
const PORTA_VOZ_FIELDS = 'id, created_at, personnel_id, name, rank, phone, is_active, notes';

// Base service instances
const socialPostsBase = new BaseService<SocialPost>('social_posts', SOCIAL_POST_FIELDS);
const occurrencesBase = new BaseService<Occurrence>('occurrences', OCCURRENCE_FIELDS);
const pressContactsBase = new BaseService<PressContact>('press_contacts', PRESS_CONTACT_FIELDS);
const portaVozesBase = new BaseService<PortaVoz>('porta_vozes', PORTA_VOZ_FIELDS);

export const SocialService = {
    // ===== SOCIAL POSTS =====

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

    addSocialPost: async (post: Omit<SocialPost, 'id'>): Promise<SocialPost> => {
        try {
            return await socialPostsBase.create(post);
        } catch (error) {
            console.error('Error adding social post:', error);
            throw error;
        }
    },

    updateSocialPost: async (id: string, post: Partial<SocialPost>): Promise<SocialPost> => {
        try {
            return await socialPostsBase.update(id, post);
        } catch (error) {
            console.error('Error updating social post:', error);
            throw error;
        }
    },

    deleteSocialPost: async (id: string): Promise<void> => {
        try {
            await socialPostsBase.delete(id);
        } catch (error) {
            console.error('Error deleting social post:', error);
            throw error;
        }
    },

    // ===== OCCURRENCES =====

    getOccurrences: async (): Promise<Occurrence[]> => {
        try {
            const result = await occurrencesBase.getAll({
                orderBy: 'occurrence_date',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching occurrences:', error);
            throw error;
        }
    },

    addOccurrence: async (occ: Omit<Occurrence, 'id'>): Promise<Occurrence> => {
        try {
            return await occurrencesBase.create(occ);
        } catch (error) {
            console.error('Error adding occurrence:', error);
            throw error;
        }
    },

    updateOccurrence: async (id: string, occ: Partial<Occurrence>): Promise<Occurrence> => {
        try {
            return await occurrencesBase.update(id, occ);
        } catch (error) {
            console.error('Error updating occurrence:', error);
            throw error;
        }
    },

    deleteOccurrence: async (id: string): Promise<void> => {
        try {
            await occurrencesBase.delete(id);
        } catch (error) {
            console.error('Error deleting occurrence:', error);
            throw error;
        }
    },

    // ===== PRESS CONTACTS =====

    getPressContacts: async (): Promise<PressContact[]> => {
        try {
            const result = await pressContactsBase.getAll({
                orderBy: 'name',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching press contacts:', error);
            return [];
        }
    },

    addPressContact: async (contact: Omit<PressContact, 'id'>): Promise<PressContact> => {
        try {
            return await pressContactsBase.create(contact);
        } catch (error) {
            console.error('Error adding press contact:', error);
            throw error;
        }
    },

    deletePressContact: async (id: string): Promise<void> => {
        try {
            await pressContactsBase.delete(id);
        } catch (error) {
            console.error('Error deleting press contact:', error);
            throw error;
        }
    },

    // ===== PORTA VOZES =====

    getPortaVozes: async (): Promise<PortaVoz[]> => {
        try {
            const result = await portaVozesBase.getAll({
                orderBy: 'name',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching porta-vozes:', error);
            return [];
        }
    },

    addPortaVoz: async (pv: Omit<PortaVoz, 'id'>): Promise<PortaVoz> => {
        try {
            return await portaVozesBase.create(pv);
        } catch (error) {
            console.error('Error adding porta-voz:', error);
            throw error;
        }
    },

    deletePortaVoz: async (id: string): Promise<void> => {
        try {
            await portaVozesBase.delete(id);
        } catch (error) {
            console.error('Error deleting porta-voz:', error);
            throw error;
        }
    },
};
