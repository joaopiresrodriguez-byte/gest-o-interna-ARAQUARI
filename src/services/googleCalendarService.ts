import { Escala, Personnel } from './types';

// OAUTH2 Flow would typically be handled via a popup or redirect.
// This service provides the logic to sync scales to events.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

export const GoogleCalendarService = {
    syncToGoogleCalendar: async (escalas: Escala[], personnel: Personnel[], accessToken: string) => {
        if (!CLIENT_ID || !CALENDAR_ID) {
            console.warn('Google Calendar credentials not configured.');
            return false;
        }

        try {
            const personnelMap = new Map((personnel || []).map(p => [p.id, p]));

            for (const escala of escalas) {
                if (escala.is_folga) continue;

                const attendees = escala.militares
                    .map(id => personnelMap.get(id))
                    .filter(p => p?.email)
                    .map(p => ({ email: p!.email, displayName: p!.name }));

                // Google Calendar API V3: Use full ISO strings for start/end
                // We assume 24h shift starting at start_time
                const startDateTime = `${escala.data}T${escala.start_time || '07:30'}:00`;
                const endDateObj = new Date(escala.data);
                endDateObj.setDate(endDateObj.getDate() + 1);
                const endDateTime = `${endDateObj.toISOString().split('T')[0]}T${escala.start_time || '07:30'}:00`;

                const event = {
                    summary: `[ESCALA B1] Turma ${escala.turma || escala.equipe}`,
                    description: `Serviço 24x72 - 7ºBBM\nMilitares: ${escala.militares.map(id => personnelMap.get(id)?.name).join(', ')}`,
                    start: {
                        dateTime: startDateTime,
                        timeZone: 'America/Sao_Paulo',
                    },
                    end: {
                        dateTime: endDateTime,
                        timeZone: 'America/Sao_Paulo',
                    },
                    attendees,
                    extendedProperties: {
                        private: {
                            system: 'gestao-araquari',
                            date: escala.data
                        }
                    }
                };

                // Create event
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?sendUpdates=all`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(event),
                });
            }
            return true;
        } catch (error) {
            console.error('Error syncing to Google Calendar:', error);
            return false;
        }
    },

    // Helper to initiate OAuth2 flow (example)
    initAuth: () => {
        const scope = 'https://www.googleapis.com/auth/calendar.events';
        const redirectUri = `${window.location.origin}/auth/callback`;
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
        window.location.href = url;
    }
};
