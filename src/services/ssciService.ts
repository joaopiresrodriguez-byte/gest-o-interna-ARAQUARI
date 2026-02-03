import { supabase } from './supabase';
import { SSCIAnalysis, SSCIChatSession, SSCIChatMessage, SSCINormativeDocument } from './types';

export const SSCIService = {
    getSSCIAnalyses: async (): Promise<SSCIAnalysis[]> => {
        const { data, error } = await supabase.from('ssci_analises').select('*').order('data_analise', { ascending: false });
        if (error) console.error('Error fetching SSCI analyses:', error);
        return (data as SSCIAnalysis[]) || [];
    },

    addSSCIAnalysis: async (analysis: SSCIAnalysis) => {
        const { data, error } = await supabase.from('ssci_analises').insert([analysis]).select();
        if (error) throw error;
        return data;
    },

    deleteSSCIAnalysis: async (id: string) => {
        const { error } = await supabase.from('ssci_analises').delete().eq('id', id);
        if (error) throw error;
    },

    getSSCIChatSessions: async (): Promise<SSCIChatSession[]> => {
        const { data, error } = await supabase.from('ssci_sessoes_chat').select('*').order('data_inicio', { ascending: false });
        if (error) console.error('Error fetching chat sessions:', error);
        return (data as SSCIChatSession[]) || [];
    },

    createSSCIChatSession: async (session: SSCIChatSession) => {
        const { data, error } = await supabase.from('ssci_sessoes_chat').insert([session]).select();
        if (error) throw error;
        return data[0];
    },

    deleteSSCIChatSession: async (id: string) => {
        const { error } = await supabase.from('ssci_sessoes_chat').delete().eq('id', id);
        if (error) throw error;
    },

    getSSCIChatMessages: async (sessionId: string): Promise<SSCIChatMessage[]> => {
        const { data, error } = await supabase.from('ssci_consultas_chat').select('*').eq('sessao_id', sessionId).order('timestamp_pergunta', { ascending: true });
        if (error) console.error('Error fetching chat messages:', error);
        return (data as SSCIChatMessage[]) || [];
    },

    addSSCIChatMessage: async (message: SSCIChatMessage) => {
        const { data, error } = await supabase.from('ssci_consultas_chat').insert([message]).select();
        if (error) throw error;
        return data[0];
    },

    getSSCINormativeDocuments: async (): Promise<SSCINormativeDocument[]> => {
        const { data, error } = await supabase.from('ssci_documentos_normativos').select('*').order('data_upload', { ascending: false });
        if (error) console.error('Error fetching normative docs:', error);
        return (data as SSCINormativeDocument[]) || [];
    },

    addSSCINormativeDocument: async (doc: SSCINormativeDocument) => {
        const { data, error } = await supabase.from('ssci_documentos_normativos').insert([doc]).select();
        if (error) throw error;
        return data[0];
    },

    deleteSSCINormativeDocument: async (id: string, fileName: string) => {
        await supabase.storage.from('ssci-documentos-normativos').remove([fileName]);
        const { error } = await supabase.from('ssci_documentos_normativos').delete().eq('id', id);
        if (error) throw error;
    },

    trackDocumentUsage: async (usage: { documento_id: string, tipo_uso: string, referencia_id: string }) => {
        await supabase.from('ssci_uso_documentos').insert([usage]);
        const { data: doc } = await supabase.from('ssci_documentos_normativos').select('vezes_referenciado').eq('id', usage.documento_id).single();
        if (doc) {
            await supabase.from('ssci_documentos_normativos').update({ vezes_referenciado: (doc.vezes_referenciado || 0) + 1 }).eq('id', usage.documento_id);
        }
    }
};
