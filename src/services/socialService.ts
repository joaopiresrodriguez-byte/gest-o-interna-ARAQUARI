import { supabase } from './supabase';
import { SocialPost } from './types';

export const SocialService = {
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
    }
};
