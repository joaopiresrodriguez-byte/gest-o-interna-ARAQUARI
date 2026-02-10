import { supabase } from './supabase';
import { SSCIAnalysis, SSCIChatSession, SSCIChatMessage, SSCINormativeDocument } from './types';
import { BaseService, ServiceError } from './baseService';

// Campos específicos para otimizar queries
const ANALYSIS_FIELDS = 'id, request_type, request_description, ai_response, analysis_date, responsible_user';
const CHAT_SESSION_FIELDS = 'id, session_title, start_date, user, status';
const CHAT_MESSAGE_FIELDS = 'id, session_id, user_message, ai_response, query_timestamp, response_timestamp';
const NORMATIVE_DOC_FIELDS = 'id, document_name, document_type, code_number, issuing_body, publication_date, file_url, times_referenced, upload_date';

// Instâncias dos serviços base
const analysesBase = new BaseService<SSCIAnalysis>('ssci_analyses', ANALYSIS_FIELDS);
const chatSessionsBase = new BaseService<SSCIChatSession>('ssci_chat_sessions', CHAT_SESSION_FIELDS);
const chatMessagesBase = new BaseService<SSCIChatMessage>('ssci_chat_messages', CHAT_MESSAGE_FIELDS);
const normativeDocsBase = new BaseService<SSCINormativeDocument>('ssci_normative_documents', NORMATIVE_DOC_FIELDS);

export const SSCIService = {
    // ==================== ANALYSES ====================

    /**
     * Buscar todas as análises SSCI
     */
    getSSCIAnalyses: async (): Promise<SSCIAnalysis[]> => {
        try {
            const result = await analysesBase.getAll({
                orderBy: 'analysis_date',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching SSCI analyses:', error);
            throw error;
        }
    },

    /**
     * Adicionar análise SSCI
     */
    addSSCIAnalysis: async (analysis: Omit<SSCIAnalysis, 'id'>): Promise<SSCIAnalysis> => {
        try {
            return await analysesBase.create(analysis);
        } catch (error) {
            console.error('Error adding SSCI analysis:', error);
            throw error;
        }
    },

    /**
     * Deletar análise SSCI
     */
    deleteSSCIAnalysis: async (id: string): Promise<void> => {
        try {
            await analysesBase.delete(id);
        } catch (error) {
            console.error('Error deleting SSCI analysis:', error);
            throw error;
        }
    },

    // ==================== CHAT SESSIONS ====================

    /**
     * Buscar todas as sessões de chat
     */
    getSSCIChatSessions: async (): Promise<SSCIChatSession[]> => {
        try {
            const result = await chatSessionsBase.getAll({
                orderBy: 'start_date',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            throw error;
        }
    },

    /**
     * Criar sessão de chat
     */
    createSSCIChatSession: async (session: Omit<SSCIChatSession, 'id'>): Promise<SSCIChatSession> => {
        try {
            return await chatSessionsBase.create(session);
        } catch (error) {
            console.error('Error creating chat session:', error);
            throw error;
        }
    },

    /**
     * Deletar sessão de chat
     */
    deleteSSCIChatSession: async (id: string): Promise<void> => {
        try {
            await chatSessionsBase.delete(id);
        } catch (error) {
            console.error('Error deleting chat session:', error);
            throw error;
        }
    },

    // ==================== CHAT MESSAGES ====================

    /**
     * Buscar mensagens de uma sessão
     */
    getSSCIChatMessages: async (sessionId: string): Promise<SSCIChatMessage[]> => {
        try {
            const result = await chatMessagesBase.query(
                { session_id: sessionId },
                { orderBy: 'query_timestamp', ascending: true }
            );
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching chat messages:', error);
            throw error;
        }
    },

    /**
     * Adicionar mensagem ao chat
     */
    addSSCIChatMessage: async (message: Omit<SSCIChatMessage, 'id'>): Promise<SSCIChatMessage> => {
        try {
            return await chatMessagesBase.create(message);
        } catch (error) {
            console.error('Error adding chat message:', error);
            throw error;
        }
    },

    // ==================== NORMATIVE DOCUMENTS ====================

    /**
     * Buscar documentos normativos
     */
    getSSCINormativeDocuments: async (): Promise<SSCINormativeDocument[]> => {
        try {
            const result = await normativeDocsBase.getAll({
                orderBy: 'upload_date',
                ascending: false,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching normative documents:', error);
            throw error;
        }
    },

    /**
     * Adicionar documento normativo
     */
    addSSCINormativeDocument: async (doc: Omit<SSCINormativeDocument, 'id'>): Promise<SSCINormativeDocument> => {
        try {
            return await normativeDocsBase.create(doc);
        } catch (error) {
            console.error('Error adding normative document:', error);
            throw error;
        }
    },

    /**
     * Deletar documento normativo (remove do storage e do banco)
     */
    deleteSSCINormativeDocument: async (id: string, fileName: string): Promise<void> => {
        try {
            // Remove do storage
            const { error: storageError } = await supabase.storage
                .from('ssci-normative-documents')
                .remove([fileName]);

            if (storageError) {
                throw new ServiceError('Erro ao remover arquivo do storage', storageError);
            }

            // Remove do banco
            await normativeDocsBase.delete(id);
        } catch (error) {
            console.error('Error deleting normative document:', error);
            throw error;
        }
    },

    /**
     * Rastrear uso de documento (lógica de negócio)
     */
    trackDocumentUsage: async (usage: {
        document_id: string;
        usage_type: string;
        reference_id: string;
    }): Promise<void> => {
        try {
            // Registra o uso
            await supabase.from('ssci_document_usage').insert([usage]);

            // Busca contador atual
            const { data: doc } = await supabase
                .from('ssci_normative_documents')
                .select('times_referenced')
                .eq('id', usage.document_id)
                .single();

            // Incrementa contador
            if (doc) {
                await normativeDocsBase.update(usage.document_id, {
                    times_referenced: (doc.times_referenced || 0) + 1,
                } as Partial<SSCINormativeDocument>);
            }
        } catch (error) {
            console.error('Error tracking document usage:', error);
            throw error;
        }
    },

    /**
     * Buscar documentos mais referenciados
     */
    getMostReferencedDocuments: async (limit: number = 10): Promise<SSCINormativeDocument[]> => {
        try {
            const { data, error } = await supabase
                .from('ssci_normative_documents')
                .select(NORMATIVE_DOC_FIELDS)
                .order('times_referenced', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching most referenced documents:', error);
                throw error;
            }

            return (data as unknown as SSCINormativeDocument[]) || [];
        } catch (error) {
            console.error('Error fetching most referenced documents:', error);
            throw error;
        }
    },
};
