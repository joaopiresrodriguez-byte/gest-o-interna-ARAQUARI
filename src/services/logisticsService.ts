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
        try {
            // Tenta primeiro com as colunas padronizadas em inglês
            const { data, error } = await supabase
                .from('product_receipts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching receipts:', error);
                throw error;
            }

            if (!data) return [];

            // Normaliza cada objeto para garantir o preenchimento de photo_url, fiscal_note_number, receipt_date, notes
            return (data as any[]).map((row: any) => ({
                id: row.id,
                photo_url: row.photo_url || row.foto_url || '',
                fiscal_note_number: row.fiscal_note_number || row.numero_nota_fiscal || row.nf_number || row.nf || 'N/A',
                receipt_date: row.receipt_date || row.data_recebimento || row.created_at || '',
                notes: row.notes || row.observacoes || row.description || '',
                product: row.product || row.produto || '',
                quantity: row.quantity || row.quantidade || 0,
                supplier: row.supplier || row.fornecedor || '',
                created_at: row.created_at
            }));
        } catch (error) {
            console.error('Error fetching receipts:', error);
            return [];
        }
    },

    /**
     * Adicionar recibo de produto
     */
    addProductReceipt: async (receipt: Omit<ProductReceipt, 'id'>): Promise<ProductReceipt> => {
        try {
            return await receiptsBase.create(receipt);
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
