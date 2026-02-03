import { supabase } from './supabase';
import { Vehicle, ChecklistItem, DailyChecklist, PendingNotice } from './types';

export const FleetService = {
    getFleet: async (): Promise<Vehicle[]> => {
        const { data, error } = await supabase.from('fleet').select('*').order('id', { ascending: true });
        if (error) console.error('Error fetching fleet:', error);
        return (data as Vehicle[]) || [];
    },

    addVehicle: async (vehicle: Vehicle) => {
        const { error } = await supabase.from('fleet').insert([vehicle]);
        if (error) console.error('Error adding vehicle:', error);
    },

    updateVehicleStatus: async (id: string, status: Vehicle['status']) => {
        const { error } = await supabase.from('fleet').update({ status }).eq('id', id);
        if (error) console.error('Error updating vehicle:', error);
    },

    deleteVehicle: async (id: string) => {
        const { error } = await supabase.from('fleet').delete().eq('id', id);
        if (error) throw error;
    },

    getChecklistItems: async (categoria?: string, viaturaId?: string): Promise<ChecklistItem[]> => {
        let query = supabase.from('itens_conferencia').select('*').eq('ativo', true).order('ordem', { ascending: true });
        if (categoria) query = query.eq('categoria', categoria);
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching items:', error);
            return [];
        }
        let items = (data as ChecklistItem[]) || [];
        if (viaturaId) items = items.filter(it => !it.viatura_id || it.viatura_id === viaturaId);
        return items;
    },

    saveDailyChecklist: async (entry: DailyChecklist) => {
        const { data, error } = await supabase.from('conferencias_diarias').insert([entry]).select();
        if (error) throw error;
        if (entry.status === 'faltante') {
            const { data: itemData } = await supabase.from('itens_conferencia').select('*').eq('id', entry.item_id).single();
            if (itemData) {
                const notice: Partial<PendingNotice> = {
                    conferencia_id: data[0].id,
                    tipo: itemData.categoria === 'viaturas' ? 'viatura' : 'material',
                    destino_modulo: 'B4',
                    viatura_id: entry.viatura_id || itemData.viatura_id,
                    descricao: `Faltante: ${itemData.nome_item} reportado na conferência diária.`,
                    status: 'pendente'
                };
                await supabase.from('avisos_pendencias').insert([notice]);
            }
        }
        return data;
    },

    addChecklistItem: async (item: Partial<ChecklistItem>) => {
        const { data, error } = await supabase.from('itens_conferencia').insert([item]).select();
        if (error) throw error;
        return data[0];
    }
};
