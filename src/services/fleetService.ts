import { supabase } from './supabase';
import { Vehicle, ChecklistItem, DailyChecklist, PendingNotice } from './types';
import { BaseService } from './baseService';

// Campos específicos para otimizar queries
const VEHICLE_FIELDS = 'id, name, type, plate, status, details, current_km, last_revision';
const CHECKLIST_ITEM_FIELDS = 'id, category, item_name, viatura_id, description, is_active, sort_order';
const DAILY_CHECKLIST_FIELDS = 'id, item_id, viatura_id, inspection_date, status, notes, responsible, created_at';

// Instâncias dos serviços base
const fleetBase = new BaseService<Vehicle>('fleet', VEHICLE_FIELDS);
const checklistItemsBase = new BaseService<ChecklistItem>('checklist_items', CHECKLIST_ITEM_FIELDS);
const dailyChecklistsBase = new BaseService<DailyChecklist>('daily_checklists', DAILY_CHECKLIST_FIELDS);

export const FleetService = {
    /**
     * Buscar toda a frota
     */
    getFleet: async (): Promise<Vehicle[]> => {
        try {
            const result = await fleetBase.getAll({
                orderBy: 'id',
                ascending: true,
            });
            return Array.isArray(result) ? result : result.data;
        } catch (error) {
            console.error('Error fetching fleet:', error);
            throw error;
        }
    },

    /**
     * Adicionar veículo
     */
    addVehicle: async (vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
        try {
            return await fleetBase.create(vehicle);
        } catch (error) {
            console.error('Error adding vehicle:', error);
            throw error;
        }
    },

    /**
     * Atualizar status do veículo
     */
    updateVehicleStatus: async (id: string, status: Vehicle['status']): Promise<void> => {
        try {
            await fleetBase.update(id, { status } as Partial<Vehicle>);
        } catch (error) {
            console.error('Error updating vehicle:', error);
            throw error;
        }
    },

    /**
     * Deletar veículo
     */
    deleteVehicle: async (id: string): Promise<void> => {
        try {
            await fleetBase.delete(id);
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            throw error;
        }
    },

    /**
     * Buscar itens de checklist com filtros opcionais
     */
    getChecklistItems: async (categoria?: string, viaturaId?: string): Promise<ChecklistItem[]> => {
        try {
            const filters: Record<string, unknown> = { is_active: true };
            if (categoria) {
                filters.category = categoria;
            }

            const result = await checklistItemsBase.query(filters, {
                orderBy: 'sort_order',
                ascending: true,
            });

            let items = Array.isArray(result) ? result : result.data;

            // Filtro adicional por viatura (lógica de negócio)
            if (viaturaId) {
                items = items.filter(it => !it.viatura_id || it.viatura_id === viaturaId);
            }

            return items;
        } catch (error) {
            console.error('Error fetching checklist items:', error);
            return [];
        }
    },

    /**
     * Buscar conferências diárias
     */
    getDailyChecklists: async (): Promise<DailyChecklist[]> => {
        try {
            // Need to join with vehicle name and item name manually or via view if fields are just IDs
            // For now, fetching raw. Ideally we should select relations.

            const { data, error } = await supabase
                .from('daily_checklists')
                .select(DAILY_CHECKLIST_FIELDS)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as any) || [];
        } catch (error) {
            console.error('Error fetching daily checklists:', error);
            return [];
        }
    },

    /**
     * Salvar conferência diária (com lógica de criação de avisos)
     */
    saveDailyChecklist: async (entry: Omit<DailyChecklist, 'id'>): Promise<DailyChecklist> => {
        try {
            const created = await dailyChecklistsBase.create(entry);

            // Lógica de negócio: criar aviso se item está faltante
            if (entry.status === 'faltante') {
                const { data: itemData } = await supabase
                    .from('checklist_items')
                    .select('*')
                    .eq('id', entry.item_id)
                    .single();

                if (itemData) {
                    const notice: Partial<PendingNotice> = {
                        inspection_id: created.id,
                        type: itemData.category === 'viaturas' ? 'viatura' : 'material',
                        target_module: 'B4',
                        viatura_id: entry.viatura_id || itemData.viatura_id,
                        description: `Faltante: ${itemData.item_name} reportado na conferência diária.`,
                        status: 'pendente',
                    };

                    await supabase.from('pending_notices').insert([notice]);
                }
            }

            return created;
        } catch (error) {
            console.error('Error saving daily checklist:', error);
            throw error;
        }
    },

    /**
     * Adicionar item de checklist
     */
    addChecklistItem: async (item: Partial<ChecklistItem>): Promise<ChecklistItem> => {
        try {
            return await checklistItemsBase.create(item);
        } catch (error) {
            console.error('Error adding checklist item:', error);
            throw error;
        }
    },
};
