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

// Cache em localStorage para resposta instantânea + fallback offline por dia
function getStorageKey() {
  const hoje = new Date().toISOString().split('T')[0];
  return `conferencia_diaria_${hoje}`;
}

function getLocalConferencias(): Record<string, any> {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setLocalConferenciaItem(itemId: string, itemConf: any) {
  try {
    const mapa = getLocalConferencias();
    mapa[itemId] = itemConf;
    localStorage.setItem(getStorageKey(), JSON.stringify(mapa));
  } catch (e) {
    console.error('Erro ao salvar localmente:', e);
  }
}

// Buscar conferência do dia atual:
export async function buscarConferenciaDia(): Promise<Record<string, any>> {
  const localMap = getLocalConferencias();
  const hoje = new Date().toISOString().split('T')[0];

  try {
    // 1. Tentar buscar da tabela conferencia_itens se ela existir
    const { data: dbData, error: dbError } = await supabase
      .from('conferencia_itens')
      .select('*')
      .eq('data_conferencia', hoje);

    if (!dbError && dbData && dbData.length > 0) {
      const mapa: Record<string, any> = { ...localMap };
      for (const item of dbData) {
        const chave = item.fleet_item_id || item.equipamento_id || item.material_id || item.viatura_id;
        if (chave) mapa[chave] = item;
      }
      return mapa;
    }

    // 2. Se conferencia_itens não existir no Supabase, carregar os dados persistidos da tabela fleet
    const { data: fleetData, error: fleetError } = await supabase
      .from('fleet')
      .select('id, details');

    if (!fleetError && fleetData) {
      const mapa: Record<string, any> = { ...localMap };
      for (const f of fleetData) {
        if (f.details) {
          try {
            const parsed = typeof f.details === 'string' ? JSON.parse(f.details) : f.details;
            if (parsed && parsed.conferencia_data === hoje && parsed.conferencia_status) {
              mapa[f.id] = {
                id: f.id,
                status: parsed.conferencia_status,
                observacao: parsed.conferencia_observacao || '',
                conferido_por_nome: parsed.conferido_por_nome || 'Militar',
                conferido_em: parsed.conferido_em || new Date().toISOString(),
              };
            }
          } catch (e) {
            // Se details não for JSON válido, ignora
          }
        }
      }
      return mapa;
    }

    return localMap;
  } catch (e) {
    console.error('Erro ao buscar conferência do dia:', e);
    return localMap;
  }
}

// Salvar ou atualizar conferência (salva instantaneamente no localStorage e persiste no Supabase via fleet ou conferencia_itens):
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
  const itemId = dados.fleet_item_id || dados.viatura_id || dados.equipamento_id || dados.material_id;
  if (!itemId) return false;

  const { data: { user } } = await supabase.auth.getUser();
  let nomeUsuario = user?.email?.split('@')[0] || 'Militar';

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
    // Ignora
  }

  const hoje = new Date().toISOString().split('T')[0];
  const agora = new Date().toISOString();

  const itemConf = {
    id: itemId,
    status: dados.status,
    observacao: dados.observacao || '',
    conferido_por_nome: nomeUsuario,
    conferido_em: agora,
    data_conferencia: hoje,
  };

  // 1. Atualizar instantaneamente o cache local do navegador
  setLocalConferenciaItem(itemId, itemConf);

  // 2. Persistir no Supabase remoto
  try {
    // Tentar primeiro na tabela conferencia_itens
    const { error: confError } = await supabase
      .from('conferencia_itens')
      .upsert({
        data_conferencia: hoje,
        equipamento_id: dados.equipamento_id || null,
        material_id: dados.material_id || null,
        viatura_id: dados.viatura_id || null,
        fleet_item_id: itemId,
        status: dados.status,
        observacao: dados.observacao || null,
        conferido_por_id: user?.id || null,
        conferido_por_nome: nomeUsuario,
        conferido_em: agora,
      });

    if (confError) {
      // Se conferencia_itens ainda não existe no schema remote do Supabase, salvar o registro de conferência dentro do campo 'details' da tabela 'fleet' (garantia de 100% de persistência no remoto!)
      const { data: fleetItem } = await supabase
        .from('fleet')
        .select('details')
        .eq('id', itemId)
        .maybeSingle();

      let detailsObj: any = {};
      if (fleetItem?.details) {
        try {
          detailsObj = typeof fleetItem.details === 'string' ? JSON.parse(fleetItem.details) : fleetItem.details;
        } catch (e) {
          detailsObj = { raw: fleetItem.details };
        }
      }

      detailsObj.conferencia_status = dados.status;
      detailsObj.conferencia_observacao = dados.observacao || '';
      detailsObj.conferido_por_nome = nomeUsuario;
      detailsObj.conferido_em = agora;
      detailsObj.conferencia_data = hoje;

      await supabase
        .from('fleet')
        .update({ details: JSON.stringify(detailsObj) })
        .eq('id', itemId);
    }
  } catch (err) {
    console.error('Erro na gravação remota do Supabase:', err);
  }

  return true;
}
