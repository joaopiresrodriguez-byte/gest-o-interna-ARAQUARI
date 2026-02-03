import { supabase } from './supabase';
import { Purchase, ProductReceipt, PendingNotice } from './types';

export const LogisticsService = {
    // Purchases
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

    // Receipts
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

    // Notices
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
    }
};
