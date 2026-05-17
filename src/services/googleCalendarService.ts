import { Escala, Personnel } from './types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const CORES_GUARNICAO: Record<string, string> = {
    A: '9',  // Blueberry
    B: '10', // Basil (green)
    C: '6',  // Tangerine (orange)
    D: '3',  // Grape (purple)
};

const NOMES_MESES = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ─── Token Management ────────────────────────────────────────────────────────

const TOKEN_KEY = 'gcal_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';

function getStoredToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > Number(expiry)) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        return null;
    }
    return token;
}

function storeToken(token: string, expiresIn: number): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function calendarFetch(
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<Response> {
    const res = await fetch(`${CALENDAR_API}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    return res;
}

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const GoogleCalendarService = {
    /**
     * Starts Google OAuth2 implicit flow.
     * Redirects the browser → Google consent → comes back with #access_token
     */
    initAuth: () => {
        if (!CLIENT_ID) {
            alert('VITE_GOOGLE_CLIENT_ID não configurado no .env');
            return;
        }
        const scope = 'https://www.googleapis.com/auth/calendar.events';
        const redirectUri = window.location.origin + '/';
        const url =
            `https://accounts.google.com/o/oauth2/v2/auth` +
            `?client_id=${CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=token` +
            `&scope=${encodeURIComponent(scope)}` +
            `&prompt=consent`;
        window.location.href = url;
    },

    /**
     * Extracts access_token from URL hash after OAuth redirect.
     * Returns the token or null.
     */
    extractTokenFromHash: (): string | null => {
        const hash = window.location.hash;
        if (!hash || !hash.includes('access_token')) return null;

        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const expiresIn = Number(params.get('expires_in') || 3600);

        if (token) {
            storeToken(token, expiresIn);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        return token;
    },

    /**
     * Returns a valid token if available (from URL hash or localStorage).
     */
    getToken: (): string | null => {
        // First check URL hash (fresh redirect)
        const hashToken = GoogleCalendarService.extractTokenFromHash();
        if (hashToken) return hashToken;
        // Then check stored
        return getStoredToken();
    },

    /**
     * Legacy: sync escalas array directly (backward compat).
     */
    syncToGoogleCalendar: async (
        escalas: Escala[],
        personnel: Personnel[],
        accessToken: string,
    ): Promise<number> => {
        if (!CLIENT_ID || !CALENDAR_ID) {
            throw new Error('Configurações do Google Calendar não encontradas no .env');
        }

        const personnelMap = new Map((personnel || []).map(p => [p.id, p]));
        let count = 0;

        for (const escala of escalas) {
            if (escala.is_folga) continue;

            const attendees = escala.militares
                .map(id => personnelMap.get(id))
                .filter(p => p?.email && p.email.includes('@'))
                .map(p => ({ email: p!.email!, displayName: `${p!.graduation || p!.rank} ${p!.war_name || p!.name}` }));

            const startDateTime = `${escala.data}T${escala.start_time || '07:30'}:00-03:00`;
            const endDateObj = new Date(escala.data);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const endDateStr = endDateObj.toISOString().split('T')[0];
            const endDateTime = `${endDateStr}T${escala.start_time || '07:30'}:00-03:00`;

            const membersList = escala.militares.map(id => {
                const p = personnelMap.get(id);
                return p ? `• ${p.graduation || p.rank} ${p.war_name || p.name}` : '';
            }).filter(Boolean).join('\n');

            const turmaLetter = escala.turma || escala.equipe?.replace('Turma ', '') || '?';

            const event = {
                summary: `🔥 Guarnição ${turmaLetter} — De Serviço`,
                location: '7º Batalhão de Bombeiros Militares - Araquari/SC',
                description:
                    `ESCALA DE SERVIÇO\n\n` +
                    `Guarnição ${turmaLetter}\n\n` +
                    `Militares de Serviço:\n${membersList}\n\n` +
                    `Horário: ${escala.start_time || '07:30'} às ${escala.end_time || '07:30'} (24 horas)\n` +
                    `📋 Sistema de Gestão — B1 CBMSC Araquari`,
                start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
                attendees,
                colorId: CORES_GUARNICAO[turmaLetter] || '1',
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 60 },
                        { method: 'email', minutes: 720 },
                    ],
                },
                transparency: 'opaque',
                visibility: 'default',
            };

            const response = await calendarFetch(
                `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=all`,
                accessToken,
                { method: 'POST', body: JSON.stringify(event) },
            );

            if (response.ok) count++;
            await delay(200);
        }

        return count;
    },

    /**
     * Removes all "Guarnição" events from a specific month.
     */
    limparEscalaCalendar: async (
        mes: number,
        ano: number,
        accessToken: string,
    ): Promise<number> => {
        if (!CALENDAR_ID) return 0;

        const timeMin = new Date(ano, mes - 1, 1).toISOString();
        const timeMax = new Date(ano, mes, 1).toISOString();

        const listRes = await calendarFetch(
            `/calendars/${encodeURIComponent(CALENDAR_ID)}/events` +
            `?timeMin=${timeMin}&timeMax=${timeMax}&q=${encodeURIComponent('Guarnição')}&maxResults=250&singleEvents=true`,
            accessToken,
        );

        if (!listRes.ok) {
            console.warn('⚠️ Falha ao listar eventos para limpeza:', listRes.statusText);
            return 0;
        }

        const data = await listRes.json();
        const items = data.items || [];
        let deleted = 0;

        for (const evento of items) {
            const delRes = await calendarFetch(
                `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${evento.id}?sendUpdates=all`,
                accessToken,
                { method: 'DELETE' },
            );
            if (delRes.ok || delRes.status === 204) deleted++;
            await delay(150);
        }

        console.log(`🗑️ ${deleted}/${items.length} eventos removidos de ${NOMES_MESES[mes]}/${ano}`);
        return deleted;
    },

    /**
     * Publishes scale events for a single month with attendee invites.
     */
    publicarEscalaCalendar: async (
        mes: number,
        ano: number,
        escalas: Escala[],
        personnel: Personnel[],
        accessToken: string,
    ): Promise<{ sucesso: number; erros: number }> => {
        if (!CALENDAR_ID) throw new Error('VITE_GOOGLE_CALENDAR_ID não configurado');

        const personnelMap = new Map((personnel || []).map(p => [p.id, p]));
        const monthStr = `${ano}-${String(mes).padStart(2, '0')}`;
        const monthEscalas = escalas.filter(e => e.data.startsWith(monthStr) && !e.is_folga);

        let sucesso = 0;
        let erros = 0;

        for (const escala of monthEscalas) {
            const turmaLetter = escala.turma || escala.equipe?.replace('Turma ', '') || '?';

            const attendees = escala.militares
                .map(id => personnelMap.get(id))
                .filter(p => p?.email && p.email.includes('@'))
                .map(p => ({
                    email: p!.email!,
                    displayName: `${p!.graduation || p!.rank} ${p!.war_name || p!.name}`,
                }));

            const membersList = escala.militares.map(id => {
                const p = personnelMap.get(id);
                return p ? `• ${p.graduation || p.rank} ${p.war_name || p.name}` : '';
            }).filter(Boolean).join('\n');

            const startDateTime = `${escala.data}T${escala.start_time || '07:30'}:00-03:00`;
            const endDateObj = new Date(escala.data);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const endDateTime = `${endDateObj.toISOString().split('T')[0]}T${escala.start_time || '07:30'}:00-03:00`;

            const event = {
                summary: `🔥 Guarnição ${turmaLetter} — De Serviço`,
                location: '7º Batalhão de Bombeiros Militares - Araquari/SC',
                description:
                    `ESCALA DE SERVIÇO — ${NOMES_MESES[mes].toUpperCase()}/${ano}\n\n` +
                    `Guarnição ${turmaLetter}\n\n` +
                    `Militares de Serviço:\n${membersList}\n\n` +
                    `Horário: ${escala.start_time || '07:30'} às ${escala.end_time || '07:30'} (24 horas)\n` +
                    `📋 Sistema de Gestão — B1 CBMSC Araquari`,
                start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
                attendees,
                colorId: CORES_GUARNICAO[turmaLetter] || '1',
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 60 },
                        { method: 'email', minutes: 720 },
                    ],
                },
                transparency: 'opaque',
                visibility: 'default',
            };

            try {
                const res = await calendarFetch(
                    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=all`,
                    accessToken,
                    { method: 'POST', body: JSON.stringify(event) },
                );
                if (res.ok) sucesso++;
                else erros++;
            } catch {
                erros++;
            }
            await delay(200);
        }

        console.log(`✅ Google Calendar ${NOMES_MESES[mes]}/${ano}: ${sucesso} criados, ${erros} erros`);
        return { sucesso, erros };
    },

    /**
     * Publishes scale events for multiple months (clean + create).
     * Calls onProgress for each month processed.
     */
    publicarMultiplosMeses: async (
        meses: { mes: number; ano: number }[],
        escalas: Escala[],
        personnel: Personnel[],
        accessToken: string,
        onProgress?: (current: number, total: number, label: string) => void,
    ): Promise<{ totalSucesso: number; totalErros: number }> => {
        let totalSucesso = 0;
        let totalErros = 0;

        for (let i = 0; i < meses.length; i++) {
            const { mes, ano } = meses[i];
            const label = `${NOMES_MESES[mes]}/${ano}`;
            onProgress?.(i + 1, meses.length, label);

            // Clean old events first
            await GoogleCalendarService.limparEscalaCalendar(mes, ano, accessToken);
            await delay(300);

            // Create new events
            const result = await GoogleCalendarService.publicarEscalaCalendar(
                mes, ano, escalas, personnel, accessToken,
            );
            totalSucesso += result.sucesso;
            totalErros += result.erros;
        }

        return { totalSucesso, totalErros };
    },
};
