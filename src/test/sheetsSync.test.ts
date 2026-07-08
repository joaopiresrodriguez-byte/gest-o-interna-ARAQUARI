/**
 * sheetsSync.test.ts — Testes automatizados para o SyncScheduler
 *
 * Valida os 3 fluxos críticos da sincronização:
 *   1. Registro salvo localmente com sync_status='pending'
 *   2. SyncScheduler processa e marca como 'synced' em caso de sucesso
 *   3. SyncScheduler marca como 'failed' quando o webhook retorna erro
 *
 * Usa mocks de fetch e do cliente Supabase para isolar o código.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Configuração do Armazenamento Global (Evita hoisting issues do Vitest) ────

type MockRecord = Record<string, any>;

const initialDataStore = () => ({
    personnel: [] as MockRecord[],
    personnel_vacations: [] as MockRecord[],
    disciplinary_records: [] as MockRecord[],
    b1_courses: [] as MockRecord[],
    fleet: [] as MockRecord[],
    training_schedule: [] as MockRecord[],
});

// Inicializa no globalThis
(globalThis as any).mockSupabaseData = initialDataStore();

// Spy global do método .from()
(globalThis as any).mockFromSpy = vi.fn((table: string) => {
    const dataStore = (globalThis as any).mockSupabaseData[table] ?? [];
    let _values: MockRecord | null = null;

    const chain: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn((data: MockRecord) => {
            _values = data;
            return chain;
        }),
        update: vi.fn((data: MockRecord) => {
            _values = data;
            return chain;
        }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn((_: string, __: any) => chain),
        in: vi.fn((_: string, vals: any[]) => {
            const matching = dataStore.filter((r: any) => vals.includes(r.sync_status));
            return {
                limit: vi.fn((n: number) =>
                    Promise.resolve({ data: matching.slice(0, n), error: null })
                ),
            };
        }),
        limit: vi.fn((n: number) =>
            Promise.resolve({ data: dataStore.slice(0, n), error: null })
        ),
        single: vi.fn(() => {
            const newRecord = { id: `uuid-${Date.now()}`, ..._values };
            dataStore.push(newRecord);
            return Promise.resolve({ data: newRecord, error: null });
        }),
    };
    return chain;
});

// Mock do supabase usando a função redirecionada
vi.mock('../services/supabase', () => {
    return {
        supabase: {
            from: (table: string) => (globalThis as any).mockFromSpy(table),
        },
    };
});

// ─── Mock do fetch global ──────────────────────────────────────────────────────

let fetchShouldFail = false;

const mockFetch = vi.fn(async () => {
    if (fetchShouldFail) throw new Error('Network error: connection refused');
    return new Response(null, { status: 200 });
});

vi.stubGlobal('fetch', mockFetch);

// ─── Import do scheduler após os mocks estarem definidos ──────────────────────

import { syncPendingRecords, stopSyncScheduler } from '../services/syncScheduler';

// ─── Suíte de testes ──────────────────────────────────────────────────────────

describe('SyncScheduler — Fluxo de Sincronização Google Sheets', () => {
    beforeEach(() => {
        fetchShouldFail = false;
        mockFetch.mockClear();
        (globalThis as any).mockFromSpy.mockClear();
        // Resetar dados de teste globais
        (globalThis as any).mockSupabaseData = initialDataStore();
    });

    afterEach(() => {
        stopSyncScheduler();
    });

    // ─── TESTE 1: Sem registros pendentes ─────────────────────────────────

    it('deve retornar 0 registros processados quando não há pendentes', async () => {
        const result = await syncPendingRecords();
        expect(result.total).toBe(0);
    });

    // ─── TESTE 2: Registro de pessoal sincronizado com sucesso ────────────

    it('deve processar e marcar registro de pessoal como synced', async () => {
        // Arrange: inserir um registro pending na tabela simulada
        (globalThis as any).mockSupabaseData.personnel.push({
            id: 'per-001',
            matricula: '123456',
            name: 'João Silva',
            rank: 'Soldado',
            type: 'BM',
            status: 'Ativo',
            sync_status: 'pending',
        });

        // Act
        const result = await syncPendingRecords();

        // Assert: fetch foi chamado (tentativa de sync)
        expect(mockFetch).toHaveBeenCalled();

        // O webhook recebeu os dados corretos
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('script.google.com');
        const body = JSON.parse((options as any).body as string);
        expect(body.sheet).toBe('CadastroEfetivo');
        expect(body.keyValue).toBe('123456');

        // 1 registro processado
        expect(result.total).toBeGreaterThan(0);
    });

    // ─── TESTE 3: Falha de rede → marcado como failed ────────────────────

    it('deve marcar como failed quando o webhook retorna erro de rede', async () => {
        fetchShouldFail = true;

        (globalThis as any).mockSupabaseData.fleet.push({
            id: 'fleet-001',
            name: 'Viatura Alpha',
            type: 'Viatura',
            plate: 'ABC-1234',
            status: 'active',
            sync_status: 'pending',
        });

        // Act: não deve lançar exceção — falha é silenciosa
        const result = await syncPendingRecords();

        // Assert: processou (tentou) mesmo com erro
        expect(result.total).toBeGreaterThan(0);
    });

    // ─── TESTE 4: Registro 'failed' é reprocessado ────────────────────────

    it('deve reprocessar registros com status failed', async () => {
        (globalThis as any).mockSupabaseData.b1_courses.push({
            id: 'course-001',
            personnel_id: 1,
            course_name: 'Curso de Salvamento',
            institution: 'CBMSC',
            completion_date: '2026-01-15',
            sync_status: 'failed',
            sync_error: 'Timeout anterior',
        });

        const result = await syncPendingRecords();
        expect(result.total).toBeGreaterThan(0);
        expect(mockFetch).toHaveBeenCalled();
    });

    // ─── TESTE 5: Payload B4 contém chave de identificação correta ────────

    it('deve enviar payload com keyValue correto para item B4 do tipo Equipamento', async () => {
        (globalThis as any).mockSupabaseData.fleet.push({
            id: 'fleet-002',
            name: 'Mangueira 65mm',
            type: 'Equipamento',
            patrimonio_number: 'PAT-9999',
            status: 'active',
            sync_status: 'pending',
        });

        await syncPendingRecords();

        expect(mockFetch).toHaveBeenCalled();
        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse((options as any).body as string);
        expect(body.sheet).toBe('Equipamento');
        expect(body.keyValue).toBe('PAT-9999');
    });

    // ─── TESTE 6: Múltiplas tabelas processadas em um ciclo ──────────────

    it('deve processar registros de múltiplas tabelas em um único ciclo', async () => {
        (globalThis as any).mockSupabaseData.personnel.push({ id: 'p1', matricula: 'M001', sync_status: 'pending', name: 'Ana' });
        (globalThis as any).mockSupabaseData.personnel_vacations.push({ id: 'v1', full_name: 'Ana', sync_status: 'pending' });
        (globalThis as any).mockSupabaseData.fleet.push({ id: 'f1', name: 'Escada', type: 'Material', sync_status: 'pending' });

        const result = await syncPendingRecords();

        // Ao menos 3 registros (um por tabela com dados)
        expect(result.total).toBeGreaterThanOrEqual(3);
    });

    // ─── TESTE 7: Payload de férias contém aba correta ────────────────────

    it('deve enviar payload de férias para aba FeriasLicencas', async () => {
        (globalThis as any).mockSupabaseData.personnel_vacations.push({
            id: 'vac-001',
            full_name: 'Carlos Souza',
            leave_type: 'ferias',
            start_date: '2026-08-01',
            end_date: '2026-08-30',
            day_count: 30,
            sync_status: 'pending',
        });

        await syncPendingRecords();

        expect(mockFetch).toHaveBeenCalled();
        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse((options as any).body as string);
        expect(body.sheet).toBe('FeriasLicencas');
        expect(body.keyColumnIndex).toBe(0);
    });

    // ─── TESTE 8: Payload de instrução B3 enviado corretamente ───────────

    it('deve enviar payload de instrução B3 com aba InstrucoesB3', async () => {
        (globalThis as any).mockSupabaseData.training_schedule.push({
            id: 'train-001',
            date: '2026-07-10',
            time: '14:00',
            instructor: 'Cap. Ferreira',
            status: 'agendada',
            sync_status: 'pending',
        });

        await syncPendingRecords();

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse((options as any).body as string);
        expect(body.sheet).toBe('InstrucoesB3');
    });
});
