/**
 * driveSync.ts — Sincronização B1 com Google Sheets via Apps Script Webhook
 *
 * Usa o mesmo padrão do GoogleSheetsService (VITE_GOOGLE_SHEETS_WEBHOOK_URL).
 * O webhook é um Google Apps Script publicado como Web App que recebe
 * { sheet, data } e faz append na aba correspondente.
 *
 * IMPORTANTE: toda sincronização é fire-and-forget.
 * Uma falha NUNCA bloqueia o cadastro local no Supabase.
 *
 * Variáveis de ambiente (adicionar no .env):
 *   VITE_GOOGLE_SHEETS_WEBHOOK_URL  ← já existente no projeto
 *   VITE_SHEETS_EFETIVO_ABA         ← nome da aba (ex: CadastroEfetivo)
 */

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL as string | undefined;
const ABA_EFETIVO = (import.meta.env.VITE_SHEETS_EFETIVO_ABA as string | undefined) || 'CadastroEfetivo';
const ABA_FERIAS  = (import.meta.env.VITE_SHEETS_FERIAS_ABA  as string | undefined) || 'FeriasLicencas';
const ABA_ESCALA  = (import.meta.env.VITE_SHEETS_ESCALA_ABA  as string | undefined) || 'EscalaMensal';

const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch { return dateStr; }
};

async function sendToSheets(sheet: string, data: (string | number | null)[]): Promise<boolean> {
    if (!WEBHOOK_URL) {
        console.warn('[driveSync] VITE_GOOGLE_SHEETS_WEBHOOK_URL não configurado. Sync ignorado.');
        return false;
    }
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, data }),
            mode: 'no-cors', // Google Apps Script exige no-cors
        });
        console.log(`✅ [driveSync] Dados enviados para aba "${sheet}"`);
        return true;
    } catch (error) {
        console.warn(`⚠️ [driveSync] Falha ao enviar para "${sheet}":`, error);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR MILITAR → aba CadastroEfetivo
// Colunas: Matrícula | Nome Completo | Nome de Guerra | Posto/Graduação |
//          Tipo | Status | CPF | Email | Telefone | Data Cadastro
// ─────────────────────────────────────────────────────────────────────────────
export async function syncMilitarDrive(militar: {
    id?: number;
    name?: string;
    war_name?: string;
    graduation?: string;
    rank?: string;
    type?: string;
    status?: string;
    cpf?: string;
    email?: string;
    phone?: string;
    [key: string]: unknown;
}): Promise<void> {
    try {
        await sendToSheets(ABA_EFETIVO, [
            militar.id?.toString()              || '',
            militar.name                        || '',
            militar.war_name                    || '',
            militar.graduation || militar.rank  || '',
            militar.type                        || '',
            militar.status                      || 'Ativo',
            militar.cpf                         || '',
            militar.email                       || '',
            militar.phone                       || '',
            new Date().toLocaleDateString('pt-BR'),
        ]);
    } catch (e) {
        console.warn('⚠️ [driveSync] syncMilitarDrive falhou (não bloqueia):', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR FÉRIAS/LICENÇA → aba FeriasLicencas
// Colunas: Nome | Tipo | Início | Fim | Dias | Observações | Data Registro
// ─────────────────────────────────────────────────────────────────────────────
export async function syncFeriasDrive(ferias: {
    full_name?: string;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    day_count?: number;
    notes?: string;
}): Promise<void> {
    try {
        await sendToSheets(ABA_FERIAS, [
            ferias.full_name                  || '',
            ferias.leave_type                 || 'ferias',
            formatDate(ferias.start_date),
            formatDate(ferias.end_date),
            ferias.day_count?.toString()      || '',
            ferias.notes                      || '',
            new Date().toLocaleDateString('pt-BR'),
        ]);
    } catch (e) {
        console.warn('⚠️ [driveSync] syncFeriasDrive falhou (não bloqueia):', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR ESCALA PUBLICADA → aba EscalaMensal
// Colunas: Nome Militar | Data Serviço | Guarnição | Tipo | Ref. Mês
// ─────────────────────────────────────────────────────────────────────────────
export async function syncEscalaDrive(
    mes: string,
    ano: string,
    dadosEscala: { militar_nome?: string; data_servico?: string; guarnicao?: string; tipo?: string }[]
): Promise<void> {
    const refMes = `${mes}/${ano}`;
    try {
        for (const item of dadosEscala) {
            await sendToSheets(ABA_ESCALA, [
                item.militar_nome || '',
                formatDate(item.data_servico),
                item.guarnicao    || '',
                item.tipo         || 'serviço',
                refMes,
            ]);
        }
        console.log(`✅ [driveSync] Escala ${refMes} sincronizada (${dadosEscala.length} linhas)`);
    } catch (e) {
        console.warn('⚠️ [driveSync] syncEscalaDrive falhou (não bloqueia):', e);
    }
}
