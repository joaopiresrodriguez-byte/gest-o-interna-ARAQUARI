import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID') || '';
const SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '';

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurado');
  const creds = JSON.parse(SERVICE_ACCOUNT);
  
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const header = { alg: 'RS256', typ: 'JWT' };
  const sHeader = btoa(JSON.stringify(header));
  const sClaim = btoa(JSON.stringify(claim));
  const signatureInput = `${sHeader}.${sClaim}`;

  // Simple JWT generation via WebCrypto / SubtleCrypto or API
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
  return data.access_token;
}

// BLOCO B — FUNÇÃO buscarLinhaNoSheet
async function buscarLinhaNoSheet(
  token: string,
  aba: string,
  id: string
): Promise<number | null> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${aba}!A:A`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  const valores: string[][] = data.values || [];

  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === id) {
      return i + 1;
    }
  }

  return null;
}

async function appendToSheet(token: string, aba: string, rows: any[][]) {
  return await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${aba}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );
}

async function updateSheetRow(token: string, aba: string, linhaSheet: number, row: any[]) {
  return await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${aba}!A${linhaSheet}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
}

const TABELA_CONFIG: Record<string, { aba: string; mapeamento: (record: any) => any[] }> = {
  personnel: {
    aba: 'Militares',
    mapeamento: (r) => [r.id, r.name, r.war_name, r.rank || r.graduation, r.status, r.email, r.phone, r.cpf],
  },
  militares: {
    aba: 'Militares',
    mapeamento: (r) => [r.id, r.nome_completo || r.name, r.nome_guerra || r.war_name, r.posto_graduacao || r.rank, r.status, r.email, r.telefone || r.phone, r.cpf],
  },
  fleet: {
    aba: 'Equipamentos',
    mapeamento: (r) => [r.id, r.name, r.type, r.patrimonio_number, r.status, r.location, r.details],
  },
  equipamentos: {
    aba: 'Equipamentos',
    mapeamento: (r) => [r.id, r.nome || r.name, r.tipo || r.type, r.numero_serie || r.patrimonio_number, r.status, r.observacoes || r.details],
  },
  materias_instrucao: {
    aba: 'Instrucoes B3',
    mapeamento: (r) => [r.id, r.name, r.category, r.level, r.credit_hours, r.instructor, r.description],
  },
  materias: {
    aba: 'Instrucoes B3',
    mapeamento: (r) => [r.id, r.nome || r.name, r.categoria || r.category, r.nivel || r.level, r.carga_horaria || r.credit_hours, r.instrutor || r.instructor, r.descricao || r.description],
  },
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    const config = TABELA_CONFIG[table];
    if (!config) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `Tabela ${table} não possui webhook configurado.` }), { headers: { 'Content-Type': 'application/json' } });
    }

    const token = await getAccessToken();
    const linhaData = config.mapeamento(record);

    // BLOCO A — ATUALIZAR EDGE FUNCTION PARA TRATAR UPDATE
    if (type === 'INSERT') {
      await appendToSheet(token, config.aba, [linhaData]);
    }

    if (type === 'UPDATE') {
      const linhaSheet = await buscarLinhaNoSheet(token, config.aba, String(record.id));

      if (linhaSheet) {
        await updateSheetRow(token, config.aba, linhaSheet, linhaData);
      } else {
        await appendToSheet(token, config.aba, [linhaData]);
      }
    }

    return new Response(JSON.stringify({ ok: true, table, type }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
