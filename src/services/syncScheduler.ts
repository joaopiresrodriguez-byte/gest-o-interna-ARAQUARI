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
    action?: 'sync' | 'createSpreadsheet' | 'delete';
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
        const fetchOptions: { method: string; headers: Record<string, string>; body: string } = {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
        };

        const response = await fetch(WEBHOOK_URL, fetchOptions);

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
    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    const data: (string | null)[] = [
        str(record.matricula),
        str(record.name),
        str(record.war_name),
        str(record.graduation || record.rank),
        str(record.type),
        str(record.status),
        str(record.role),
        str(record.cpf),
        formatDate(record.birth_date as string),
        str(record.email),
        str(record.phone),
        str(record.education_level),
        str(record.blood_type),
        str(record.cnh_category),
        str(record.cnh_number),
        formatDate(record.cnh_expiry_date as string),
        str(record.cve_active),
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
        keyColumnIndex: 0,
        keyValue: str(record.matricula),
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
    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    const data: (string | null)[] = [
        str(record.id),
        str(record.full_name),
        str(record.leave_type) || 'ferias',
        formatDate(record.start_date as string),
        formatDate(record.end_date as string),
        str(record.day_count),
        str(record.status),
        str(record.notes),
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'FeriasLicencas',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: str(record.id),
        headers: ['ID', 'Nome', 'Tipo', 'Início', 'Fim', 'Dias', 'Status', 'Observações', 'Data Registro'],
    });
}

async function syncDisciplinaryRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    const data: (string | null)[] = [
        str(record.id),
        str(record.personnel_name),
        str(record.record_type),
        formatDate(record.date as string),
        str(record.description),
        str(record.legal_reference),
        str(record.responsible_authority),
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'Disciplina',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: str(record.id),
        headers: ['ID', 'Nome', 'Tipo', 'Data', 'Descrição', 'Ref. Legal', 'Autoridade', 'Data Registro'],
    });
}

async function syncCourseRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    const data: (string | null)[] = [
        str(record.id),
        str(record.personnel_id),
        str(record.course_name),
        str(record.sigla_curso),
        str(record.institution),
        str(record.workload_hours),
        formatDate(record.completion_date as string),
        formatDate(record.expiry_date as string),
        str(record.category),
        record.is_retroactive ? 'Sim' : 'Não',
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'CursosEfetivo',
        data,
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: str(record.id),
        headers: [
            'ID', 'ID Militar', 'Curso', 'Sigla', 'Instituição', 'Carga Horária',
            'Conclusão', 'Validade', 'Categoria', 'Retroativo', 'Data Registro',
        ],
    });
}

async function syncFleetRecord(record: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const B4_SPREADSHEET_ID = SHEETS_EFETIVO_ID || '13U9RCucWBBO2eovZtWX3-CxjZ6coEMsxEh1qYsFiKRw';
    const type = String(record.type || 'Equipamento');
    const status = record.status === 'active' ? 'Ativo' : record.status === 'maintenance' ? 'Manutenção' : 'Inativo';
    const atividades = Array.isArray(record.atividades) ? (record.atividades as string[]).join(', ') : '';
    const dateStr = new Date().toLocaleDateString('pt-BR');

    let sheetName: string;
    let data: (string | number | null)[];
    let headers: string[];
    let keyValue: string;

    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    if (type === 'Viatura') {
        sheetName = 'Viatura';
        keyValue = str(record.plate || record.id);
        data = [
            dateStr, str(record.name), str(record.brand), str(record.plate),
            str(record.renavam), str(record.chassis), str(record.year),
            str(record.oil_type), str(record.location),
            str(record.patrimonio_number), str(record.patrimonio_type),
            status, str(record.details), atividades,
        ];
        headers = [
            'Data Cadastro', 'Nome', 'Marca', 'Placa', 'RENAVAM', 'Chassi',
            'Ano', 'Tipo Óleo', 'Localização', 'Nº Patrimônio', 'Tipo Patrimônio',
            'Status', 'Detalhes', 'Atividades',
        ];
    } else if (type === 'Equipamento') {
        sheetName = 'Equipamento';
        keyValue = str(record.patrimonio_number || record.id);
        data = [
            dateStr, str(record.name), str(record.brand),
            str(record.nf_number), str(record.patrimonio_number),
            str(record.patrimonio_type), str(record.location),
            status, str(record.details), atividades,
        ];
        headers = [
            'Data Cadastro', 'Nome', 'Marca', 'Nº NF', 'Nº Patrimônio',
            'Tipo Patrimônio', 'Localização', 'Status', 'Detalhes', 'Atividades',
        ];
    } else {
        sheetName = 'Material';
        keyValue = str(record.patrimonio_number || record.id);
        data = [dateStr, str(record.name), str(record.details), status, str(record.location), atividades];
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
    const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '');
    const data: (string | null)[] = [
        str(record.id),
        formatDate(record.date as string),
        str(record.time),
        str(record.instructor),
        str(record.location),
        str(record.status),
        str(record.materia_id),
        new Date().toLocaleDateString('pt-BR'),
    ];

    return callWebhook({
        sheet: 'InstrucoesB3',
        data,
        keyColumnIndex: 0,
        keyValue: str(record.id),
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
 * Remove uma linha da planilha Google Sheets pelo valor da chave.
 * Usar na exclusão de um registro do Supabase para manter paridade.
 * @param sheet - Nome da aba na planilha (ex: 'CadastroEfetivo')
 * @param keyColumnIndex - Índice (0-based) da coluna chave
 * @param keyValue - Valor da chave a procurar e remover
 * @param spreadsheetId - ID da planilha (opcional, usa a padrão se omitido)
 */
export async function deleteFromSheets(
    sheet: string,
    keyColumnIndex: number,
    keyValue: string,
    spreadsheetId?: string,
): Promise<void> {
    const result = await callWebhook({
        action: 'delete',
        sheet,
        keyColumnIndex,
        keyValue,
        spreadsheetId,
    });
    if (!result.ok) {
        console.warn(`[SyncScheduler] Falha ao deletar "${keyValue}" da aba "${sheet}":`, result.error);
    } else {
        console.log(`✅ [SyncScheduler] Linha "${keyValue}" removida da aba "${sheet}".`);
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

