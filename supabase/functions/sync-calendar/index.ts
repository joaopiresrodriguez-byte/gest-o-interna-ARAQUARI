import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') || '16_22chsocorrista@cbm.sc.gov.br';
const SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '';

// ─── JWT / OAuth ──────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurado');
  const creds = JSON.parse(SERVICE_ACCOUNT);

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const sHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const sClaim = btoa(JSON.stringify(claim));
  const signatureInput = `${sHeader}.${sClaim}`;

  const pemContents = creds.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signatureInput));

  const sSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${signatureInput}.${sSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Falha ao obter access token: ' + JSON.stringify(data));
  return data.access_token;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EscalaItem {
  data: string;
  turma?: string;
  equipe?: string;
  militares?: (number | string)[];
}

interface PersonnelItem {
  id: number | string;
  name: string;
  war_name?: string;
  rank?: string;
}

// ─── Helpers de Calendar ──────────────────────────────────────────────────────

async function listEventsInRange(token: string, timeMin: string, timeMax: string): Promise<{ id: string; summary: string }[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: '300',
    singleEvents: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((e: any) => ({ id: e.id, summary: e.summary || '' }));
}

async function deleteEvent(token: string, eventId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
}

async function createEvent(token: string, eventPayload: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    }
  );
  return res.ok;
}

// ─── Edge Function ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const payload = await req.json();
    const { action, escalas, personnel } = payload;

    if (!SERVICE_ACCOUNT) {
      return new Response(
        JSON.stringify({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada nos Supabase Secrets.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = await getAccessToken();

    // ─── Mapa de militares ────────────────────────────────────────────────────
    const personnelMap = new Map<string | number, string>();

    const populateMap = (list: PersonnelItem[]) => {
      list.forEach((p) => {
        const label = `${p.rank ? p.rank + ' ' : ''}${p.war_name || p.name}`.trim();
        [p.id, String(p.id), Number(p.id)].forEach(k => {
          if (k !== null && k !== undefined && !isNaN(Number(k))) personnelMap.set(k, label);
        });
        personnelMap.set(p.id, label);
        personnelMap.set(String(p.id), label);
      });
    };

    if (Array.isArray(personnel) && personnel.length > 0) {
      populateMap(personnel);
    } else {
      // Fallback: buscar direto no Supabase REST
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      if (supabaseUrl && supabaseKey) {
        try {
          const pRes = await fetch(`${supabaseUrl}/rest/v1/personnel?select=id,name,war_name,rank&status=eq.Ativo`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            if (Array.isArray(pData)) populateMap(pData);
          }
        } catch (_) { /* ignora */ }
      }
    }

    // ─── Ação: upsert ─────────────────────────────────────────────────────────
    if (action === 'upsert' && Array.isArray(escalas)) {
      const escList = escalas as EscalaItem[];

      if (escList.length === 0) {
        return new Response(JSON.stringify({ ok: true, synced: 0, message: 'Nenhuma escala recebida.' }), { headers: corsHeaders });
      }

      // Determina o intervalo de datas
      const dates = escList.map(e => e.data).filter(Boolean).sort();
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];

      // Deletar TODOS os eventos existentes no intervalo (incluindo os antigos "Escala: ID-0")
      const existingEvents = await listEventsInRange(
        token,
        `${firstDate}T00:00:00Z`,
        `${lastDate}T23:59:59Z`
      );

      for (const ev of existingEvents) {
        await deleteEvent(token, ev.id);
      }

      // Inserir eventos novos com os nomes dos militares
      let syncCount = 0;
      for (const esc of escList) {
        if (!esc.data) continue;

        const turmaLabel = esc.turma || (esc.equipe ? esc.equipe.replace('Turma ', '') : '?');

        const militaresNomes: string[] = [];
        if (Array.isArray(esc.militares)) {
          for (const mId of esc.militares) {
            const nome = personnelMap.get(mId) || personnelMap.get(String(mId)) || personnelMap.get(Number(mId));
            if (nome) militaresNomes.push(nome);
          }
        }

        const listaMilitares = militaresNomes.length > 0 ? militaresNomes.join(' | ') : 'Serviço Operacional';
        const summary = `🚒 Guarnição ${turmaLabel} — ${listaMilitares}`;
        const description = [
          '📋 ESCALA OPERACIONAL — CBMSC 16BBM Araquari',
          `📅 Data: ${esc.data}`,
          `🔴 Guarnição: ${turmaLabel}`,
          '',
          '👨‍🚒 Militares de Serviço:',
          ...militaresNomes.map(n => `  • ${n}`),
          '',
          '⏰ Regime: 24x72h',
        ].join('\n');

        // Data de fim = dia seguinte (Google Calendar API: end date é exclusivo)
        const endDate = new Date(`${esc.data}T00:00:00Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const ok = await createEvent(token, {
          summary,
          description,
          start: { date: esc.data },
          end: { date: endDateStr },
          colorId: turmaLabel === 'A' ? '9' : turmaLabel === 'B' ? '11' : turmaLabel === 'C' ? '5' : '8',
          transparency: 'transparent',
        });

        if (ok) syncCount++;
      }

      return new Response(
        JSON.stringify({ ok: true, synced: syncCount, deleted: existingEvents.length }),
        { headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: 'Ação não reconhecida.' }), { headers: corsHeaders });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
