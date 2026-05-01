/**
 * driveSync.ts — Sincronização assíncrona com Google Drive / Sheets
 *
 * IMPORTANTE: Toda sincronização é fire-and-forget.
 * Uma falha no Drive NUNCA deve bloquear o cadastro local no Supabase.
 *
 * Pré-requisitos:
 *  1. npm install googleapis
 *  2. Configurar variáveis no .env (ver abaixo)
 *  3. Compartilhar planilhas com o e-mail da service account
 *
 * Variáveis de ambiente necessárias:
 *  VITE_GOOGLE_PROJECT_ID
 *  VITE_GOOGLE_PRIVATE_KEY   (substituir \n literais por quebras de linha)
 *  VITE_GOOGLE_CLIENT_EMAIL
 *  VITE_SHEETS_EFETIVO_ID
 *  VITE_SHEETS_ESCALA_ID
 *  VITE_SHEETS_FERIAS_ID
 *  VITE_DRIVE_DOCS_FOLDER_ID
 *  VITE_DRIVE_BOL_FOLDER_ID
 */

// NOTE: googleapis é uma lib Node.js — em produção (Vite/browser) use um
// backend proxy (Edge Function Supabase ou Cloud Function) para chamar a API.
// Este módulo está estruturado para ser usado num ambiente Node ou via proxy.

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API  = 'https://www.googleapis.com/drive/v3/files';

const IDS = {
    efetivo:    import.meta.env.VITE_SHEETS_EFETIVO_ID    as string | undefined,
    escala:     import.meta.env.VITE_SHEETS_ESCALA_ID     as string | undefined,
    ferias:     import.meta.env.VITE_SHEETS_FERIAS_ID     as string | undefined,
    pastaDocumentos: import.meta.env.VITE_DRIVE_DOCS_FOLDER_ID as string | undefined,
    pastaBoletins:   import.meta.env.VITE_DRIVE_BOL_FOLDER_ID  as string | undefined,
};

// Token OAuth2 — deve ser obtido via fluxo de autenticação do servidor.
// Em produção, chame um endpoint seguro que retorne o access_token.
async function getAccessToken(): Promise<string | null> {
    try {
        const endpoint = import.meta.env.VITE_GOOGLE_TOKEN_ENDPOINT as string | undefined;
        if (!endpoint) return null;
        const res = await fetch(endpoint);
        if (!res.ok) return null;
        const json = await res.json();
        return json.access_token ?? null;
    } catch {
        return null;
    }
}

async function appendToSheet(
    spreadsheetId: string | undefined,
    range: string,
    values: (string | number | null)[][]
): Promise<void> {
    if (!spreadsheetId) {
        console.warn('[driveSync] ID da planilha não configurado. Verifique o .env.');
        return;
    }

    const token = await getAccessToken();
    if (!token) {
        console.warn('[driveSync] Sem token OAuth2. Configure VITE_GOOGLE_TOKEN_ENDPOINT.');
        return;
    }

    const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Sheets API error ${res.status}: ${err}`);
    }
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZAR MILITAR (tabela Efetivo)
// ─────────────────────────────────────────────────────────────
export async function syncMilitarDrive(militar: {
    matricula?: string;
    nome_completo?: string;
    name?: string;
    war_name?: string;
    posto_graduacao?: string;
    graduation?: string;
    tipo?: string;
    type?: string;
    status?: string;
    cpf?: string;
    email?: string;
    telefone?: string;
    phone?: string;
}): Promise<void> {
    try {
        await appendToSheet(IDS.efetivo, 'A:J', [[
            militar.matricula || '',
            militar.nome_completo || militar.name || '',
            militar.war_name || '',
            militar.posto_graduacao || militar.graduation || '',
            militar.tipo || militar.type || '',
            militar.status || '',
            militar.cpf || '',
            militar.email || '',
            militar.telefone || militar.phone || '',
            new Date().toLocaleDateString('pt-BR'),
        ]]);
        console.log('✅ [driveSync] Militar sincronizado no Drive');
    } catch (e) {
        // Falha no Drive NÃO bloqueia o cadastro local
        console.warn('⚠️ [driveSync] Falha ao sincronizar militar:', e);
    }
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZAR FÉRIAS / LICENÇA
// ─────────────────────────────────────────────────────────────
export async function syncFeriasDrive(ferias: {
    militar_nome?: string;
    full_name?: string;
    tipo?: string;
    leave_type?: string;
    data_inicio?: string;
    start_date?: string;
    data_fim?: string;
    end_date?: string;
    observacoes?: string;
    notes?: string;
}): Promise<void> {
    try {
        await appendToSheet(IDS.ferias, 'A:F', [[
            ferias.militar_nome || ferias.full_name || '',
            ferias.tipo || ferias.leave_type || '',
            ferias.data_inicio || ferias.start_date || '',
            ferias.data_fim || ferias.end_date || '',
            ferias.observacoes || ferias.notes || '',
            new Date().toLocaleDateString('pt-BR'),
        ]]);
        console.log('✅ [driveSync] Férias sincronizadas no Drive');
    } catch (e) {
        console.warn('⚠️ [driveSync] Falha ao sincronizar férias:', e);
    }
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZAR ESCALA PUBLICADA
// ─────────────────────────────────────────────────────────────
export async function syncEscalaDrive(
    mes: string,
    ano: string,
    dadosEscala: { militar_nome?: string; data_servico?: string; guarnicao?: string; tipo?: string }[]
): Promise<void> {
    try {
        const linhas = dadosEscala.map(item => [
            item.militar_nome || '',
            item.data_servico  || '',
            item.guarnicao     || '',
            item.tipo          || 'serviço',
        ]);

        const sheetName = `${mes}_${ano}`;
        await appendToSheet(IDS.escala, `${sheetName}!A:D`, linhas);
        console.log(`✅ [driveSync] Escala ${sheetName} sincronizada no Drive`);
    } catch (e) {
        console.warn('⚠️ [driveSync] Falha ao sincronizar escala:', e);
    }
}
