import { Personnel, Vehicle, Occurrence } from './types';

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;

/**
 * Sends data to Google Sheets via Apps Script webhook.
 * Fails silently — Sheets sync should never block Supabase operations.
 */
async function sendToSheets(sheet: string, data: (string | number | boolean)[]): Promise<boolean> {
    if (!WEBHOOK_URL) {
        console.warn('[GoogleSheets] VITE_GOOGLE_SHEETS_WEBHOOK_URL not configured. Skipping sync.');
        return false;
    }

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, data }),
            mode: 'no-cors', // Apps Script requires no-cors from browser
        });

        // In no-cors mode, response is opaque so we can't read it
        // But if fetch didn't throw, the request was sent successfully
        console.log(`[GoogleSheets] Data sent to "${sheet}" sheet.`);
        return true;
    } catch (error) {
        console.error('[GoogleSheets] Sync failed (non-blocking):', error);
        return false;
    }
}

const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
};

export const GoogleSheetsService = {
    /**
     * Sync new personnel to the "Efetivo" sheet
     */
    syncPersonnel: async (person: Partial<Personnel>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),  // Data Registro
            person.name || '',                         // Nome
            person.war_name || '',                     // Nome Guerra
            person.rank || '',                         // Posto/Grad
            person.type || '',                         // Tipo (BM/BC)
            person.status || '',                       // Status
            person.role || '',                         // Função
            person.email || '',                        // Email
            person.phone || '',                        // Telefone
            formatDate(person.birth_date),             // Nascimento
            person.blood_type || '',                   // Tipo Sanguíneo
            person.cnh || '',                          // CNH
            person.weapon_permit ? 'Sim' : 'Não',     // Porte Arma
            person.address || '',                      // Endereço
            // New columns (append at end)
            person.education_level || '',               // Grau de Instrução
            person.cnh_category || '',                  // Categoria CNH
            person.cnh_number || '',                    // Número da CNH
            person.cpf || '',                           // CPF
            person.emergency_phone || '',               // Contato de Emergência
            person.emergency_contact_name || '',        // Nome do Contato de Emergência
            person.cve_active || '',                     // CVE Ativo
            person.graduation || '',                     // Posto ou Graduação
        ];
        return sendToSheets('Efetivo', row);
    },

    /**
     * Sync new vehicle/equipment to the "Patrimônio" sheet
     */
    syncVehicle: async (vehicle: Partial<Vehicle>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),   // Data Registro
            vehicle.name || '',                        // Nome
            vehicle.type || '',                        // Tipo
            vehicle.status === 'active' ? 'QAP' : vehicle.status === 'maintenance' ? 'Manutenção' : 'Baixada',
            vehicle.details || '',                     // Detalhes
            vehicle.plate || '',                       // Placa
            vehicle.current_km?.toString() || '',      // KM Atual
            // New columns (append at end)
            vehicle.brand || '',                        // Marca
            vehicle.renavam || '',                      // RENAVAM
            vehicle.chassis || '',                      // Chassi
            vehicle.year || '',                         // Ano
            vehicle.oil_type || '',                     // Tipo de Óleo
            vehicle.location || '',                     // Localização Atual
            vehicle.nf_number || '',                    // Nº NF de Compra
            vehicle.patrimonio_number || '',             // Número de Patrimônio
            vehicle.patrimonio_type || '',               // Tipo de Patrimônio
        ];
        return sendToSheets('Patrimônio', row);
    },

    /**
     * Sync new occurrence to the "Ocorrências" sheet
     */
    syncOccurrence: async (occ: Partial<Occurrence>): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),    // Data Registro
            occ.occurrence_type || '',                  // Tipo
            occ.occurrence_date ? new Date(occ.occurrence_date).toLocaleString('pt-BR') : '', // Data/Hora
            occ.location || '',                         // Localização
            occ.units_involved || '',                   // Unidades Envolvidas
            occ.description || '',                      // Descrição
            occ.outcome || '',                          // Desfecho
            occ.visibility === 'public' ? 'Público' : 'Interno', // Visibilidade
            occ.status || 'registered',                 // Status
        ];
        return sendToSheets('Ocorrências', row);
    },
};
