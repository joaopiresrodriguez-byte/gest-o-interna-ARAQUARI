import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') || '16_22chsocorrista@cbm.sc.gov.br';
const SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '';

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
  const header = { alg: 'RS256', typ: 'JWT' };
  const sHeader = btoa(JSON.stringify(header));
  const sClaim = btoa(JSON.stringify(claim));
  const signatureInput = `${sHeader}.${sClaim}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = creds.private_key.substring(
    pemHeader.length,
    creds.private_key.length - pemFooter.length
  ).replace(/\s/g, '');
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signatureInput)
  );

  const sSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signatureInput}.${sSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Falha ao obter access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

interface EscalaItem {
  id?: string;
  data: string; // YYYY-MM-DD
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

  try {
    const payload = await req.json();
    const { action, escalas, personnel, mes, ano } = payload;

    if (!SERVICE_ACCOUNT) {
      return new Response(
        JSON.stringify({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada nos Supabase Secrets.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const token = await getAccessToken();
    const personnelMap = new Map<string | number, string>();

    const populatePersonnelMap = (list: PersonnelItem[]) => {
      list.forEach((p: PersonnelItem) => {
        const rank = p.rank ? `${p.rank} ` : '';
        const name = p.war_name || p.name;
        const formatted = `${rank}${name}`.trim();
        if (p.id !== undefined && p.id !== null) {
          personnelMap.set(p.id, formatted);
          personnelMap.set(String(p.id), formatted);
          if (!isNaN(Number(p.id))) personnelMap.set(Number(p.id), formatted);
        }
      });
    };

    if (Array.isArray(personnel) && personnel.length > 0) {
      populatePersonnelMap(personnel);
    } else {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const pRes = await fetch(`${supabaseUrl}/rest/v1/personnel?select=id,name,war_name,rank`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            if (Array.isArray(pData)) populatePersonnelMap(pData);
          }
        } catch (e) {
          console.warn('Erro ao carregar personnel do Supabase:', e);
        }
      }
    }

    if (action === 'upsert' && Array.isArray(escalas)) {
      let syncCount = 0;

      for (const esc of (escalas as EscalaItem[])) {
        if (!esc.data) continue;

        if (mes && ano) {
          const [eYear, eMonth] = esc.data.split('-').map(Number);
          if (eYear !== Number(ano) || eMonth !== Number(mes)) continue;
        }

        const turmaLabel = esc.turma || (esc.equipe ? esc.equipe.replace('Turma ', '') : 'A');
        
        const militaresNomes: string[] = [];
        if (Array.isArray(esc.militares)) {
          esc.militares.forEach((mId) => {
            const nome = personnelMap.get(mId) || personnelMap.get(String(mId)) || personnelMap.get(Number(mId));
            if (nome) militaresNomes.push(nome);
          });
        }

        const summary = `🚨 Guarnição ${turmaLabel}: ${militaresNomes.length > 0 ? militaresNomes.join(', ') : 'Serviço Operacional'}`;
        const description = `Escala Operacional CBMSC Araquari\nData: ${esc.data}\nGuarnição: ${turmaLabel}\nMilitares de Serviço:\n${militaresNomes.map(n => `• ${n}`).join('\n') || 'Nenhum militar registrado'}`;

        const eventId = `escala${esc.data.replace(/-/g, '')}`;

        const startDateObj = new Date(`${esc.data}T00:00:00Z`);
        const endDateObj = new Date(startDateObj);
        endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
        const nextDayStr = endDateObj.toISOString().split('T')[0];

        const eventPayload = {
          summary,
          description,
          start: { date: esc.data },
          end: { date: nextDayStr },
          transparency: 'transparent',
        };

        const calRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventPayload),
          }
        );

        if (calRes.ok) {
          syncCount++;
        } else {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(eventPayload),
            }
          );
          syncCount++;
        }
      }

      return new Response(
        JSON.stringify({ ok: true, synced: syncCount }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Nenhuma ação executada' }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
