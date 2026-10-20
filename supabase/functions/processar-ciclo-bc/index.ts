import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const Z_INSTANCE = Deno.env.get('Z_API_INSTANCE_ID') || ''
const Z_TOKEN    = Deno.env.get('Z_API_TOKEN') || ''
const Z_CLIENT   = Deno.env.get('Z_API_CLIENT_TOKEN') || ''
const APP_URL    = Deno.env.get('PUBLIC_APP_URL') || 'https://gest-o-interna-araquari.vercel.app'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// ── WhatsApp via Z-API ────────────────────────────────────────────────────────
async function enviarWhatsApp(telefone: string, mensagem: string): Promise<boolean> {
  if (!Z_INSTANCE || !Z_TOKEN) {
    console.warn('[BC] Z_API não configurado — mensagem não enviada para', telefone);
    return false;
  }

  let num = telefone.replace(/\D/g, '');
  if (num.length === 10 || num.length === 11) num = '55' + num;

  const url = `https://api.z-api.io/instances/${Z_INSTANCE}/token/${Z_TOKEN}/send-text`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (Z_CLIENT) headers['Client-Token'] = Z_CLIENT;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: num, message: mensagem }),
    });
    const resJson = await resp.json().catch(() => ({}));
    console.log(`[BC] WhatsApp → ${num}: HTTP ${resp.status}`, resJson);
    return resp.ok;
  } catch (err) {
    console.error(`[BC] Erro envio WhatsApp ${num}:`, err);
    return false;
  }
}

// ── Geração de token ──────────────────────────────────────────────────────────
function gerarToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ── CORS helper ───────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };
}

// ── Calcular mês de referência seguinte ───────────────────────────────────────
function calcularMesRefSeguinte(agora: Date): string {
  let proxAno = agora.getFullYear();
  let proxMes = agora.getMonth() + 2; // +1 zero-indexed, +1 próx mês
  if (proxMes > 12) { proxMes = 1; proxAno += 1; }
  return `${proxAno}-${String(proxMes).padStart(2, '0')}`;
}

