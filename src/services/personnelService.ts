import { supabase } from './supabase';
import { Personnel, DocumentB1, Vacation } from './types';

export const PersonnelService = {
    getPersonnel: async (): Promise<Personnel[]> => {
        const { data, error } = await supabase.from('personnel').select('*').order('name', { ascending: true });
        if (error) console.error('Error fetching personnel:', error);
        return (data as Personnel[]) || [];
    },

    addPersonnel: async (person: Personnel) => {
        const { error } = await supabase.from('personnel').insert([person]);
        if (error) console.error('Error adding personnel:', error);
    },

    deletePersonnel: async (id: number) => {
        const { error } = await supabase.from('personnel').delete().eq('id', id);
        if (error) throw error;
    },

    getDocumentsB1: async (): Promise<DocumentB1[]> => {
        const { data, error } = await supabase.from('documentos').select('*').order('data_upload', { ascending: false });
        if (error) console.error('Error fetching documents:', error);
        return (data as DocumentB1[]) || [];
    },

    addDocumentB1: async (doc: DocumentB1) => {
        const { error } = await supabase.from('documentos').insert([doc]);
        if (error) throw error;
    },

    deleteDocumentB1: async (id: string, path: string) => {
        await supabase.storage.from('documentos-b1').remove([path]);
        const { error } = await supabase.from('documentos').delete().eq('id', id);
        if (error) throw error;
    },

    getVacations: async (): Promise<Vacation[]> => {
        const { data, error } = await supabase.from('ferias').select('*').order('data_inicio', { ascending: true });
        if (error) console.error('Error fetching vacations:', error);
        return (data as Vacation[]) || [];
    },

    addVacation: async (vacation: Vacation) => {
        const { error } = await supabase.from('ferias').insert([vacation]);
        if (error) throw error;
    },

    deleteVacation: async (id: string) => {
        const { error } = await supabase.from('ferias').delete().eq('id', id);
        if (error) throw error;
    }
};
