import { supabase } from './supabase';
import { ScaleException, ScaleAudit } from './types';

export const ScaleAdjustmentService = {
    getExceptions: async (month?: string): Promise<ScaleException[]> => {
        let query = supabase.from('scale_exceptions').select('*');
        if (month) {
            const startDate = `${month}-01`;
            const [year, m] = month.split('-').map(Number);
            const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
            query = query.gte('date', startDate).lte('date', endDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    addException: async (exception: Omit<ScaleException, 'id' | 'created_at'>): Promise<ScaleException> => {
        const { data, error } = await supabase
            .from('scale_exceptions')
            .insert(exception)
            .select()
            .single();
        if (error) throw error;

        // Log audit
        await ScaleAdjustmentService.logAudit({
            action_type: exception.type === 'ADD' ? 'Adição Manual' : 'Remoção Manual',
            scale_date: exception.date,
            personnel_id: exception.personnel_id,
            personnel_name: 'Militar', // Ideally pass name from UI
            reason: exception.reason,
            performed_by: exception.performed_by
        });

        return data;
    },

    removeException: async (id: string): Promise<boolean> => {
        const { error } = await supabase
            .from('scale_exceptions')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    logAudit: async (log: Omit<ScaleAudit, 'id' | 'performed_at'>): Promise<void> => {
        await supabase.from('scale_audit_log').insert(log);
    },

    getAuditLogs: async (month?: string): Promise<ScaleAudit[]> => {
        let query = supabase.from('scale_audit_log').select('*').order('performed_at', { ascending: false });
        if (month) {
            const startDate = `${month}-01`;
            const [year, m] = month.split('-').map(Number);
            const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
            query = query.gte('scale_date', startDate).lte('scale_date', endDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
};
