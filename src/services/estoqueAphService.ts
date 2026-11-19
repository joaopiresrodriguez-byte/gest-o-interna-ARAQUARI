import { supabase } from './supabase';
import { Vehicle } from './types';

export interface MaterialEstoqueAPH {
  id: string;
  name: string;
  type: string;
  status: string;
  quantidade: number;
  unidade_medida?: string;
  categoria?: string;
  lote?: string;
  data_validade?: string;
  estoque_minimo?: number;
  estoque_ideal?: number;
  local_id?: string;
  local_nome?: string;
  details?: string;
  historico_movimentacoes?: MovimentacaoEstoqueAPH[];
}

export interface MovimentacaoEstoqueAPH {
  data: string;
  tipo: 'ENTRADA' | 'REPOSICAO_VIATURA' | 'BAIXA_AVARIA' | 'AJUSTE_INVENTARIO';
  quantidade: number;
  saldo_anterior: number;
  saldo_novo: number;
  responsavel: string;
  motivo?: string;
  viatura_nome?: string;
}

export const EstoqueAphService = {
  /**
   * Retorna os IDs dos locais de estoque de reserva (Sala de APH e Reserva de Materiais)
   */
  async getLocaisReserva(): Promise<{ idSalaAph?: string; idReservaGeral?: string; todosLocais: any[] }> {
    try {
      const { data } = await supabase
        .from('locais_equipamento')
        .select('id, nome, tipo')
        .eq('ativo', true);

      const todos = data || [];
      const salaAph = todos.find(l => (l.nome || '').toLowerCase().includes('aph'));
      const reserva = todos.find(l => (l.nome || '').toLowerCase().includes('reserva'));

      return {
        idSalaAph: salaAph?.id,
        idReservaGeral: reserva?.id,
        todosLocais: todos,
      };
    } catch (e) {
      console.error('Erro ao buscar locais de reserva:', e);
      return { todosLocais: [] };
    }
  },

  /**
   * Lista todos os materiais que estão na Sala de APH ou Reserva de Materiais
   */
  async getMateriaisEstoque(): Promise<MaterialEstoqueAPH[]> {
    try {
      const { idSalaAph, idReservaGeral } = await this.getLocaisReserva();
      const localIds = [idSalaAph, idReservaGeral].filter(Boolean) as string[];

      // Buscar de fleet
      let query = supabase
        .from('fleet')
        .select('*');

      if (localIds.length > 0) {
        query = query.or(`local_id.in.(${localIds.join(',')}),atividades.cs.{APH}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(item => {
        let meta: any = {};
        if (item.details) {
          try {
            meta = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
          } catch {
            meta = { raw: item.details };
          }
        }

        return {
          id: item.id,
          name: item.name,
          type: item.type,
          status: item.status,
          quantidade: Number(item.quantidade) || 0,
          unidade_medida: meta.unidade_medida || 'un',
          categoria: meta.categoria || (item.atividades?.includes('APH') ? 'APH' : 'Geral'),
          lote: meta.lote || '',
          data_validade: meta.data_validade || '',
          estoque_minimo: Number(meta.estoque_minimo) || 5,
          estoque_ideal: Number(meta.estoque_ideal) || 20,
          local_id: item.local_id,
          local_nome: item.location || '',
          details: item.details,
          historico_movimentacoes: meta.historico_movimentacoes || [],
        };
      });
    } catch (e) {
      console.error('Erro ao listar materiais do estoque:', e);
      return [];
    }
  },

  /**
   * Realiza a baixa automática do estoque de reserva quando um item é reposto na conferência da viatura
   */
  async debitarEstoquePorReposicao(params: {
    itemNome: string;
    quantidadeReposta: number;
    viaturaNome: string;
    responsavel: string;
  }): Promise<{ sucesso: boolean; itemEncontrado?: MaterialEstoqueAPH; saldoRestante?: number; mensagem: string }> {
    try {
      const { itemNome, quantidadeReposta, viaturaNome, responsavel } = params;
      const { idSalaAph, idReservaGeral } = await this.getLocaisReserva();
      const localIds = [idSalaAph, idReservaGeral].filter(Boolean) as string[];

      // 1. Procurar item correspondente na Sala de APH ou Reserva Central
      let query = supabase.from('fleet').select('*');
      if (localIds.length > 0) {
        query = query.in('local_id', localIds);
      }

      const { data: itensEstoque } = await query;
      if (!itensEstoque || itensEstoque.length === 0) {
        return {
          sucesso: false,
          mensagem: 'Nenhum item encontrado no estoque de reserva.',
        };
      }

      // Localizar pelo nome mais próximo
      const nomeBusca = itemNome.toLowerCase().trim();
      const itemMatch = itensEstoque.find(i => {
        const n = (i.name || '').toLowerCase().trim();
        return n === nomeBusca || n.includes(nomeBusca) || nomeBusca.includes(n);
      });

      if (!itemMatch) {
        return {
          sucesso: false,
          mensagem: `Material "${itemNome}" não foi localizado no estoque da Sala de APH/Reserva para débito automático.`,
        };
      }

      const saldoAtual = Number(itemMatch.quantidade) || 0;
      const qtdDebitar = Math.min(saldoAtual, quantidadeReposta);
      const novoSaldo = Math.max(0, saldoAtual - quantidadeReposta);

      let meta: any = {};
      if (itemMatch.details) {
        try {
          meta = typeof itemMatch.details === 'string' ? JSON.parse(itemMatch.details) : itemMatch.details;
        } catch {
          meta = { raw: itemMatch.details };
        }
      }

      const historico: MovimentacaoEstoqueAPH[] = meta.historico_movimentacoes || [];
      historico.unshift({
        data: new Date().toISOString(),
        tipo: 'REPOSICAO_VIATURA',
        quantidade: qtdDebitar,
        saldo_anterior: saldoAtual,
        saldo_novo: novoSaldo,
        responsavel,
        motivo: `Reposição realizada durante conferência da viatura ${viaturaNome}`,
        viatura_nome: viaturaNome,
      });

      meta.historico_movimentacoes = historico.slice(0, 50); // manter últimos 50

      // Atualizar saldo em fleet
      await supabase
        .from('fleet')
        .update({
          quantidade: novoSaldo,
          details: JSON.stringify(meta),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemMatch.id);

      // Também sincronizar em checklist_items se o item de estoque estiver cadastrado lá
      try {
        await supabase
          .from('checklist_items')
          .update({
            quantidade: novoSaldo,
            updated_at: new Date().toISOString(),
          })
          .eq('item_name', itemMatch.name)
          .in('viatura_id', localIds);
      } catch (eCheck) {
        console.warn('Atualização complementar em checklist_items reserva:', eCheck);
      }

      // Se o novo saldo atingir ou ficar abaixo do estoque mínimo, dispara alerta
      const estMinimo = Number(meta.estoque_minimo) || 5;
      if (novoSaldo <= estMinimo) {
        await this.gerarAvisoEstoqueCritico({
          itemNome: itemMatch.name,
          saldoAtual: novoSaldo,
          estoqueMinimo: estMinimo,
          localNome: itemMatch.location || 'Sala de APH',
        });
      }

      return {
        sucesso: true,
        itemEncontrado: {
          ...itemMatch,
          quantidade: novoSaldo,
        },
        saldoRestante: novoSaldo,
        mensagem: `Estoque da Reserva atualizado: ${itemMatch.name} (Saldo: ${novoSaldo}).`,
      };
    } catch (e: any) {
      console.error('Erro ao debitar estoque por reposição:', e);
      return {
        sucesso: false,
        mensagem: 'Erro ao debitar estoque: ' + (e?.message || e),
      };
    }
  },

  /**
   * Adiciona entrada ou ajusta material no estoque da Sala de APH
   */
  async movimentarEstoque(params: {
    itemId: string;
    tipo: 'ENTRADA' | 'AJUSTE_INVENTARIO' | 'BAIXA_AVARIA';
    quantidade: number;
    motivo: string;
    responsavel: string;
    lote?: string;
    dataValidade?: string;
    estoqueMinimo?: number;
    estoqueIdeal?: number;
  }): Promise<boolean> {
    try {
      const { itemId, tipo, quantidade, motivo, responsavel, lote, dataValidade, estoqueMinimo, estoqueIdeal } = params;

      const { data: item } = await supabase
        .from('fleet')
        .select('*')
        .eq('id', itemId)
        .single();

      if (!item) return false;

      const saldoAtual = Number(item.quantidade) || 0;
      let novoSaldo = saldoAtual;

      if (tipo === 'ENTRADA') novoSaldo = saldoAtual + quantidade;
      else if (tipo === 'BAIXA_AVARIA') novoSaldo = Math.max(0, saldoAtual - quantidade);
      else if (tipo === 'AJUSTE_INVENTARIO') novoSaldo = Math.max(0, quantidade);

      let meta: any = {};
      if (item.details) {
        try {
          meta = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
        } catch {
          meta = { raw: item.details };
        }
      }

      if (lote !== undefined) meta.lote = lote;
      if (dataValidade !== undefined) meta.data_validade = dataValidade;
      if (estoqueMinimo !== undefined) meta.estoque_minimo = estoqueMinimo;
      if (estoqueIdeal !== undefined) meta.estoque_ideal = estoqueIdeal;

      const historico: MovimentacaoEstoqueAPH[] = meta.historico_movimentacoes || [];
      historico.unshift({
        data: new Date().toISOString(),
        tipo,
        quantidade,
        saldo_anterior: saldoAtual,
        saldo_novo: novoSaldo,
        responsavel,
        motivo,
      });
      meta.historico_movimentacoes = historico.slice(0, 50);

      await supabase
        .from('fleet')
        .update({
          quantidade: novoSaldo,
          details: JSON.stringify(meta),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      return true;
    } catch (e) {
      console.error('Erro ao movimentar estoque:', e);
      return false;
    }
  },

  /**
   * Dispara aviso em pending_notices e gera pedido em purchases quando atinge estoque crítico
   */
  async gerarAvisoEstoqueCritico(dados: {
    itemNome: string;
    saldoAtual: number;
    estoqueMinimo: number;
    localNome: string;
  }) {
    try {
      const descAviso = `🚨 ESTOQUE CRÍTICO: O material "${dados.itemNome}" no local "${dados.localNome}" atingiu ${dados.saldoAtual} un (mínimo de segurança: ${dados.estoqueMinimo} un). Necessária reposição.`;

      // 1. Criar pending_notice
      await supabase.from('pending_notices').insert({
        type: 'material',
        target_module: 'B4',
        description: descAviso,
        status: 'pendente',
      });

      // 2. Criar solicitação de compra em purchases
      const qtdComprar = Math.max(1, (dados.estoqueMinimo * 2) - dados.saldoAtual);
      await supabase.from('purchases').insert({
        item: `${dados.itemNome} (Reposição Estoque Crítico ${dados.localNome})`,
        quantity: qtdComprar,
        unit_price: 0,
        status: 'Pendente',
        requester: 'Sistema Automático - Ponto de Pedido Estoque APH/B4',
      });
    } catch (e) {
      console.error('Erro ao registrar aviso de estoque crítico:', e);
    }
  },

  /**
   * Varre materiais com validade e retorna itens vencidos ou a vencer em 30 dias
   */
  async verificarValidadesMateriais(): Promise<{ vencidos: MaterialEstoqueAPH[]; aVencer: MaterialEstoqueAPH[] }> {
    const materiais = await this.getMateriaisEstoque();
    const hoje = new Date().toISOString().split('T')[0];
    const limite30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const vencidos: MaterialEstoqueAPH[] = [];
    const aVencer: MaterialEstoqueAPH[] = [];

    materiais.forEach(m => {
      if (!m.data_validade) return;
      if (m.data_validade < hoje) {
        vencidos.push(m);
      } else if (m.data_validade <= limite30Dias) {
        aVencer.push(m);
      }
    });

    return { vencidos, aVencer };
  },
};
