import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WHATSAPP_TOKEN    = Deno.env.get('WHATSAPP_TOKEN')!;
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')!;
const B4_WHATSAPP       = Deno.env.get('B4_WHATSAPP_NUMBER')!;
// Formato: 5547999999999 (sem + e sem espaços)

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY')!;
const B4_EMAIL    = Deno.env.get('B4_EMAIL')!;
const EMAIL_FROM  = Deno.env.get('EMAIL_FROM')!;
// ex: sistema@5bbm.sc.gov.br

serve(async (req) => {
  const dados = await req.json();

  const statusLabel =
    dados.status === 'avariado'
      ? '⚠️ AVARIADO'
      : '❌ NÃO ENCONTRADO';

  const localInfo = dados.viatura_nome
    ? `Viatura: ${dados.viatura_nome}` +
      (dados.compartimento_nome ? ` › ${dados.compartimento_nome}` : '')
    : dados.local_nome
      ? `Local: ${dados.local_nome}`
      : 'Local não informado';

  const mensagem =
    `🚨 *ALERTA DE CONFERÊNCIA B4*\n\n` +
    `*Status:* ${statusLabel}\n` +
    `*Item:* ${dados.item_nome}\n` +
    `*Tipo:* ${dados.tipo_item}\n` +
    `*${localInfo}*\n` +
    (dados.observacao ? `*Obs:* ${dados.observacao}\n` : '') +
    `*Conferido por:* ${dados.conferido_por}\n` +
    `*Data/Hora:* ${dados.data}`;

  const corFundo  = dados.status === 'avariado' ? '#fef3c7' : '#fee2e2';
  const corBorda  = dados.status === 'avariado' ? '#d97706'  : '#dc2626';

  // ── WHATSAPP via Meta Cloud API ────────────────────────────────────────────
  try {
    const waRes = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: B4_WHATSAPP,
          type: 'text',
          text: { body: mensagem },
        }),
      }
    );
    if (!waRes.ok) {
      const errBody = await waRes.text();
      console.error('WhatsApp API error:', errBody);
    }
  } catch (err) {
    console.error('Erro ao enviar WhatsApp:', err);
  }

  // ── EMAIL via Resend ────────────────────────────────────────────────────────
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: B4_EMAIL,
        subject: `🚨 Conferência B4 — ${statusLabel}: ${dados.item_nome}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:${corFundo};padding:20px;border-radius:10px;border-left:5px solid ${corBorda};">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">
                🚨 Alerta de Conferência B4
              </h2>
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;width:130px;vertical-align:top;">Status</td>
                  <td style="font-weight:bold;color:#1e293b;">${statusLabel}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Item</td>
                  <td style="font-weight:bold;color:#1e293b;">${dados.item_nome}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Tipo</td>
                  <td>${dados.tipo_item}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Localização</td>
                  <td>${localInfo}</td>
                </tr>
                ${dados.observacao ? `
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Observação</td>
                  <td>${dados.observacao}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Conferido por</td>
                  <td>${dados.conferido_por}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;vertical-align:top;">Data/Hora</td>
                  <td>${dados.data}</td>
                </tr>
              </table>
            </div>
            <p style="font-size:12px;color:#94a3b8;margin-top:16px;text-align:center;">
              Mensagem automática do sistema de gestão B4 — CBMSC Araquari.
            </p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('Resend API error:', errBody);
    }
  } catch (err) {
    console.error('Erro ao enviar email:', err);
  }

  // ── Marcar notificação como enviada no histórico ───────────────────────────
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const hoje = new Date().toISOString().split('T')[0];
    const itemId = dados.item_id;

    if (itemId) {
      await supabase
        .from('historico_conferencias_b4')
        .update({
          notificacao_enviada: true,
          notificacao_enviada_em: new Date().toISOString(),
        })
        .eq('data_conferencia', hoje)
        .eq('item_id', itemId);
    }
  } catch (err) {
    console.error('Erro ao marcar notificação:', err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
