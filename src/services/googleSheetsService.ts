import { Personnel, Vehicle, Occurrence, B1Course, EpiDelivery, Escala, ServiceSwap } from './types';
import type { RelatorioMensal } from './b4RelatorioService';

// ─── Webhook-based config (existing integrations) ─────────────────────────────
const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;
const SHEET_EFETIVO = import.meta.env.VITE_SHEETS_EFETIVO_ABA || 'CadastroEfetivo';

// ─── Planilha Mestre B1 — usada por TODAS as abas do módulo B1 ────────────────
const B1_SPREADSHEET_ID = import.meta.env.VITE_SHEETS_EFETIVO_ID || '13U9RCucWBBO2eovZtWX3-CxjZ6coEMsxEh1qYsFiKRw';

// ─── B4 Patrimônio — Spreadsheet ID (aligned with main B1 spreadsheet) ────────
const B4_SPREADSHEET_ID = B1_SPREADSHEET_ID;

// Map item types to the exact tab names in the spreadsheet
const B4_TAB_MAP: Record<string, string> = {
    Equipamento: 'Equipamento',
    Material:    'Material',
    Viatura:     'Viatura',
};

// Column headers for each tab (must match the spreadsheet structure)
const B4_HEADERS: Record<string, string[]> = {
    Equipamento: [
        'Data Cadastro', 'Nome', 'Marca', 'Nº NF', 'Nº Patrimônio',
        'Tipo Patrimônio', 'Localização', 'Status', 'Detalhes', 'Atividades',
    ],
    Material: [
        'Data Cadastro', 'Nome', 'Descrição/Detalhes', 'Status',
        'Localização', 'Atividades',
    ],
    Viatura: [
        'Data Cadastro', 'Nome', 'Marca', 'Placa', 'RENAVAM', 'Chassi',
        'Ano', 'Tipo Óleo', 'Localização', 'Nº Patrimônio', 'Tipo Patrimônio',
        'Status', 'Detalhes', 'Atividades',
    ],
};

interface SendToSheetsOptions {
    spreadsheetId?: string;
    keyColumnIndex?: number;
    keyValue?: string;
    headers?: string[];
}

