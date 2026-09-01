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

    // 2. Se conferencia_itens não existir no Supabase, carregar dos dados persistidos da tabela fleet
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
            // Ignora
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

// Salvar ou atualizar conferência com histórico B4 e alerta automático.
export async function salvarConferencia(
  dados: {
    equipamento_id?: string;
    material_id?: string;
    viatura_id?: string;
    fleet_item_id?: string;
    status: StatusConferencia;
    observacao?: string;
    // Novos campos de Ocorrência Detalhada e Reposição Reserva
    tipo_ocorrencia?: 'avariado' | 'falta' | string;
    sub_tipo_avaria?: 'devera_consertar' | 'sem_conserto_baixar' | string;
    quantidade_falta?: number;
    reposto_reserva?: boolean;
    observacao_ocorrencia?: string;
    // Contexto para histórico e notificação:
    item_nome?: string;
    viatura_nome?: string;
    compartimento_nome?: string;
    local_nome?: string;
  }
) {
  const rawId = dados.fleet_item_id || dados.viatura_id || dados.equipamento_id || dados.material_id;
  if (!rawId) return false;
  const itemId = String(rawId);

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
    tipo_ocorrencia: dados.tipo_ocorrencia || null,
    sub_tipo_avaria: dados.sub_tipo_avaria || null,
    quantidade_falta: dados.quantidade_falta || null,
    reposto_reserva: dados.reposto_reserva || false,
    observacao_ocorrencia: dados.observacao_ocorrencia || null,
    conferido_por_nome: nomeUsuario,
    conferido_em: agora,
    data_conferencia: hoje,
  };

  // 1. Atualizar instantaneamente o cache local do navegador
  setLocalConferenciaItem(itemId, itemConf);

  // 2. Persistir na tabela conferencia_itens (registro diário operacional)
  try {
    const { error: confError } = await supabase
      .from('conferencia_itens')
      .upsert({
        data_conferencia: hoje,
        equipamento_id: dados.equipamento_id || null,
        material_id: dados.material_id || null,
        viatura_id: dados.viatura_id || null,
        fleet_item_id: itemId,
        status: dados.status,
        status_item: dados.status === 'ok' ? 'ok' : 'ocorrencia',
        observacao: dados.observacao || null,
        tipo_ocorrencia: dados.tipo_ocorrencia || null,
        sub_tipo_avaria: dados.sub_tipo_avaria || null,
        quantidade_falta: dados.quantidade_falta || null,
        reposto_reserva: dados.reposto_reserva || false,
        observacao_ocorrencia: dados.observacao_ocorrencia || null,
        conferido_por_id: user?.id || null,
        conferido_por_nome: nomeUsuario,
        conferido_em: agora,
      });

    if (confError) {
      // Fallback: salvar dentro do campo 'details' da tabela fleet
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

  // 3. Histórico B4 + Fila de Pendências
  if (dados.status === 'ok') {
    // Se o conferente alterou para OK no dia, verifica se existe pendência não resolvida para esse item e regulariza
    try {
      await supabase
        .from('historico_conferencias_b4')
        .update({
          resolvido: true,
          resolvido_em: agora,
          resolvido_por: `${nomeUsuario} (Conferência OK)`,
        })
        .eq('item_id', itemId)
        .eq('resolvido', false);
    } catch (e) {
      console.error('Erro ao resolver pendência prévia no OK:', e);
    }
  } else if (dados.status === 'avariado' || dados.status === 'nao_encontrado') {
    const tipoItem = dados.equipamento_id
      ? 'equipamento'
      : dados.material_id
        ? 'consumo'
        : 'viatura';

    const registroB4 = {
      data_conferencia: hoje,
      tipo_item: tipoItem,
      item_id: itemId,
      item_nome: dados.item_nome || 'Item',
      viatura_nome: dados.viatura_nome || null,
      compartimento_nome: dados.compartimento_nome || null,
      local_nome: dados.local_nome || null,
      status_conferencia: dados.status,
      observacao: dados.observacao || null,
      conferido_por_nome: nomeUsuario,
      conferido_por_id: user?.id || null,
      conferido_em: agora,
      notificacao_enviada: false,
      resolvido: false,
    };

    try {
      // Tentar upsert com fallback se unique constraint falhar
      const { error: upsertErr } = await supabase
        .from('historico_conferencias_b4')
        .upsert(registroB4, { onConflict: 'data_conferencia,item_id' });

      if (upsertErr) {
        // Fallback: tentar insert simples
        await supabase
          .from('historico_conferencias_b4')
          .insert(registroB4);
      }
    } catch (err) {
      console.error('Erro ao gravar histórico B4:', err);
    }

    // ROTEAMENTO AUTOMÁTICO:
    // 1. Caso "Sem Conserto, Deverá Baixar" -> Enviar ao submódulo Baixa Patrimônio
    if (dados.sub_tipo_avaria === 'sem_conserto_baixar') {
      try {
        await supabase
          .from('baixa_patrimonio')
          .insert({
            item_id: itemId,
            item_nome: dados.item_nome || 'Item Avariado Sem Conserto',
            tipo_item: tipoItem,
            viatura_nome: dados.viatura_nome || null,
            compartimento_nome: dados.compartimento_nome || null,
            local_nome: dados.local_nome || null,
            motivo_baixa: `Avaria sem conserto identificada na conferência diária de ${hoje}. Obs: ${dados.observacao || 'Sem observação detalhada'}`,
            status: 'pendente_baixa',
            cadastrado_por_nome: nomeUsuario,
          });
      } catch (errBaixa) {
        console.error('Erro no roteamento para Baixa Patrimônio:', errBaixa);
      }
    }

    // 2. Caso "Deverá Consertar" OU "Falta do Item" -> Enviar DIRETO ao submódulo Compras (purchases)
    if (dados.sub_tipo_avaria === 'devera_consertar' || dados.tipo_ocorrencia === 'falta' || dados.status === 'nao_encontrado') {
      try {
        const itemDesc = dados.item_nome || 'Item em Ocorrência';
        const contextoLocal = dados.viatura_nome ? ` (${dados.viatura_nome}${dados.compartimento_nome ? ` - ${dados.compartimento_nome}` : ''})` : '';
        const qtdPurch = dados.quantidade_falta || 1;
        const motivoOuTipo = dados.tipo_ocorrencia === 'falta' ? 'Falta / Não encontrado' : 'Avaria / Necessita Conserto';

        await supabase
          .from('purchases')
          .insert({
            item: `${itemDesc}${contextoLocal}`,
            quantity: qtdPurch,
            unit_price: 0,
            status: 'Pendente',
            requester: `Conferência Diária (${nomeUsuario}) - ${motivoOuTipo}`
          });
      } catch (errPurch) {
        console.error('Erro no roteamento para Compras:', errPurch);
      }
    }
  }

  return true;
}

export const NUMERO_CHEFE_SOCORRO = '554788911948';

export function formatarMensagemWhatsAppConferencia(dados: {
  dataConferencia: string;
  conferidoPor: string;
  horario: string;
  totalConferidos: number;
  totalOk: number;
  totalOcorrencias: number;
  ocorrencias: Array<{ item_nome: string; observacao: string; viatura_nome?: string; compartimento_nome?: string }>;
}): string {
  const dataFmt = new Date(dados.dataConferencia + 'T00:00:00').toLocaleDateString('pt-BR');
  
  let msg = `✅ *CONFERÊNCIA DIÁRIA — ${dataFmt}*\n\n`;
  msg += `*Realizada por:* ${dados.conferidoPor}\n`;
  msg += `*Horário:* ${dados.horario}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📋 *ITENS CONFERIDOS:* ${dados.totalConferidos}\n`;
  msg += `✅ *Itens OK:* ${dados.totalOk}\n`;
  msg += `⚠️ *Ocorrências:* ${dados.totalOcorrencias}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

  if (dados.ocorrencias.length > 0) {
    msg += `⚠️ *OCORRÊNCIAS ENCONTRADAS:*\n\n`;
    dados.ocorrencias.forEach(item => {
      const contexto = item.viatura_nome ? ` (${item.viatura_nome}${item.compartimento_nome ? ` - ${item.compartimento_nome}` : ''})` : '';
      msg += `• *${item.item_nome}*${contexto}: ${item.observacao}\n`;
    });
    msg += `\n━━━━━━━━━━━━━━━━━━━`;
  } else {
    msg += `Todos os itens foram conferidos e estão em conformidade.\n`;
    msg += `━━━━━━━━━━━━━━━━━━━`;
  }

  return msg;
}

export function enviarConferenciaWhatsApp(mensagem: string): boolean {
  try {
    const encodedText = encodeURIComponent(mensagem);
    const waUrl = `https://wa.me/${NUMERO_CHEFE_SOCORRO}?text=${encodedText}`;
    const win = window.open(waUrl, '_blank');
    return !!win;
  } catch (e) {
    console.error('Erro ao abrir WhatsApp:', e);
    return false;
  }
}
