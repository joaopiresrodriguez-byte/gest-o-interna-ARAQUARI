import { Personnel, Vehicle, Occurrence } from './types';

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;

async function sendToSheets(sheet: string, data: (string | number | boolean)[]): Promise<boolean> {
    if (!WEBHOOK_URL) {
        console.warn('[GoogleSheets] VITE_GOOGLE_SHEETS_WEBHOOK_URL not configured. Skipping sync.');
        return false;
    }
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, data }),
            mode: 'no-cors',
        });
        console.log(`[GoogleSheets] Data sent to "${sheet}" sheet.`);
        return true;
    } catch (error) {
        console.error('[GoogleSheets] Sync failed (non-blocking):', error);
        return false;
    }
}

const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch { return dateStr; }
};

export const GoogleSheetsService = {
    syncPersonnel: async (person: Partial<Personnel>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            person.name || '',
            person.war_name || '',
            person.rank || '',
            person.type || '',
            person.status || '',
            person.role || '',
            person.email || '',
            person.phone || '',
            formatDate(person.birth_date),
            person.blood_type || '',
            person.cnh || '',
            person.weapon_permit ? 'Sim' : 'Não',
            person.address || '',
            person.education_level || '',
            person.cnh_category || '',
            person.cnh_number || '',
            person.cpf || '',
            person.emergency_phone || '',
            person.emergency_contact_name || '',
            person.cve_active || '',
            person.graduation || '',
            // New B1 fields
            formatDate(person.cve_issue_date),
            formatDate(person.cve_expiry_date),
            formatDate(person.toxicological_date),
            formatDate(person.toxicological_expiry_date),
            formatDate(person.cnh_expiry_date),
        ];
        return sendToSheets('Efetivo', row);
    },

    syncVehicle: async (vehicle: Partial<Vehicle>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            vehicle.name || '',
            vehicle.type || '',
            vehicle.status === 'active' ? 'QAP' : vehicle.status === 'maintenance' ? 'Manutenção' : 'Baixada',
            vehicle.details || '',
            vehicle.plate || '',
            vehicle.current_km?.toString() || '',
            vehicle.brand || '',
            vehicle.renavam || '',
            vehicle.chassis || '',
            vehicle.year || '',
            vehicle.oil_type || '',
            vehicle.location || '',
            vehicle.nf_number || '',
            vehicle.patrimonio_number || '',
            vehicle.patrimonio_type || '',
        ];
        return sendToSheets('Patrimônio', row);
    },

    syncOccurrence: async (occ: Partial<Occurrence>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            occ.occurrence_type || '',
            occ.occurrence_date ? new Date(occ.occurrence_date).toLocaleString('pt-BR') : '',
            occ.location || '',
            occ.units_involved || '',
            occ.description || '',
            occ.outcome || '',
            occ.visibility === 'public' ? 'Público' : 'Interno',
            occ.status || 'registered',
        ];
        return sendToSheets('Ocorrências', row);
    },

    syncAlerts: async (alerts: Array<{ name: string; type: string; date: string; severity: string; message: string }>): Promise<boolean> => {
        // Send all alerts as rows to a dedicated "Alertas B1" sheet
        for (const alert of alerts.slice(0, 50)) {
            await sendToSheets('Alertas B1', [
                new Date().toLocaleDateString('pt-BR'),
                alert.name,
                alert.type,
                alert.date,
                alert.severity,
                alert.message,
            ]);
        }
        return true;
    },
};
