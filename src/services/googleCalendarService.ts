import { Escala } from './types';

// OAUTH2 Flow would typically be handled via a popup or redirect.
// This service provides the logic to sync scales to events.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

export const GoogleCalendarService = {
    syncToGoogleCalendar: async (escalas: Escala[], accessToken: string) => {
        if (!CLIENT_ID || !CALENDAR_ID) {
            console.warn('Google Calendar credentials not configured.');
            return false;
        }

        try {
            // For each day in the scale, create or update a calendar event
            for (const escala of escalas) {
                if (escala.is_folga) continue;

                const event = {
                    summary: `[ESCALA BM] Equipe ${escala.equipe}`,
                    description: `Pessoal escalado: ${escala.militares.length} militares`,
                    start: {
                        date: escala.data,
                        timeZone: 'America/Sao_Paulo',
                    },
                    end: {
                        date: escala.data,
                        timeZone: 'America/Sao_Paulo',
                    },
                };

                // Call Google Calendar API v3
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`, {
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
