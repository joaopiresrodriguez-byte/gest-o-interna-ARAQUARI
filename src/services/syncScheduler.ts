/**
 * syncScheduler.ts — Gerenciador de Sincronização em Segundo Plano
 *
 * Processa registros com sync_status = 'pending' ou 'failed' em todas as
 * tabelas sincronizadas, disparando re-tentativas assíncronas com o
 * webhook do Google Apps Script.
 *
 * FLUXO:
 *   1. Dado salvo no Supabase com sync_status = 'pending'
 *   2. SyncScheduler tenta enviar ao Google Sheets
 *   3. Sucesso → sync_status = 'synced'
 *   4. Falha   → sync_status = 'failed', sync_error = mensagem
 *   5. Na próxima tentativa, registros 'failed' também são reprocessados
 */

import { supabase } from './supabase';

// ─── Configuração ─────────────────────────────────────────────────────────────

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL as string | undefined;
const SHEETS_EFETIVO_ID = import.meta.env.VITE_SHEETS_EFETIVO_ID as string | undefined;
const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_DOCS_FOLDER_ID as string | undefined;

// Intervalo padrão de sincronização automática (5 minutos)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// ─── Tipos internos ────────────────────────────────────────────────────────────

type SyncStatus = 'pending' | 'synced' | 'failed';

interface WebhookPayload {
    action?: 'sync' | 'createSpreadsheet';
    sheet?: string;
    data?: (string | number | null)[];
    spreadsheetId?: string;
    keyColumnIndex?: number;
    keyValue?: string;
    headers?: string[];
    name?: string;
    folderId?: string;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch { return dateStr; }
};

/**
 * Envia payload ao webhook do Google Apps Script.
 * Retorna { ok: true } em caso de sucesso, { ok: false, error } em falha.
 */
async function callWebhook(payload: WebhookPayload): Promise<{ ok: boolean; error?: string }> {
    if (!WEBHOOK_URL) {
        return { ok: false, error: 'VITE_GOOGLE_SHEETS_WEBHOOK_URL não configurado.' };
    }
    try {
        const isNode = typeof window === 'undefined';
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        };

        if (!isNode) {
            fetchOptions.mode = 'no-cors';
        }

        const response = await fetch(WEBHOOK_URL, fetchOptions);

        if (isNode || fetchOptions.mode !== 'no-cors') {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                const errMsg = `Erro HTTP ${response.status}: ${response.statusText}. Detalhes: ${errText}`;
                console.error('[SyncScheduler] Falha na requisição:', errMsg);
                return { ok: false, error: errMsg };
            }
            const resJson = await response.json().catch(() => null) as { success: boolean; error?: string } | null;
            if (resJson && resJson.success === false) {
                const errMsg = resJson.error || 'Erro interno reportado pelo Apps Script.';
                console.error('[SyncScheduler] Erro do Apps Script:', errMsg);
                return { ok: false, error: errMsg };
            }
        }

        return { ok: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[SyncScheduler] Erro de rede ou na chamada do webhook:', err);
        return { ok: false, error: message };
    }
}

/**
 * Marca um registro como synced ou failed no banco.
 */
async function updateSyncStatus(
    table: string,
    id: string | number,
    status: SyncStatus,
    error?: string,
): Promise<void> {
    await supabase
        .from(table)
        .update({ sync_status: status, sync_error: error ?? null } as Record<string, unknown>)
        .eq('id', id);
}

// ─── Funções de Sync por Tabela ────────────────────────────────────────────────

async function syncPersonnelRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const data = [
        record.matricula || '',
        record.name || '',
        record.war_name || '',
        record.graduation || record.rank || '',
        record.type || '',
        record.status || '',
        record.role || '',
        record.cpf || '',
        formatDate(record.birth_date as string),
        record.email || '',
        record.phone || '',
        record.education_level || '',
        record.blood_type || '',
        record.cnh_category || '',
        record.cnh_number || '',
        formatDate(record.cnh_expiry_date as string),
        record.cve_active || '',
        formatDate(record.cve_issue_date as string),
        formatDate(record.cve_expiry_date as string),
        record.weapon_permit ? 'Sim' : 'Não',
        formatDate(record.toxicological_expiry_date as string),
        formatDate(record.last_cadastro_review as string),
    ];

    return callWebhook({
        sheet: 'CadastroEfetivo',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0, // Matrícula na coluna A
        keyValue: record.matricula as string,
        headers: [
            'Matrícula', 'Nome Completo', 'Nome de Guerra', 'Posto/Graduação',
            'Tipo', 'Status', 'Função', 'CPF', 'Nascimento', 'Email', 'Telefone',
            'Instrução', 'Tipo Sanguíneo', 'Cat. CNH', 'Nº CNH', 'Val. CNH',
            'CVE Ativo', 'Emissão CVE', 'Val. CVE', 'Porte Arma', 'Val. Toxicológico',
            'Última Revisão',
        ],
    });
}

