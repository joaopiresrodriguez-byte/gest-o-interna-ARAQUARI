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
  }
): Promise<true> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado. Faça login para editar missões.');
  }

  const { error } = await supabase
    .from('daily_missions')
    .update({
      status: dados.status,
      observacoes: dados.observacoes,
      editado_por_id: user.id,
      editado_por_nome: user.email ?? 'Usuário desconhecido',
      editado_em: new Date().toISOString(),
    })
    .eq('id', missaoId);

  if (error) throw error;
  return true;
}
