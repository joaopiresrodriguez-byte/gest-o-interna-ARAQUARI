/**
 * missoesService.ts
 *
 * Serviço de atualização de missões diárias com auditoria de autoria.
 * Tabela: daily_missions
 */

import { supabase } from './supabase';

// ─── Mapa de status com metadados visuais ─────────────────────────────────────

export const STATUS_MISSAO = {
  agendada: {
    label: 'Agendada',
    cor: '#1d4ed8',
    fundo: '#dbeafe',
    icone: '📅',
    fluxo: true, // status de fluxo (não é resultado final)
  },
  em_andamento: {
    label: 'Em Andamento',
    cor: '#92400e',
    fundo: '#fef3c7',
    icone: '⚡',
    fluxo: true,
  },
  cancelada: {
    label: 'Cancelada',
    cor: '#374151',
    fundo: '#f3f4f6',
    icone: '🚫',
    fluxo: true,
  },
  concluida: {
    label: 'Concluída',
    cor: '#166534',
    fundo: '#dcfce7',
    icone: '✅',
    fluxo: false,
  },
  parcialmente_concluida: {
    label: 'Parcialmente Concluída',
    cor: '#92400e',
    fundo: '#fef3c7',
    icone: '⚠️',
    fluxo: false,
  },
  nao_realizada: {
    label: 'Não Realizada',
    cor: '#991b1b',
    fundo: '#fee2e2',
    icone: '❌',
    fluxo: false,
  },
} as const;

export type StatusMissao = keyof typeof STATUS_MISSAO;

// Status disponíveis para seleção no painel de resultado (não são de fluxo)
export const STATUS_RESULTADO: StatusMissao[] = [
  'concluida',
  'parcialmente_concluida',
  'nao_realizada',
];

// ─── Função de atualização com auditoria ─────────────────────────────────────

export async function atualizarMissao(
  missaoId: string,
  dados: {
    status: StatusMissao;
    observacoes: string;
    completed_by?: string;
  }
): Promise<true> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado. Faça login para editar missões.');
  }

  // Buscar nome e posto do militar pelo e-mail cadastrado em personnel
  let nomeMilitar = dados.completed_by || user.email || 'Usuário desconhecido';
  try {
    const { data: pessoal } = await supabase
      .from('personnel')
      .select('rank, war_name, name')
      .ilike('email', user.email || '')
      .maybeSingle();

    if (pessoal) {
      const posto = pessoal.rank ? `${pessoal.rank} ` : '';
      const nome = pessoal.war_name || pessoal.name || '';
      if (nome) nomeMilitar = `${posto}${nome}`.trim();
    }
  } catch {
    // fallback: mantém o e-mail se a consulta falhar
  }

  const { data: missaoAtual } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('id', missaoId)
    .single();

  const { error } = await supabase
    .from('daily_missions')
    .update({
      status: dados.status,
      observacoes: dados.observacoes,
      completed_by: nomeMilitar,
      editado_por_id: user.id,
      editado_por_nome: nomeMilitar,
      editado_em: new Date().toISOString(),
    })
    .eq('id', missaoId);

  if (error) throw error;

  // Se a missão NÃO foi concluída (qualquer status diferente de 'concluida': parcialmente_concluida, nao_realizada, cancelada, etc.)
  if (dados.status !== 'concluida') {
    const tituloMissao = missaoAtual?.title || 'Missão Diária';
    const statusLabel = STATUS_MISSAO[dados.status]?.label || dados.status;
    const responsavel = missaoAtual?.responsible_name || 'Guarnição de Serviço';
    const dataMissao = missaoAtual?.mission_date || new Date().toLocaleDateString('pt-BR');
    const horarioAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // 1. Criar aviso no sistema (pending_notices)
    try {
      await supabase.from('pending_notices').insert({
        title: `[ALERTA MISSÃO] ${statusLabel}: ${tituloMissao}`,
        description: `A missão "${tituloMissao}" (Data: ${dataMissao}, Resp: ${responsavel}) foi marcada como "${statusLabel}" por ${nomeMilitar}. Observação: ${dados.observacoes || 'Nenhuma'}`,
        status: 'pendente',
        priority: 'alta',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Não foi possível salvar em pending_notices:", e);
    }

    // 2. Disparo Automático via WhatsApp para o Comandante (5547988899591)
    try {
      const msgWa = encodeURIComponent(
        `⚠️ MISSÃO ENCERRADA SEM CONCLUSÃO\n` +
        `Data: ${dataMissao}\n` +
        `Missão: ${tituloMissao}\n` +
        `Guarnição: ${responsavel}\n` +
        `Resultado registrado: ${statusLabel}\n` +
        `Registrado por: ${nomeMilitar}\n` +
        `Horário: ${horarioAtual}`
      );
      window.open(`https://wa.me/5547988899591?text=${msgWa}`, '_blank');
    } catch (e) {
      console.error("Falha no disparo de WhatsApp para o Comandante:", e);
    }

    // 3. Criar/Notificar para o e-mail do comando 16_22cmt@cbm.sc.gov.br
    try {
      const emailSubject = encodeURIComponent(`[ALERTA MISSÃO DIÁRIA] ${statusLabel} - ${tituloMissao}`);
      const emailBody = encodeURIComponent(
        `Prezado Comando,\n\n` +
        `Informamos que a Missão Diária abaixo foi registrada com pendência no sistema de Gestão Interna Araquari:\n\n` +
        `📌 Missão: ${tituloMissao}\n` +
        `📅 Data: ${dataMissao}\n` +
        `👤 Responsável: ${responsavel}\n` +
        `📊 Status Final: ${statusLabel}\n` +
        `👮 Registrado Por: ${nomeMilitar}\n` +
        `📝 Observação: ${dados.observacoes || 'Sem observações'}\n\n` +
        `Atenciosamente,\n` +
        `Sistema de Gestão Interna CBMSC Araquari`
      );

      window.open(`mailto:16_22cmt@cbm.sc.gov.br?subject=${emailSubject}&body=${emailBody}`, '_blank');
    } catch (e) {
      console.error("Falha ao abrir mailto do comando:", e);
    }
  }

  return true;
}
