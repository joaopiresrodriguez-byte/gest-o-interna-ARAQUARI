import { supabase } from './supabase';

// Definição dos status disponíveis:
export const STATUS_CONFERENCIA = {
  ok: {
    label: 'Tem / Ok',
    icone: '✅',
    cor: '#166534',
    fundo: '#dcfce7',
  },
  avariado: {
    label: 'Avariado',
    icone: '⚠️',
    cor: '#92400e',
    fundo: '#fef3c7',
  },
  nao_encontrado: {
    label: 'Não Tem',
    icone: '❌',
    cor: '#991b1b',
    fundo: '#fee2e2',
  },
} as const;

export type StatusConferencia = keyof typeof STATUS_CONFERENCIA;

// Buscar conferência do dia atual (com suporte dinâmico a tabela):
export async function buscarConferenciaDia(): Promise<Record<string, any>> {
  const hoje = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('conferencia_itens')
      .select(`
        id, status, observacao,
        equipamento_id, material_id,
        viatura_id, fleet_item_id,
        conferido_por_nome,
        conferido_em
      `)
      .eq('data_conferencia', hoje);

    if (error) {
      console.warn('Tabela conferencia_itens ainda não criada no Supabase remote:', error.message);
      return {};
    }

    const mapa: Record<string, any> = {};
    for (const item of data || []) {
      const chave = item.fleet_item_id || item.equipamento_id || item.material_id || item.viatura_id;
      if (chave) mapa[chave] = item;
    }
    return mapa;
  } catch (e) {
    console.error('Erro ao buscar conferência do dia:', e);
    return {};
  }
}

// Salvar ou atualizar conferência:
export async function salvarConferencia(
  dados: {
    equipamento_id?: string;
    material_id?: string;
    viatura_id?: string;
    fleet_item_id?: string;
    status: StatusConferencia;
    observacao?: string;
  }
) {
  const { data: { user } } = await supabase.auth.getUser();

  let nomeUsuario = user?.email || 'Usuário';

  try {
    const { data: perfil } = await supabase
      .from('militares')
      .select('nome_guerra')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (perfil?.nome_guerra) {
      nomeUsuario = perfil.nome_guerra;
    }
  } catch (err) {
    // Ignora fallback se tabela militares não tiver coluna user_id
  }

  const hoje = new Date().toISOString().split('T')[0];

  const payload = {
    data_conferencia: hoje,
    equipamento_id: dados.equipamento_id || null,
    material_id: dados.material_id || null,
    viatura_id: dados.viatura_id || null,
    fleet_item_id: dados.fleet_item_id || dados.equipamento_id || dados.material_id || dados.viatura_id || null,
    status: dados.status,
    observacao: dados.observacao || null,
    conferido_por_id: user?.id || null,
    conferido_por_nome: nomeUsuario,
    conferido_em: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('conferencia_itens')
    .upsert(payload);

  if (error) {
    console.error('Erro ao salvar conferencia_itens:', error);
    throw error;
  }
  return true;
}
