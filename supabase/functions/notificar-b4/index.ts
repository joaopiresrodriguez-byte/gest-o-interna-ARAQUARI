import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const Z_INSTANCE = Deno.env.get('Z_API_INSTANCE_ID') || ''
const Z_TOKEN = Deno.env.get('Z_API_TOKEN') || ''
const Z_CLIENT = Deno.env.get('Z_API_CLIENT_TOKEN') || ''
const B4_NUMERO = Deno.env.get('B4_WHATSAPP_NUMBER') || '554734817549'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

async function enviarWhatsApp(mensagem: string) {
  if (!Z_INSTANCE || !Z_TOKEN) {
    console.error('Z_API credentials not configured');
    return;
  }

  const url = `https://api.z-api.io/instances/${Z_INSTANCE}/token/${Z_TOKEN}/send-text`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (Z_CLIENT) {
    headers['Client-Token'] = Z_CLIENT;
  }

  console.log('Sending message via Z-API to:', B4_NUMERO);

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone: B4_NUMERO,
      message: mensagem,
    }),
  });

  const resJson = await resp.json().catch(() => ({}));
  console.log('Z-API Response:', resp.status, resJson);
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Buscar TODAS as pendências não resolvidas
    const { data: pendencias, error } = await supabase
      .from('historico_conferencias_b4')
      .select('*')
      .eq('resolvido', false)
      .in('status_conferencia', ['avariado', 'nao_encontrado'])
      .order('data_conferencia', { ascending: false })

    if (error) {
      console.error('Database query error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!pendencias || pendencias.length === 0) {
      await enviarWhatsApp(
        `✅ *CONFERÊNCIA B4*\n\n` +
        `Nenhuma pendência em aberto.\n` +
        `Todos os itens estão regularizados.`
      )
      return new Response(
        JSON.stringify({ ok: true, pendencias: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const avariados = pendencias.filter(p => p.status_conferencia === 'avariado')
    const naoEncontrados = pendencias.filter(p => p.status_conferencia === 'nao_encontrado')

    const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    let msg = `⚠️ *PENDÊNCIAS B4 — ${dataHoje}*\n`
    msg += `━━━━━━━━━━━━━━━━━━━━\n`

    if (avariados.length > 0) {
      msg += `\n⚠️ *AVARIADOS (${avariados.length})*\n`
      avariados.forEach((p, i) => {
        const local = p.viatura_nome
          ? `${p.viatura_nome}` + (p.compartimento_nome ? ` › ${p.compartimento_nome}` : '')
          : p.local_nome || 'Local n/i'

        const dataConf = new Date(p.data_conferencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

        msg += `${i + 1}. ${p.item_nome}\n` +
               `   📍 ${local}\n` +
               `   📅 ${dataConf}\n`

        if (p.observacao) {
          msg += `   📝 ${p.observacao}\n`
        }
      })
    }

    if (naoEncontrados.length > 0) {
      msg += `\n❌ *NÃO ENCONTRADOS (${naoEncontrados.length})*\n`
      naoEncontrados.forEach((p, i) => {
        const local = p.viatura_nome
          ? `${p.viatura_nome}` + (p.compartimento_nome ? ` › ${p.compartimento_nome}` : '')
          : p.local_nome || 'Local n/i'

        const dataConf = new Date(p.data_conferencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

        msg += `${i + 1}. ${p.item_nome}\n` +
               `   📍 ${local}\n` +
               `   📅 ${dataConf}\n`

        if (p.observacao) {
          msg += `   📝 ${p.observacao}\n`
        }
      })
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━\n` +
           `Total: ${pendencias.length} pendência(s) em aberto.\n` +
           `Acesse o sistema para resolver.`

    await enviarWhatsApp(msg)

    return new Response(
      JSON.stringify({
        ok: true,
        pendencias: pendencias.length,
        avariados: avariados.length,
        nao_encontrados: naoEncontrados.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Execution error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
})