async function sendToSheets(
    sheet: string, 
    data: (string | number | boolean | null)[],
    options?: SendToSheetsOptions
): Promise<boolean> {
    if (!WEBHOOK_URL) {
        console.warn(`[GoogleSheets] VITE_GOOGLE_SHEETS_WEBHOOK_URL not configured. Skipping sync for "${sheet}".`);
        return false;
    }
    try {
        const isNode = typeof window === 'undefined';
        const body: Record<string, unknown> = { sheet, data };
        if (options) {
            if (options.spreadsheetId) body.spreadsheetId = options.spreadsheetId;
            if (options.keyColumnIndex !== undefined) body.keyColumnIndex = options.keyColumnIndex;
            if (options.keyValue) body.keyValue = options.keyValue;
            if (options.headers) body.headers = options.headers;
        }

        const fetchOptions: { method: string; headers: Record<string, string>; body: string; mode?: 'cors' | 'no-cors' | 'same-origin' } = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        };

        if (!isNode) {
            fetchOptions.mode = 'no-cors';
        }

        const res = await fetch(WEBHOOK_URL, fetchOptions);

        if (isNode || fetchOptions.mode !== 'no-cors') {
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.error(`[GoogleSheets] Webhook HTTP Error ${res.status}: ${res.statusText}. Details: ${errText}`);
                return false;
            }
            const resJson = await res.json() as { success: boolean; error?: string } | null;
            if (resJson && resJson.success === false) {
                console.error(`[GoogleSheets] Apps Script Error for "${sheet}":`, resJson.error);
                return false;
            }
        }

        console.log(`[GoogleSheets] Data sent successfully to "${sheet}" sheet.`);
        return true;
    } catch (error) {
        console.error(`[GoogleSheets] Sync network error to "${sheet}":`, error);
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
        return sendToSheets(SHEET_EFETIVO, row, { spreadsheetId: B1_SPREADSHEET_ID });
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
        // Legacy webhook (kept for backward compatibility)
        return sendToSheets('Patrimônio', row);
    },

    // ─── B4 Direct API Sync ───────────────────────────────────────────────────

    /**
     * Syncs a patrimônio item to the correct B4 spreadsheet tab
     * based on its type: Equipamento | Material | Viatura.
     */
    syncB4Item: async (item: Partial<Vehicle>): Promise<boolean> => {
        const type    = item.type || 'Equipamento';
        const tabName = B4_TAB_MAP[type] ?? 'Equipamento';
        const status  = item.status === 'active' ? 'Ativo' : 'Inativo';
        const atividades = Array.isArray(item.atividades) ? item.atividades.join(', ') : '';
        const dateStr = new Date().toLocaleDateString('pt-BR');

        let row: (string | number | boolean)[];

        if (type === 'Viatura') {
            row = [
                dateStr,
                item.name              || '',
                item.brand             || '',
                item.plate             || '',
                item.renavam           || '',
                item.chassis           || '',
                item.year              || '',
                item.oil_type          || '',
                item.location          || '',
                item.patrimonio_number || '',
                item.patrimonio_type   || '',
                status,
                item.details           || '',
                atividades,
            ];
        } else if (type === 'Equipamento') {
            row = [
                dateStr,
                item.name              || '',
                item.brand             || '',
                item.nf_number         || '',
                item.patrimonio_number || '',
                item.patrimonio_type   || '',
                item.location          || '',
                status,
                item.details           || '',
                atividades,
            ];
        } else {
            // Material
            row = [
                dateStr,
                item.name     || '',
                item.details  || '',
                status,
                item.location || '',
                atividades,
            ];
        }

        const headers = B4_HEADERS[type] || [];
        const keyValue = type === 'Viatura' 
            ? String(item.plate || item.id || '')
            : String(item.patrimonio_number || item.id || '');

        const keyColumnIndex = type === 'Viatura'
            ? headers.indexOf('Placa')
            : headers.indexOf('Nº Patrimônio');

        return sendToSheets(tabName, row, {
            spreadsheetId: B4_SPREADSHEET_ID,
            headers,
            keyValue,
            keyColumnIndex: keyColumnIndex >= 0 ? keyColumnIndex : undefined
        });
    },

    /** Expose tab headers so a setup routine can pre-fill row 1 if needed. */
    getB4Headers: (type: 'Equipamento' | 'Material' | 'Viatura'): string[] =>
        B4_HEADERS[type] ?? [],

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
        const CURSO_HEADERS = [
            'Data Registro', 'Militar', 'Graduação', 'Curso', 'Sigla',
            'Instituição', 'Carga Horária (h)', 'Data Conclusão', 'Validade', 'Categoria',
        ];
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            personnelName,
            rank,
            course.course_name || '',
            course.sigla_curso || '',
            course.institution || '',
            course.workload_hours?.toString() || '',
            formatDate(course.completion_date),
            formatDate(course.expiry_date),
            course.category || '',
        ];
        return sendToSheets('CursosEfetivo', row, {
            spreadsheetId: B1_SPREADSHEET_ID,
            headers: CURSO_HEADERS,
        });
    },

    syncEpi: async (epi: Partial<EpiDelivery>, personnelName: string, rank: string): Promise<boolean> => {
        const EPI_HEADERS = [
            'Data Registro', 'Militar', 'Graduação', 'Item', 'Tipo',
            'Descrição', 'Data Entrega', 'Data Substituição', 'Qtd', 'Condição', 'Nº Patrimônio',
        ];
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
        return sendToSheets('Uniformes EPIs', row, {
            spreadsheetId: B1_SPREADSHEET_ID,
            headers: EPI_HEADERS,
        });
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
        return sendToSheets('Escalas', row, { spreadsheetId: B1_SPREADSHEET_ID });
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
        return sendToSheets('Trocas_Servico', row, { spreadsheetId: B1_SPREADSHEET_ID });
    },

    syncSwapCounter: async (personnelName: string, month: string, count: number): Promise<boolean> => {
        const row = [
            new Date().toLocaleDateString('pt-BR'),
            personnelName,
            month,
            count.toString()
        ];
        return sendToSheets('Contador_Trocas', row, { spreadsheetId: B1_SPREADSHEET_ID });
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

    syncRelatorioB4: async (relatorio: RelatorioMensal): Promise<boolean> => {
        const row = [
            relatorio.titulo,
            `${relatorio.mes}/${relatorio.ano}`,
            relatorio.totalPatrimonio,
            relatorio.totalViaturas,
            relatorio.viaturasOperacionais,
            relatorio.viaturasManutencao,
            relatorio.totalManutencoes,
            relatorio.custoManutencoes,
            relatorio.totalCombustivel,
            relatorio.custoCombustivel,
            relatorio.ocorrenciasAtendidas,
            relatorio.kmRodados,
            new Date().toLocaleDateString('pt-BR'),
        ];
        return sendToSheets('RelatoriosB4', row);
    },
};