async function syncVacationRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const data = [
        String(record.id || ''),
        record.full_name || '',
        record.leave_type || 'ferias',
        formatDate(record.start_date as string),
        formatDate(record.end_date as string),
        String(record.day_count || ''),
        record.status || '',
        record.notes || '',
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'FeriasLicencas',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0, // ID na coluna A
        keyValue: String(record.id),
        headers: ['ID', 'Nome', 'Tipo', 'Início', 'Fim', 'Dias', 'Status', 'Observações', 'Data Registro'],
    });
}

async function syncDisciplinaryRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const data = [
        String(record.id || ''),
        record.personnel_name || '',
        record.record_type || '',
        formatDate(record.date as string),
        record.description || '',
        record.legal_reference || '',
        record.responsible_authority || '',
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'Disciplina',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: String(record.id),
        headers: ['ID', 'Nome', 'Tipo', 'Data', 'Descrição', 'Ref. Legal', 'Autoridade', 'Data Registro'],
    });
}

async function syncCourseRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const data = [
        String(record.id || ''),
        String(record.personnel_id || ''),
        record.course_name || '',
        record.sigla_curso || '',
        record.institution || '',
        String(record.workload_hours || ''),
        formatDate(record.completion_date as string),
        formatDate(record.expiry_date as string),
        record.category || '',
        record.is_retroactive ? 'Sim' : 'Não',
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'CursosEfetivo',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: String(record.id),
        headers: [
            'ID', 'ID Militar', 'Curso', 'Sigla', 'Instituição', 'Carga Horária',
            'Conclusão', 'Validade', 'Categoria', 'Retroativo', 'Data Registro',
        ],
    });
}

async function syncFleetRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const B4_SPREADSHEET_ID = '1p1AZXbEO8TY5lqJB5IZ03Rhycn80_LAkarOzp65rqAQ';
    const type = String(record.type || 'Equipamento');
    const status = record.status === 'active' ? 'Ativo' : record.status === 'maintenance' ? 'Manutenção' : 'Inativo';
    const atividades = Array.isArray(record.atividades) ? (record.atividades as string[]).join(', ') : '';
    const dateStr = new Date().toLocaleDateString('pt-BR');

    let sheetName: string;
    let data: (string | number | null)[];
    let headers: string[];
    let keyValue: string;

    if (type === 'Viatura') {
        sheetName = 'Viatura';
        keyValue = String(record.plate || record.id);
        data = [
            dateStr, record.name || '', record.brand || '', record.plate || '',
            record.renavam || '', record.chassis || '', record.year || '',
            record.oil_type || '', record.location || '',
            record.patrimonio_number || '', record.patrimonio_type || '',
            status, record.details || '', atividades,
        ];
        headers = [
            'Data Cadastro', 'Nome', 'Marca', 'Placa', 'RENAVAM', 'Chassi',
            'Ano', 'Tipo Óleo', 'Localização', 'Nº Patrimônio', 'Tipo Patrimônio',
            'Status', 'Detalhes', 'Atividades',
        ];
    } else if (type === 'Equipamento') {
        sheetName = 'Equipamento';
        keyValue = String(record.patrimonio_number || record.id);
        data = [
            dateStr, record.name || '', record.brand || '',
            record.nf_number || '', record.patrimonio_number || '',
            record.patrimonio_type || '', record.location || '',
            status, record.details || '', atividades,
        ];
        headers = [
            'Data Cadastro', 'Nome', 'Marca', 'Nº NF', 'Nº Patrimônio',
            'Tipo Patrimônio', 'Localização', 'Status', 'Detalhes', 'Atividades',
        ];
    } else {
        sheetName = 'Material';
        keyValue = String(record.patrimonio_number || record.id);
        data = [dateStr, record.name || '', record.details || '', status, record.location || '', atividades];
        headers = ['Data Cadastro', 'Nome', 'Descrição/Detalhes', 'Status', 'Localização', 'Atividades'];
    }

    return callWebhook({
        sheet: sheetName,
        data,
        spreadsheetId: B4_SPREADSHEET_ID,
        keyColumnIndex: headers.indexOf('Placa') >= 0
            ? headers.indexOf('Placa')
            : headers.indexOf('Nº Patrimônio'),
        keyValue,
        headers,
    });
}