// ═════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch (_) {}

    const acao = body.action || 'auto';
    const agora = new Date();
    const diaAtual = agora.getDate();

    console.log(`[BC] Ação recebida: "${acao}" | Dia atual: ${diaAtual}`);

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: abrir_ciclo_dia20  (automático via pg_cron ou manual via botão)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'abrir_ciclo_dia20' || (acao === 'auto' && diaAtual >= 20 && diaAtual < 26)) {
      const mesRef = body.mesRef || calcularMesRefSeguinte(agora);
      const [anoRef, mesStr] = mesRef.split('-');
      const mesAnoFormat = `${mesStr}/${anoRef}`;

      // Datas: abertura no dia 20, encerramento dia 25 às 23:59:59 (mês atual corrente)
      const dataAbertura     = new Date(agora.getFullYear(), agora.getMonth(), 20, 0, 0, 0).toISOString();
      const dataEncerramento = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59).toISOString();

      // Criar / atualizar ciclo
      const { data: ciclo, error: errCiclo } = await supabase
        .from('bc_ciclos')
        .upsert({
          mes_referencia:    mesRef,
          data_abertura:     dataAbertura,
          data_encerramento: dataEncerramento,
          status:            'aberto',
        }, { onConflict: 'mes_referencia' })
        .select()
        .single();

      if (errCiclo || !ciclo) {
        throw new Error(`Falha ao criar/atualizar ciclo: ${errCiclo?.message}`);
      }

      // Buscar todos os BCs ativos com telefone
      const { data: bcs } = await supabase
        .from('personnel')
        .select('*')
        .eq('type', 'BC')
        .eq('status', 'Ativo');

      let tokensGerados    = 0;
      let mensagensEnviadas = 0;
      const linksGerados: Array<{ bombeiro_id: number; nome: string; token: string; link: string }> = [];

      for (const bc of (bcs || [])) {
        // Verificar se já existe token para este ciclo/bombeiro
        const { data: tokenExistente } = await supabase
          .from('bc_access_tokens')
          .select('token')
          .eq('ciclo_id', ciclo.id)
          .eq('bombeiro_id', bc.id)
          .maybeSingle();

        let token = tokenExistente?.token;

        if (!token) {
          token = gerarToken();
          await supabase.from('bc_access_tokens').insert({
            ciclo_id:      ciclo.id,
            bombeiro_id:   bc.id,
            mes_referencia: mesRef,
            token,
          });
          tokensGerados++;
        }

        const link = `${APP_URL}/bc-intencao?token=${token}`;
        linksGerados.push({ bombeiro_id: bc.id, nome: bc.name, token, link });

        if (bc.phone) {
          const msg =
            `🔥 *CBMSC Araquari — Bombeiro Comunitário*\n\n` +
            `Olá, *${bc.war_name || bc.name}*! As intenções de serviço para o mês de *${mesAnoFormat}* estão abertas.\n\n` +
            `📅 Prazo para preenchimento: *até o dia 25/${mesStr.replace(/^0/, '')}*\n\n` +
            `Acesse o link abaixo e informe seus dias de disponibilidade:\n${link}\n\n` +
            `⏰ Serviço de 12h ou 24h. Você pode editar suas escolhas até o prazo.`;

          const enviado = await enviarWhatsApp(bc.phone, msg);
          if (enviado) {
            mensagensEnviadas++;
            await supabase
              .from('bc_access_tokens')
              .update({ whatsapp_enviado: true, whatsapp_enviado_em: new Date().toISOString() })
              .eq('token', token);
          }
        }
      }

      return new Response(JSON.stringify({
        ok:               true,
        acao:             'abrir_ciclo_dia20',
        mesRef,
        cicloId:          ciclo.id,
        tokensGerados,
        mensagensEnviadas,
        links:            linksGerados,
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: abrir_ciclo_manual  (botão ⚡ Abertura Manual — prazo 1 dia)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'abrir_ciclo_manual') {
      const mesRef = body.mesRef;
      if (!mesRef) throw new Error('mesRef é obrigatório para abrir_ciclo_manual');

      const [anoRef, mesStr] = mesRef.split('-');
      const mesAnoFormat = `${mesStr}/${anoRef}`;

      const dataAbertura     = agora.toISOString();
      const dataEncerramento = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString();

      // Criar / atualizar ciclo
      const { data: ciclo, error: errCiclo } = await supabase
        .from('bc_ciclos')
        .upsert({
          mes_referencia:    mesRef,
          data_abertura:     dataAbertura,
          data_encerramento: dataEncerramento,
          status:            'aberto',
        }, { onConflict: 'mes_referencia' })
        .select()
        .single();

      if (errCiclo || !ciclo) {
        throw new Error(`Falha ao criar/atualizar ciclo manual: ${errCiclo?.message}`);
      }

      const { data: bcs } = await supabase
        .from('personnel')
        .select('*')
        .eq('type', 'BC')
        .eq('status', 'Ativo');

      let tokensGerados    = 0;
      let mensagensEnviadas = 0;
      const linksGerados: Array<{ bombeiro_id: number; nome: string; token: string; link: string }> = [];

      for (const bc of (bcs || [])) {
        // Reutilizar token existente ou gerar novo
        const { data: tokenExistente } = await supabase
          .from('bc_access_tokens')
          .select('token')
          .eq('ciclo_id', ciclo.id)
          .eq('bombeiro_id', bc.id)
          .maybeSingle();

        let token = tokenExistente?.token;
        if (!token) {
          token = gerarToken();
          await supabase.from('bc_access_tokens').insert({
            ciclo_id:      ciclo.id,
            bombeiro_id:   bc.id,
            mes_referencia: mesRef,
            token,
          });
          tokensGerados++;
        }

        const link = `${APP_URL}/bc-intencao?token=${token}`;
        linksGerados.push({ bombeiro_id: bc.id, nome: bc.name, token, link });

        if (bc.phone) {
          const msg =
            `🔥 *CBMSC Araquari — Bombeiro Comunitário*\n\n` +
            `Olá, *${bc.war_name || bc.name}*! ⚡ Abertura MANUAL das intenções de serviço para *${mesAnoFormat}*.\n\n` +
            `⏰ *Prazo: 24 horas* (abertura emergencial pelo gestor)\n\n` +
            `Acesse agora e informe sua disponibilidade:\n${link}`;

          const enviado = await enviarWhatsApp(bc.phone, msg);
          if (enviado) {
            mensagensEnviadas++;
            await supabase
              .from('bc_access_tokens')
              .update({ whatsapp_enviado: true, whatsapp_enviado_em: new Date().toISOString() })
              .eq('token', token);
          }
        }
      }

      return new Response(JSON.stringify({
        ok:               true,
        acao:             'abrir_ciclo_manual',
        mesRef,
        cicloId:          ciclo.id,
        tokensGerados,
        mensagensEnviadas,
        links:            linksGerados,
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: enviar_links  (re-disparo de WhatsApp com links JÁ existentes)
    // Não recria ciclo nem tokens — apenas re-envia para os BCs
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'enviar_links') {
      const mesRef = body.mesRef;
      if (!mesRef) throw new Error('mesRef é obrigatório para enviar_links');

      const [anoRef, mesStr] = mesRef.split('-');
      const mesAnoFormat = `${mesStr}/${anoRef}`;

      // Buscar ciclo
      const { data: ciclo } = await supabase
        .from('bc_ciclos')
        .select('*')
        .eq('mes_referencia', mesRef)
        .maybeSingle();

      if (!ciclo) throw new Error(`Nenhum ciclo encontrado para ${mesRef}. Abra o ciclo primeiro.`);

      // Buscar todos os tokens do ciclo com dados do bombeiro
      const { data: tokens } = await supabase
        .from('bc_access_tokens')
        .select('*, personnel(*)')
        .eq('mes_referencia', mesRef);

      const [anoEnc, mesEnc, diaEnc] = (ciclo.data_encerramento || '').split('T')[0].split('-');
      const prazoStr = `${diaEnc || '25'}/${mesStr}`;
      const ehManual = new Date(ciclo.data_encerramento).getTime() - new Date(ciclo.data_abertura).getTime() < 2 * 24 * 60 * 60 * 1000;

      let enviados = 0;
      const linksList: Array<{ bombeiro_id: number; nome: string; token: string; link: string; enviado: boolean }> = [];

      for (const tk of (tokens || [])) {
        const bc = (tk as any).personnel;
        if (!bc) continue;

        const link = `${APP_URL}/bc-intencao?token=${tk.token}`;
        let enviado = false;

        if (bc.phone) {
          const msg = ehManual
            ? `🔥 *CBMSC Araquari — Bombeiro Comunitário*\n\n` +
              `Olá, *${bc.war_name || bc.name}*! ⚡ Link de intenção para *${mesAnoFormat}* (abertura emergencial).\n\n` +
              `⏰ *Prazo: ${prazoStr}*\n\nAcesse:\n${link}`
            : `🔥 *CBMSC Araquari — Bombeiro Comunitário*\n\n` +
              `Olá, *${bc.war_name || bc.name}*! 📋 Lembrete: intenções de serviço para *${mesAnoFormat}*.\n\n` +
              `⏰ Prazo: *até dia ${prazoStr}*\n\nAcesse:\n${link}`;

          enviado = await enviarWhatsApp(bc.phone, msg);
          if (enviado) {
            enviados++;
            await supabase
              .from('bc_access_tokens')
              .update({ whatsapp_enviado: true, whatsapp_enviado_em: new Date().toISOString() })
              .eq('id', tk.id);
          }
        }

        linksList.push({ bombeiro_id: bc.id, nome: bc.name, token: tk.token, link, enviado });
      }

      return new Response(JSON.stringify({
        ok:     true,
        acao:   'enviar_links',
        mesRef,
        total:  (tokens || []).length,
        enviados,
        links:  linksList,
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: encerrar_ciclo_dia26  (automático via pg_cron ou manual)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'encerrar_ciclo_dia26' || (acao === 'auto' && diaAtual >= 26)) {
      const mesRef = body.mesRef || calcularMesRefSeguinte(agora);

      await supabase
        .from('bc_ciclos')
        .update({ status: 'encerrado' })
        .eq('mes_referencia', mesRef)
        .eq('status', 'aberto');

      return new Response(JSON.stringify({
        ok:     true,
        acao:   'encerrar_ciclo_dia26',
        mesRef,
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: rodar_motor_selecao  (automático via pg_cron ou manual gestor)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'rodar_motor_selecao') {
      const mesRef = body.mesRef || calcularMesRefSeguinte(agora);

      // Encerrar ciclo se ainda estiver aberto
      await supabase
        .from('bc_ciclos')
        .update({ status: 'processado' })
        .eq('mes_referencia', mesRef)
        .in('status', ['aberto', 'encerrado']);

      // Buscar intenções do mês (exclui placeholders — apenas intenções com status 'confirmada' ou 'pendente' com dia real)
      const { data: intencoesBrutas, error: errInt } = await supabase
        .from('bc_intencoes')
        .select('*')
        .eq('mes_referencia', mesRef)
        .neq('dia', `${mesRef}-01`); // Ignora placeholders legados

      if (errInt) throw errInt;

      const total = (intencoesBrutas || []).length;
      if (total === 0) {
        return new Response(JSON.stringify({
          ok:             true,
          acao:           'rodar_motor_selecao',
          mesRef,
          processados:    0,
          diasComEscala:  0,
          aviso:          'Nenhuma intenção real encontrada para este mês.',
        }), { headers: corsHeaders() });
      }

      // Processamento será feito no frontend (bcEscalaService.rodarMotorSelecao)
      // A Edge Function apenas encerra o ciclo — o motor completo roda via RPC
      return new Response(JSON.stringify({
        ok:             true,
        acao:           'rodar_motor_selecao',
        mesRef,
        intencoesMes:   total,
        nota:           'Ciclo encerrado. Motor de seleção deve ser iniciado via painel de gestão ou RPC.',
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: buscar_tokens  (listar links existentes de um ciclo)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'buscar_tokens') {
      const mesRef = body.mesRef;
      if (!mesRef) throw new Error('mesRef é obrigatório para buscar_tokens');

      const { data: tokens } = await supabase
        .from('bc_access_tokens')
        .select('*, personnel(*)')
        .eq('mes_referencia', mesRef);

      const links = (tokens || []).map((tk: any) => ({
        bombeiro_id:        tk.bombeiro_id,
        nome:               tk.personnel?.name || `ID #${tk.bombeiro_id}`,
        war_name:           tk.personnel?.war_name,
        token:              tk.token,
        link:               `${APP_URL}/bc-intencao?token=${tk.token}`,
        whatsapp_enviado:   tk.whatsapp_enviado,
        whatsapp_enviado_em: tk.whatsapp_enviado_em,
      }));

      return new Response(JSON.stringify({
        ok:    true,
        acao:  'buscar_tokens',
        mesRef,
        total: links.length,
        links,
      }), { headers: corsHeaders() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÃO: notificar_selecionados  (após gestor publicar escala)
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'notificar_selecionados') {
      const mesRef = body.mesRef;
      if (!mesRef) throw new Error('mesRef não informado');

      const [anoStr, mesStr] = mesRef.split('-');
      const mesAnoFormat = `${mesStr}/${anoStr}`;

      const { data: selecionados } = await supabase
        .from('bc_selecionados')
        .select('*, personnel(*)')
        .order('dia');

      const selecionadosMes = (selecionados || []).filter((s: any) => s.dia.startsWith(mesRef));

      const porBombeiro: Record<number, { bc: any; dias: Array<{ dia: string; inicio: string; fim: string }> }> = {};
      selecionadosMes.forEach((s: any) => {
        if (!porBombeiro[s.bombeiro_id]) {
          porBombeiro[s.bombeiro_id] = { bc: s.personnel, dias: [] };
        }
        porBombeiro[s.bombeiro_id].dias.push({ dia: s.dia, inicio: s.horario_inicio, fim: s.horario_fim });
      });

      let notificadosCount = 0;
      for (const { bc, dias } of Object.values(porBombeiro)) {
        if (!bc || !bc.phone) continue;
        const listaDiasStr = dias
          .map((d: any) => {
            const [, m, diaNum] = d.dia.split('-');
            return `• ${diaNum}/${m}: das ${d.inicio} às ${d.fim}`;
          })
          .join('\n');

        const msg =
          `🔥 *CBMSC Araquari — Escala BC Publicada*\n\n` +
          `Olá, *${bc.war_name || bc.name}*! Você foi escalado para o serviço de Bombeiro Comunitário em *${mesAnoFormat}*:\n\n` +
          `${listaDiasStr}\n\n` +
          `Em caso de dúvidas, entre em contato com a seção B1.`;

        const enviado = await enviarWhatsApp(bc.phone, msg);
        if (enviado) notificadosCount++;
      }

      return new Response(JSON.stringify({
        ok:              true,
        acao:            'notificar_selecionados',
        notificadosCount,
      }), { headers: corsHeaders() });
    }

    return new Response(JSON.stringify({ ok: true, status: 'Nenhuma ação executada', acao }), {
      headers: corsHeaders(),
    });

  } catch (err: any) {
    console.error('[BC] Erro na Edge Function:', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});
