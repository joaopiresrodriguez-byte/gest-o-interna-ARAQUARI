import { supabase } from './supabase';
import { Training } from './types';
import { triggerSync } from './syncScheduler';

export const STATUS_INSTRUCAO: Record<string, { label: string; cor: string; fundo: string; icone: string }> = {
  Scheduled: {
    label: 'Agendada',
    cor: '#1d4ed8',
    fundo: '#dbeafe',
    icone: '📅',
  },
  agendada: {
    label: 'Agendada',
    cor: '#1d4ed8',
    fundo: '#dbeafe',
    icone: '📅',
  },
  em_andamento: {
    label: 'Em Andamento',
    cor: '#b45309',
    fundo: '#fef3c7',
    icone: '⏳',
  },
  concluida: {
    label: 'Concluída',
    cor: '#166534',
    fundo: '#dcfce7',
    icone: '✅',
  },
  Completed: {
    label: 'Concluída',
    cor: '#166534',
    fundo: '#dcfce7',
    icone: '✅',
  },
  parcialmente_concluida: {
    label: 'Parcialmente Concluída',
    cor: '#92400e',
    fundo: '#fef3c7',
    icone: '⚠️',
  },
  nao_realizada: {
    label: 'Não Realizada',
    cor: '#991b1b',
    fundo: '#fee2e2',
    icone: '❌',
  },
  Canceled: {
    label: 'Cancelada',
    cor: '#4b5563',
    fundo: '#f3f4f6',
    icone: '🚫',
  },
  Cancelado: {
    label: 'Cancelada',
    cor: '#4b5563',
    fundo: '#f3f4f6',
    icone: '🚫',
  },
};

export type StatusInstrucao = 'concluida' | 'parcialmente_concluida' | 'nao_realizada' | 'em_andamento' | 'agendada' | 'Canceled';

export const STATUS_RESULTADO_INSTRUCAO: { key: StatusInstrucao; label: string; icone: string; cor: string; fundo: string }[] = [
  { key: 'concluida', label: 'Concluída', icone: '✅', cor: '#166534', fundo: '#dcfce7' },
  { key: 'parcialmente_concluida', label: 'Parcialmente Concluída', icone: '⚠️', cor: '#92400e', fundo: '#fef3c7' },
  { key: 'nao_realizada', label: 'Não Realizada', icone: '❌', cor: '#991b1b', fundo: '#fee2e2' },
];

/**
 * Atualizar instrução com auditoria e notificações
 */
export async function atualizarInstrucao(
  instrucaoId: string,
  dados: {
    status: string;
    observacoes?: string;
    completed_by?: string;
  }
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nomeMilitar = dados.completed_by || user?.email || 'Usuário do Sistema';
  if (user?.email) {
    try {
      const { data: pessoal } = await supabase
        .from('personnel')
        .select('rank, war_name, name')
        .ilike('email', user.email)
        .maybeSingle();

      if (pessoal) {
        nomeMilitar = `${pessoal.rank || ''} ${pessoal.war_name || pessoal.name}`.trim();
      }
    } catch {
      // Ignorar fallback
    }
  }

  const agora = new Date().toISOString();
  const payload: Partial<Training> = {
    status: dados.status,
    observacoes: dados.observacoes || '',
    completed_by: dados.status === 'concluida' ? (dados.completed_by || nomeMilitar) : undefined,
    editado_por_nome: nomeMilitar,
    editado_em: agora,
  };

  // 1. Tentar salvar com campos de auditoria
  const { error } = await supabase
    .from('training_schedule')
    .update(payload)
    .eq('id', instrucaoId);

  // Fallback se colunas novas não existirem no schema do banco
  if (error) {
    console.warn('[InstrucaoService] Tentando salvar apenas status e observacoes devido a schema legado:', error.message);
    const { error: errSimples } = await supabase
      .from('training_schedule')
      .update({ status: dados.status })
      .eq('id', instrucaoId);

    if (errSimples) throw errSimples;
  }

  triggerSync('training_schedule', instrucaoId).catch(() => {});
  return true;
}
