import { supabase } from './supabase';
import { Cautela, CondicaoDevolucao, Vehicle } from './types';

export const CautelaService = {
  async getCautelas(): Promise<Cautela[]> {
    const { data, error } = await supabase
      .from('cautelas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar cautelas:', error);
      throw error;
    }
    return data || [];
  },

  async gerarProximoNumeroCautela(): Promise<string> {
    const anoAtual = new Date().getFullYear();
    const prefixo = `CAU-${anoAtual}-`;

    const { data, error } = await supabase
      .from('cautelas')
      .select('numero_cautela')
      .ilike('numero_cautela', `${prefixo}%`);

    if (error) {
      console.error('Erro ao buscar números de cautela:', error);
    }

    let maxSequencial = 0;
    if (data && data.length > 0) {
      data.forEach((c: { numero_cautela: string }) => {
        const partes = c.numero_cautela.split('-');
        if (partes.length >= 3) {
          const seq = parseInt(partes[2], 10);
          if (!isNaN(seq) && seq > maxSequencial) {
            maxSequencial = seq;
          }
        }
      });
    }

    const proximoSeq = String(maxSequencial + 1).padStart(4, '0');
    return `${prefixo}${proximoSeq}`;
  },

  async criarCautela(payload: {
    item_id: string;
    tipo_item: string;
    item_nome: string;
    solicitante: string;
    retirado_por: string;
    data_retirada: string;
    data_prevista_devolucao?: string | null;
    observacoes?: string | null;
  }): Promise<Cautela> {
    const numero_cautela = await this.gerarProximoNumeroCautela();

    const nuevaCautela = {
      numero_cautela,
      item_id: payload.item_id,
      tipo_item: payload.tipo_item || 'equipamento',
      item_nome: payload.item_nome,
      solicitante: payload.solicitante,
      retirado_por: payload.retirado_por,
      data_retirada: payload.data_retirada || new Date().toISOString(),
      data_prevista_devolucao: payload.data_prevista_devolucao || null,
      observacoes: payload.observacoes || null,
      status: 'ativo',
    };

    const { data, error } = await supabase
      .from('cautelas')
      .insert(nuevaCautela)
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar nova cautela:', error);
      throw error;
    }

    // Atualizar status do item no catálogo B4 (vehicles)
    if (payload.item_id) {
      const { error: itemError } = await supabase
        .from('vehicles')
        .update({
          status: 'cautelado',
          is_cautelado: true,
          cautela_ativa_id: data.id,
        })
        .eq('id', payload.item_id);

      if (itemError) {
        console.warn('Aviso: erro ao atualizar status do item no catálogo B4:', itemError);
      }
    }

    return data;
  },

  async registrarDevolucao(
    cautelaId: string,
    itemId: string,
    condicao: CondicaoDevolucao,
    observacoesDevolucao?: string,
    dataDevolucao?: string
  ): Promise<Cautela> {
    const dataReal = dataDevolucao || new Date().toISOString();

    const { data, error } = await supabase
      .from('cautelas')
      .update({
        status: 'devolvido',
        data_devolucao_real: dataReal,
        condicao_devolucao: condicao,
        observacoes_devolucao: observacoesDevolucao || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cautelaId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar devolução:', error);
      throw error;
    }

    // Retornar item no catálogo B4 para disponível (active)
    if (itemId) {
      const { error: itemError } = await supabase
        .from('vehicles')
        .update({
          status: 'active',
          is_cautelado: false,
          cautela_ativa_id: null,
        })
        .eq('id', itemId);

      if (itemError) {
        console.warn('Aviso: erro ao atualizar item para disponivel no catálogo B4:', itemError);
      }
    }

    return data;
  },

  async cancelarCautela(cautelaId: string, itemId: string, motivo: string): Promise<Cautela> {
    if (!motivo || !motivo.trim()) {
      throw new Error('O motivo do cancelamento é obrigatório.');
    }

    const { data, error } = await supabase
      .from('cautelas')
      .update({
        status: 'cancelado',
        motivo_cancelamento: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cautelaId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao cancelar cautela:', error);
      throw error;
    }

    // Retornar item no catálogo B4 para disponível (active)
    if (itemId) {
      const { error: itemError } = await supabase
        .from('vehicles')
        .update({
          status: 'active',
          is_cautelado: false,
          cautela_ativa_id: null,
        })
        .eq('id', itemId);

      if (itemError) {
        console.warn('Aviso: erro ao atualizar item para disponivel no catálogo B4:', itemError);
      }
    }

    return data;
  },

  async getItensDisponiveisCat(): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar catálogo de itens B4:', error);
      return [];
    }
    return data || [];
  }
};
