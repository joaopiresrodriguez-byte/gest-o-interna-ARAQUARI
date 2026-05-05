import { Personnel, Vehicle, Occurrence, B1Course, EpiDelivery, Escala, ServiceSwap } from './types';

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;
const SHEET_EFETIVO = import.meta.env.VITE_SHEETS_EFETIVO_ABA || 'CadastroEfetivo';

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
            new Date().toLocaleDateString('pt-BR'),           // A: Data do Registro
            person.name || '',                                // B: Nome Completo
            person.war_name || '',                            // C: Nome de Guerra
            person.graduation || person.rank || '',           // D: Posto / Graduação
            person.type || '',                                // E: Tipo (BM/BC)
            person.status || '',                              // F: Status
            person.role || '',                                // G: Função
            person.cpf || '',                                 // H: CPF
            formatDate(person.birth_date),                    // I: Data Nascimento
            person.email || '',                               // J: Email
            person.phone || '',                               // K: Telefone
            person.education_level || '',                     // L: Nível Instrução
            person.blood_type || '',                          // M: Tipo Sanguíneo
            person.address || '',                             // N: Endereço
            person.emergency_contact_name || '',              // O: Contato Emergência
            person.emergency_phone || '',                     // P: Tel. Emergência
            person.cve_active || '',                          // Q: CVE Ativo
            formatDate(person.cve_issue_date),                // R: Data Emissão CVE
            formatDate(person.cve_expiry_date),               // S: Validade CVE
            person.cnh_category || '',                        // T: Cat. CNH
            person.cnh_number || '',                          // U: Nº CNH
            formatDate(person.cnh_expiry_date),               // V: Validade CNH
            formatDate(person.toxicological_date),            // W: Data Toxicológico
            formatDate(person.toxicological_expiry_date),     // X: Validade Toxicológico
            person.weapon_permit ? 'Sim' : 'Não',            // Y: Porte de Arma
            formatDate(person.last_cadastro_review),          // Z: Última Revisão Cadastro
        ];
        return sendToSheets(SHEET_EFETIVO, row);
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

    syncCourse: async (course: Partial<B1Course>, personnelName: string, rank: string): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            personnelName,
            rank,
            course.course_name || '',
            course.institution || '',
            course.workload_hours?.toString() || '',
            formatDate(course.completion_date),
            formatDate(course.expiry_date),
            course.category || '',
        ];
        return sendToSheets('Cursos B1', row);
    },

    syncEpi: async (epi: Partial<EpiDelivery>, personnelName: string, rank: string): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            personnelName,
            rank,
            epi.item_name || '',
            epi.item_type || '',
            epi.item_description || '',
            formatDate(epi.delivery_date),
            formatDate(epi.replacement_date),
            epi.quantity?.toString() || '1',
            epi.condition || '',
            epi.patrimonio_number || '',
        ];
        return sendToSheets('Uniformes EPIs', row);
    },

    syncEscala: async (escala: Partial<Escala>, names: string): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            formatDate(escala.data),
            escala.equipe || '',
            names,
            escala.shift_type || '',
            escala.is_folga ? 'Sim' : 'Não'
        ];
        return sendToSheets('Escalas', row);
    },

    syncServiceSwap: async (swap: Partial<ServiceSwap>, milA: string, milB: string, approver?: string): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            milA,
            milB,
            formatDate(swap.new_date),
            formatDate(swap.original_date),
            swap.reason || '',
            swap.approval_status || 'Pendente',
            approver || ''
        ];
        return sendToSheets('Trocas_Servico', row);
    },

    syncSwapCounter: async (personnelName: string, month: string, count: number): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            personnelName,
            month,
            count.toString()
        ];
        return sendToSheets('Contador_Trocas', row);
    },

    syncMonthlyScale: async (month: string, escalas: Escala[], personnel: Personnel[]): Promise<boolean> => {
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        console.log(`[GoogleSheets] Starting batch sync for ${month}...`);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayScales = escalas.filter(e => e.data === dateStr);

            for (const escala of dayScales) {
                const names = escala.militares.map(id => {
                    const p = personnel.find(pers => pers.id === id);
                    return p ? `${p.graduation || ''} ${p.war_name || p.name}` : id.toString();
                }).join(', ');

                await GoogleSheetsService.syncEscala(escala, names);
            }
        }
        return true;
    },
};
