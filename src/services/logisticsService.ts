import { supabase } from './supabase';
import { Purchase, ProductReceipt, PendingNotice } from './types';
import { BaseService } from './baseService';

// Campos específicos para otimizar queries
const PURCHASE_FIELDS = 'id, item, quantity, unit_price, supplier, status, created_at';
const RECEIPT_FIELDS = 'id, photo_url, fiscal_note_number, receipt_date, notes, created_at';
const NOTICE_FIELDS = 'id, type, description, status, viatura_id, target_module, inspection_id, created_at';

// Instâncias dos serviços base
const purchasesBase = new BaseService<Purchase>('purchases', PURCHASE_FIELDS);
const receiptsBase = new BaseService<ProductReceipt>('product_receipts', RECEIPT_FIELDS);
const noticesBase = new BaseService<PendingNotice>('pending_notices', NOTICE_FIELDS);

export const LogisticsService = {
    // ==================== PURCHASES ====================

    /**
     * Buscar todas as compras
     */
    getPurchases: async (): Promise<Purchase[]> => {
        try {
            const result = await purchasesBase.getAll({
                orderBy: 'created_at',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching purchases:', error);
            throw error;
        }
    },

    /**
     * Adicionar nova compra
     */
    addPurchase: async (purchase: Omit<Purchase, 'id'>): Promise<Purchase> => {
        try {
            return await purchasesBase.create(purchase);
        } catch (error) {
            console.error('Error adding purchase:', error);
            throw error;
        }
    },

    /**
     * Deletar compra
     */
    deletePurchase: async (id: string): Promise<void> => {
        try {
            await purchasesBase.delete(id);
        } catch (error) {
            console.error('Error deleting purchase:', error);
            throw error;
        }
    },

    // ==================== RECEIPTS ====================

    /**
     * Buscar recibos de produtos (limitado a 10 mais recentes)
     */
    getProductsReceipts: async (): Promise<ProductReceipt[]> => {
        // Tentativa 1: busca com ordenação por created_at desc
        const res1 = await supabase
            .from('product_receipts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        let rows: any[] | null = null;

        if (res1.error) {
            console.warn('getProductsReceipts: erro na busca ordenada, tentando sem ordenação:', res1.error);
            // Tentativa 2: busca simples (tabela pode não ter created_at indexado)
            const res2 = await supabase
                .from('product_receipts')
                .select('*')
                .limit(50);

            if (res2.error) {
                // Propaga o erro para que o chamador possa tratar
                console.error('getProductsReceipts: falha definitiva ao buscar recebimentos:', res2.error);
                throw res2.error;
            }
            rows = res2.data;
        } else {
            rows = res1.data;
        }

        if (!rows || !Array.isArray(rows)) return [];

        return rows.map((row: any) => {
            const photo = row.photo_url || row.foto_url || row.photo || row.imagem || row.url || '';
            const nf = row.fiscal_note_number || row.numero_nota_fiscal || row.nf_number || row.nf || row.nota_fiscal || 'S/N';
            const date = row.receipt_date || row.data_recebimento || row.created_at || row.date || '';
            const obs = row.notes || row.observacoes || row.description || row.obs || '';

            return {
                id: row.id || `rec-${Math.random()}`,
                photo_url: photo,
                fiscal_note_number: String(nf),
                receipt_date: date,
                notes: obs,
                product: row.product || row.produto || '',
                quantity: row.quantity || row.quantidade || 1,
                supplier: row.supplier || row.fornecedor || '',
                created_at: row.created_at || date
            };
        });
    },

    /**
     * Adicionar recibo de produto
     */
    addProductReceipt: async (receipt: Omit<ProductReceipt, 'id'>): Promise<ProductReceipt> => {
        try {
            // Tenta inserir com o padrão photo_url e fiscal_note_number
            const { data, error } = await supabase
                .from('product_receipts')
                .insert({
                    photo_url: receipt.photo_url,
                    fiscal_note_number: receipt.fiscal_note_number,
                    notes: receipt.notes,
                    receipt_date: receipt.receipt_date || new Date().toISOString()
                })
                .select('*')
                .single();

            if (error) {
                console.warn('First insert attempt failed, trying fallback columns:', error);
                // Fallback caso a tabela no banco ainda use colunas legadas em pt-BR
                const fallbackRes = await supabase
                    .from('product_receipts')
                    .insert({
                        foto_url: receipt.photo_url,
                        numero_nota_fiscal: receipt.fiscal_note_number,
                        observacoes: receipt.notes,
                        data_recebimento: receipt.receipt_date || new Date().toISOString()
                    })
                    .select('*')
                    .single();

                if (fallbackRes.error) throw fallbackRes.error;
                return fallbackRes.data as unknown as ProductReceipt;
            }

            return data as unknown as ProductReceipt;
        } catch (error) {
            console.error('Error adding receipt:', error);
            throw error;
        }
    },

    /**
     * Deletar recibo
     */
    deleteProductReceipt: async (id: string): Promise<void> => {
        try {
            await receiptsBase.delete(id);
        } catch (error) {
            console.error('Error deleting receipt:', error);
            throw error;
        }
    },

    // ==================== NOTICES ====================

    /**
     * Buscar avisos/pendências com filtros opcionais
     */
    getPendingNotices: async (filters?: {
        tipo?: string;
        status?: string;
        viatura_id?: string;
    }): Promise<PendingNotice[]> => {
        try {
            if (filters && Object.keys(filters).length > 0) {
                const result = await noticesBase.query(
                    filters as Record<string, unknown>,
                    { orderBy: 'created_at', ascending: false }
                );
                return Array.isArray(result) ? result : result.data;
            }

            const result = await noticesBase.getAll({
                orderBy: 'created_at',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching notices:', error);
            throw error;
        }
    },

    /**
     * Resolver aviso/pendência (marca como resolvido)
     */
    resolveNotice: async (id: string): Promise<void> => {
        try {
            await noticesBase.update(id, { status: 'resolvido' } as Partial<PendingNotice>);
        } catch (error) {
            console.error('Error resolving notice:', error);
            throw error;
        }
    },
};
