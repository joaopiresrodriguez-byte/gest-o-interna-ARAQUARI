import { supabase } from './supabase';
import { FleetService } from './fleetService';
import { OperationalService } from './operationalService';
import { LogisticsService } from './logisticsService';
import { PersonnelService } from './personnelService';
import { SSCIService } from './ssciService';
import { SocialService } from './socialService';
import { InstructionService } from './instructionService';
import * as Types from './types';

// Re-export types for convenience
export * from './types';

export const SupabaseService = {
    // Core/Storage (Keeping here for now or moving to a CoreService)
    uploadFile: async (bucket: string, path: string, file: File) => {
        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true
        });
        if (error) throw error;
        return data;
    },

    getPublicUrl: (bucket: string, path: string) => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },

    getTodayDate: () => new Date().toISOString().split('T')[0],

    // Fleet & Conference
    ...FleetService,

    // Operational & Missions
    ...OperationalService,

    // Logistics & B4
    ...LogisticsService,

    // Personnel & B1
    ...PersonnelService,

    // Instruction & B3
    ...InstructionService,

    // Social & B5
    ...SocialService,

    // SSCI
    ...SSCIService,

    // Add specific missing methods or overrides if needed
    getMissionsForToday: async (): Promise<Types.DailyMission[]> => {
        const hoje = new Date().toISOString().split('T')[0];
        return OperationalService.getDailyMissions({
            data: hoje,
            status: ['agendada', 'em_andamento']
        });
    },

    // Instruction overrides/proxies
    getCourses: async () => InstructionService.getMateriasInstrucao(),
    addCourse: async (materia: any) => InstructionService.addMateriaInstrucao({
        name: materia.name,
        credit_hours: materia.hours,
        category: materia.category
    }),
};
