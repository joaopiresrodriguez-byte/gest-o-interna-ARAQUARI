import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const Z_INSTANCE = Deno.env.get('Z_API_INSTANCE_ID') || ''
const Z_TOKEN = Deno.env.get('Z_API_TOKEN') || ''
const Z_CLIENT = Deno.env.get('Z_API_CLIENT_TOKEN') || ''
const APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://gestao-cbmsc-araquari.vercel.app'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

async function enviarWhatsApp(telefone: string, mensagem: string) {
  if (!Z_INSTANCE || !Z_TOKEN) {
    console.error('Z_API credentials not configured');
    return false;
  }

  // Formatar número
  let num = telefone.replace(/\D/g, '');
  if (num.length === 10 || num.length === 11) {
    num = '55' + num;
  }

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
    console.log(`WhatsApp enviado para ${num}:`, resp.status, resJson);
    return resp.ok;
  } catch (err) {
    console.error(`Erro envio WhatsApp ${num}:`, err);
    return false;
  }
}

function gerarToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const acao = body.action || 'auto'; // 'abrir_ciclo_dia20', 'encerrar_ciclo_dia26', 'notificar_selecionados'

    const agora = new Date();
    const diaAtual = agora.getDate();

    // ─── AÇÃO DIA 20: Abertura de Ciclo e Disparo do Link ─────────────────────
    if (acao === 'abrir_ciclo_dia20' || (acao === 'auto' && diaAtual >= 20 && diaAtual < 26)) {
      // Calcular mês seguinte
      let proxAno = agora.getFullYear();
      let proxMes = agora.getMonth() + 2; // +1 zero-indexed, +1 prox mes
      if (proxMes > 12) {
        proxMes = 1;
        proxAno += 1;
      }
      const mesRef = `${proxAno}-${String(proxMes).padStart(2, '0')}`;
      const mesAnoFormat = `${String(proxMes).padStart(2, '0')}/${proxAno}`;

      // Criar/obter ciclo
      const dataAbertura = new Date(agora.getFullYear(), agora.getMonth(), 20, 0, 0, 0).toISOString();
      const dataEncerramento = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59).toISOString();

      await supabase.from('bc_ciclos').upsert({
        mes_referencia: mesRef,
        data_abertura: dataAbertura,
        data_encerramento: dataEncerramento,
        status: 'aberto'
      }, { onConflict: 'mes_referencia' });

      // Buscar todos os BCs ativos com telefone
      const { data: bcs } = await supabase
        .from('personnel')
        .select('*')
        .eq('type', 'BC')
        .eq('status', 'Ativo');

      let mensagensEnviadas = 0;

      if (bcs && bcs.length > 0) {
        for (const bc of bcs) {
          const token = gerarToken();
          const linkUnico = `${APP_URL}/bc-intencao?token=${token}`;

          // Criar placeholder na bc_intencoes com o token
          await supabase.from('bc_intencoes').insert({
            bombeiro_id: bc.id,
            mes_referencia: mesRef,
            dia: `${mesRef}-01`,
            horario_inicio: '07:00',
            horario_fim: '19:00',
            total_horas: 12.0,
            status: 'pendente',
            token_acesso: token,
          });

          if (bc.phone) {
            const msg = `Olá ${bc.name}. As intenções de serviço para o mês de ${mesAnoFormat} já estão abertas. ` +
              `Acesse o link abaixo até o dia 25 para informar sua disponibilidade. ` +
              `O link ficará disponível por 5 dias, do dia 20 ao dia 25: ${linkUnico}\n` +
              `Lembrando que o serviço deve ter duração de 12h ou 24h.`;

            const enviado = await enviarWhatsApp(bc.phone, msg);
            if (enviado) mensagensEnviadas++;
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, acao: 'abrir_ciclo_dia20', mesRef, mensagensEnviadas }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ─── AÇÃO DIA 26: Encerramento do Ciclo ──────────────────────────────────
    if (acao === 'encerrar_ciclo_dia26' || (acao === 'auto' && diaAtual >= 26)) {
      // Mes de referencia
      let targetAno = agora.getFullYear();
      let targetMes = agora.getMonth() + 2;
      if (targetMes > 12) {
        targetMes = 1;
        targetAno += 1;
      }
      const mesRef = `${targetAno}-${String(targetMes).padStart(2, '0')}`;

      // Encerrar ciclo
      await supabase
        .from('bc_ciclos')
        .update({ status: 'encerrado' })
        .eq('mes_referencia', mesRef);

      return new Response(JSON.stringify({ ok: true, acao: 'encerrar_ciclo_dia26', mesRef }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ─── AÇÃO: NOTIFICAR SELEÇÃO (Disparado após Gestor publicar) ─────────────
    if (acao === 'notificar_selecionados') {
      const mesRef = body.mesRef;
      if (!mesRef) throw new Error('mesRef não informado');

      const [anoStr, mesStr] = mesRef.split('-');
      const mesAnoFormat = `${mesStr}/${anoStr}`;

      const { data: selecionados } = await supabase
        .from('bc_selecionados')
        .select('*, personnel(*)')
        .order('dia');

      const selecionadosMes = (selecionados || []).filter(s => s.dia.startsWith(mesRef));

      // Agrupar por bombeiro
      const porBombeiro: Record<number, { bc: any; dias: Array<{ dia: string; inicio: string; fim: string }> }> = {};

      selecionadosMes.forEach(s => {
        if (!porBombeiro[s.bombeiro_id]) {
          porBombeiro[s.bombeiro_id] = { bc: s.personnel, dias: [] };
        }
        porBombeiro[s.bombeiro_id].dias.push({
          dia: s.dia,
          inicio: s.horario_inicio,
          fim: s.horario_fim,
        });
      });

      let notificadosCount = 0;

      for (const entry of Object.values(porBombeiro)) {
        const { bc, dias } = entry;
        if (!bc || !bc.phone) continue;

        const listaDiasStr = dias
          .map(d => {
            const [ano, m, diaNum] = d.dia.split('-');
            return `• ${diaNum}/${m}: das ${d.inicio} às ${d.fim}`;
          })
          .join('\n');

        const msg = `Olá ${bc.name}. Você foi escalado para o serviço de bombeiro comunitário nos seguintes dias em ${mesAnoFormat}:\n\n` +
          `${listaDiasStr}\n\n` +
          `Em caso de dúvidas entre em contato com a seção responsável.`;

        const enviado = await enviarWhatsApp(bc.phone, msg);
        if (enviado) notificadosCount++;
      }

      return new Response(JSON.stringify({ ok: true, acao: 'notificar_selecionados', notificadosCount }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, status: 'Nenhuma ação executada' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
