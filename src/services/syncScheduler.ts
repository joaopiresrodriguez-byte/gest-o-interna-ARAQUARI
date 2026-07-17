/**
 * syncScheduler.ts — Gerenciador de Sincronização em Segundo Plano
 *
 * Processa registros com sync_status = 'pending' ou 'failed' em todas as
 * tabelas sincronizadas, disparando re-tentativas assíncronas através da
 * Edge Function `sync-sheets` (Supabase).
 *
 * FLUXO:
 *   1. Dado salvo no Supabase com sync_status = 'pending'
 *   2. SyncScheduler chama a Edge Function sync-sheets
 *   3. Sucesso → sync_status = 'synced'
 *   4. Falha   → sync_status = 'failed', sync_error = mensagem
 *   5. Na próxima tentativa, registros 'failed' também são reprocessados
 *
 * SEGURANÇA: credenciais Google ficam nos Supabase Secrets — nunca no frontend.
 */

import { supabase } from './supabase';

// ─── Configuração ──────────────────────────────────────────────────────────────

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// URL da Edge Function de sincronização com Sheets
const SYNC_SHEETS_URL  = `${SUPABASE_URL}/functions/v1/sync-sheets`;
// URL da Edge Function de sincronização com Google Calendar
const SYNC_CALENDAR_URL = `${SUPABASE_URL}/functions/v1/sync-calendar`;

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// ─── Tipos internos ────────────────────────────────────────────────────────────

type SyncStatus = 'pending' | 'synced' | 'failed';

export interface CalendarEventPayload {
    action: 'upsert' | 'delete' | 'clear_month';
    mes?: number;
    ano?: number;
    escalas?: unknown[];
    personnel?: unknown[];
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

async function callEdgeFunction(
    url: string,
    payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { ok: false, error: `HTTP ${res.status}: ${text}` };
        }
        const json = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
        if (json && json.ok === false) {
            return { ok: false, error: json.error || 'Erro interno na Edge Function.' };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

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

// ─── Processamento por Tabela ──────────────────────────────────────────────────

const SYNC_TABLES = [
    'personnel',
    'personnel_vacations',
    'disciplinary_records',
    'b1_courses',
    'fleet',
    'training_schedule',
] as const;

async function processPendingForTable(table: string): Promise<number> {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('sync_status', ['pending', 'failed'])
        .limit(50);

    if (error || !data || data.length === 0) return 0;

    let processed = 0;
    for (const record of data) {
        const result = await callEdgeFunction(SYNC_SHEETS_URL, { table, record });
        const newStatus: SyncStatus = result.ok ? 'synced' : 'failed';
        await updateSyncStatus(table, record.id as string | number, newStatus, result.error);
        processed++;
    }
    return processed;
}

// ─── API Pública — Sheets ──────────────────────────────────────────────────────

/**
 * Processa todos os registros pendentes/falhados.
 */
export async function syncPendingRecords(): Promise<{ total: number }> {
    let total = 0;
    for (const table of SYNC_TABLES) {
        try {
            const count = await processPendingForTable(table);
            if (count > 0) {
                console.log(`✅ [SyncScheduler] ${count} registro(s) em "${table}"`);
            }
            total += count;
        } catch (err) {
            console.warn(`⚠️ [SyncScheduler] Erro ao processar "${table}":`, err);
        }
    }
    return { total };
}

/**
 * Marca um registro como pending e dispara sync imediato (fire-and-forget).
 */
export async function triggerSync(table: string, id: string | number): Promise<void> {
    await supabase
        .from(table)
        .update({ sync_status: 'pending', sync_error: null } as Record<string, unknown>)
        .eq('id', id);

    syncPendingRecords().catch(() => { /* reprocessado no próximo ciclo */ });
}

/**
 * Sinaliza à Edge Function para deletar uma linha da planilha.
 */
export async function deleteFromSheets(
    table: string,
    keyValue: string,
): Promise<void> {
    const result = await callEdgeFunction(SYNC_SHEETS_URL, {
        action: 'delete',
        table,
        keyValue,
    });
    if (!result.ok) {
        console.warn(`[SyncScheduler] Falha ao deletar "${keyValue}" (${table}):`, result.error);
    }
}

// ─── API Pública — Calendar ────────────────────────────────────────────────────

/**
 * Envia eventos de escala para o Google Calendar via Edge Function.
 * Não requer OAuth do usuário — usa Service Account na Edge Function.
 */
export async function syncCalendar(payload: CalendarEventPayload): Promise<{ ok: boolean; error?: string }> {
    return callEdgeFunction(SYNC_CALENDAR_URL, payload as unknown as Record<string, unknown>);
}

// ─── Scheduler Automático ─────────────────────────────────────────────────────

export function startSyncScheduler(): void {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(() => {
        syncPendingRecords().catch(err =>
            console.warn('[SyncScheduler] Ciclo de sync falhou:', err)
        );
    }, SYNC_INTERVAL_MS);
    console.log('[SyncScheduler] Iniciado — intervalo de 5 minutos.');
}

export function stopSyncScheduler(): void {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }
}
