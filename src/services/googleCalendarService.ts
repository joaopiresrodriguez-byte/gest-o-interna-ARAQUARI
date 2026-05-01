import { Escala, Personnel } from './types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

export const GoogleCalendarService = {
    syncToGoogleCalendar: async (escalas: Escala[], personnel: Personnel[], accessToken: string) => {
        if (!CLIENT_ID || !CALENDAR_ID) {
            throw new Error('Configurações do Google Calendar (ID do Cliente ou ID da Agenda) não encontradas no .env');
        }

        const personnelMap = new Map((personnel || []).map(p => [p.id, p]));

        // 1. First, we might want to list and remove existing [ESCALA B1] events to avoid duplicates
        // But for simplicity in this version, we will just add them.
        // A better approach is to tag them and delete by tag.

        let count = 0;
        for (const escala of escalas) {
            if (escala.is_folga) continue;

            const attendees = escala.militares
                .map(id => personnelMap.get(id))
                .filter(p => p?.email)
                .map(p => ({ email: p!.email, displayName: p!.name }));

            const startDateTime = `${escala.data}T${escala.start_time || '07:30'}:00-03:00`;
            
            const endDateObj = new Date(escala.data);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const endDateStr = endDateObj.toISOString().split('T')[0];
            const endDateTime = `${endDateStr}T${escala.start_time || '07:30'}:00-03:00`;

            const event = {
                summary: `Serviço: Turma ${escala.turma || escala.equipe}`,
                location: '7º Batalhão de Bombeiros Militares - Araquari/SC',
                description: `Escala Publicada\n\nEquipe: ${escala.equipe}\nMilitares:\n${escala.militares.map(id => {
                    const p = personnelMap.get(id);
                    return p ? `- ${p.rank} ${p.war_name}` : '';
                }).join('\n')}`,
                start: {
                    dateTime: startDateTime,
                    timeZone: 'America/Sao_Paulo',
                },
                end: {
                    dateTime: endDateTime,
                    timeZone: 'America/Sao_Paulo',
                },
                attendees,
                colorId: escala.turma === 'A' ? '1' : (escala.turma === 'B' ? '2' : (escala.turma === 'C' ? '5' : '6')),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 60 },
                        { method: 'email', minutes: 1440 },
                    ],
                },
            };

            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            });

            if (response.ok) count++;
        }

        return count;
    },

    initAuth: () => {
        if (!CLIENT_ID) {
            alert('VITE_GOOGLE_CLIENT_ID não configurado no .env');
            return;
        }
        const scope = 'https://www.googleapis.com/auth/calendar.events';
        const redirectUri = window.location.origin + window.location.pathname;
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
        window.location.href = url;
    }
};