async function syncTrainingRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const data = [
        String(record.id || ''),
        formatDate(record.date as string),
        record.time || '',
        record.instructor || '',
        record.location || '',
        record.status || '',
        record.materia_id || '',
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'InstrucoesB3',
        data,
        keyColumnIndex: 0,
        keyValue: String(record.id),
        headers: ['ID', 'Data', 'Hora', 'Instrutor', 'Local', 'Status', 'ID Matéria', 'Data Registro'],
    });
}

// ─── Processamento por Tabela ──────────────────────────────────────────────────

type SyncHandler = (record: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

const SYNC_TABLES: Array<{ table: string; handler: SyncHandler }> = [
    { table: 'personnel', handler: syncPersonnelRecord },
    { table: 'personnel_vacations', handler: syncVacationRecord },
    { table: 'disciplinary_records', handler: syncDisciplinaryRecord },
    { table: 'b1_courses', handler: syncCourseRecord },
    { table: 'fleet', handler: syncFleetRecord },
    { table: 'training_schedule', handler: syncTrainingRecord },
];

async function processPendingForTable(table: string, handler: SyncHandler): Promise<number> {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('sync_status', ['pending', 'failed'])
        .limit(50);

    if (error || !data || data.length === 0) return 0;

    let processed = 0;
    for (const record of data) {
        const result = await handler(record as Record<string, unknown>);
        const newStatus: SyncStatus = result.ok ? 'synced' : 'failed';
        await updateSyncStatus(table, record.id as string | number, newStatus, result.error);
        processed++;
    }
    return processed;
}

// ─── API Pública ───────────────────────────────────────────────────────────────

/**
 * Processa todos os registros pendentes/falhados imediatamente.
 * Pode ser chamado manualmente ou pelo scheduler automático.
 */
export async function syncPendingRecords(): Promise<{ total: number }> {
    let total = 0;
    for (const { table, handler } of SYNC_TABLES) {
        try {
            const count = await processPendingForTable(table, handler);
            if (count > 0) {
                console.log(`✅ [SyncScheduler] ${count} registro(s) processado(s) em "${table}"`);
            }
            total += count;
        } catch (err) {
            console.warn(`⚠️ [SyncScheduler] Erro ao processar "${table}":`, err);
        }
    }
    return { total };
}

/**
 * Marca um registro como pending e dispara sync assíncrono imediato.
 * Usar após qualquer escrita no Supabase.
 */
export async function triggerSync(
    table: string,
    id: string | number,
): Promise<void> {
    await supabase
        .from(table)
        .update({ sync_status: 'pending', sync_error: null } as Record<string, unknown>)
        .eq('id', id);

    // Tenta sincronizar imediatamente sem bloquear
    syncPendingRecords().catch(() => { /* falha silenciosa — será reprocessado depois */ });
}

/**
 * Inicia o scheduler automático em background.
 * Chame uma vez na inicialização da aplicação.
 */
export function startSyncScheduler(): void {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(() => {
        syncPendingRecords().catch(err =>
            console.warn('[SyncScheduler] Ciclo de sync falhou:', err)
        );
    }, SYNC_INTERVAL_MS);
    console.log('[SyncScheduler] Iniciado — intervalo de 5 minutos.');
}

/**
 * Para o scheduler (útil em testes).
 */
export function stopSyncScheduler(): void {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }
}

/**
 * Cria uma nova planilha B3 no Google Drive para uma nova matéria.
 */
export async function createB3Spreadsheet(name: string): Promise<string | null> {
    const result = await callWebhook({
        action: 'createSpreadsheet',
        name,
        folderId: DRIVE_FOLDER_ID || '1g-Aby4GnKZUNRenTpPiXMhJj38LStWHO',
    });
    if (!result.ok) {
        console.warn('[SyncScheduler] Falha ao criar planilha B3:', result.error);
        return null;
    }
    // No-cors não retorna corpo — retornamos null e logamos
    console.log(`✅ [SyncScheduler] Planilha B3 "${name}" criada no Drive.`);
    return null;
}
