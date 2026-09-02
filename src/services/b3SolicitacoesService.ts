import { supabase } from './supabase';
import { B3WhatsappCadastro, B3SolicitacaoApoio, StatusSolicitacaoApoio } from './types';

export const b3SolicitacoesService = {
  // ==================== CADASTROS WHATSAPP ====================

  listarCadastrosWhatsapp: async (): Promise<B3WhatsappCadastro[]> => {
    const { data, error } = await supabase
      .from('b3_whatsapp_cadastros')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  cadastrarWhatsapp: async (payload: {
    numero: string;
    nome_contato?: string;
    descricao?: string;
    cadastrado_por?: string;
  }): Promise<B3WhatsappCadastro> => {
    // Tratar número removendo caracteres não numéricos
    const numeroLimpo = payload.numero.replace(/\D/g, '');

    const { data, error } = await supabase
      .from('b3_whatsapp_cadastros')
      .insert({
        numero: numeroLimpo,
        nome_contato: payload.nome_contato || null,
        descricao: payload.descricao || null,
        cadastrado_por: payload.cadastrado_por || null,
        ativo: true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  toggleAtivoWhatsapp: async (id: string, ativo: boolean): Promise<void> => {
    const { error } = await supabase
      .from('b3_whatsapp_cadastros')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  },

  buscarCadastroPorToken: async (token: string): Promise<B3WhatsappCadastro | null> => {
    const { data, error } = await supabase
      .from('b3_whatsapp_cadastros')
      .select('*')
      .eq('token_link', token)
      .single();

    if (error) return null;
    return data;
  },

  // ==================== SOLICITAÇÕES DE APOIO ====================

  enviarSolicitacaoPublica: async (payload: {
    whatsapp_origem_id: string;
    responsavel_nome: string;
    responsavel_telefone?: string;
    tema: string;
    dia: string;
    horario: string;
    endereco: string;
    complemento?: string;
  }): Promise<B3SolicitacaoApoio> => {
    const { data, error } = await supabase
      .from('b3_solicitacoes_apoio')
      .insert({
        whatsapp_origem_id: payload.whatsapp_origem_id,
        responsavel_nome: payload.responsavel_nome,
        responsavel_telefone: payload.responsavel_telefone || null,
        tema: payload.tema,
        dia: payload.dia,
        horario: payload.horario,
        endereco: payload.endereco,
        complemento: payload.complemento || null,
        status: 'pendente',
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  listarSolicitacoesGestor: async (filtros?: {
    status?: StatusSolicitacaoApoio;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<B3SolicitacaoApoio[]> => {
    let query = supabase
      .from('b3_solicitacoes_apoio')
      .select(`
        *,
        whatsapp_origem:whatsapp_origem_id (
          id,
          numero,
          nome_contato
        )
      `)
      .order('criado_em', { ascending: false });

    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros?.dataInicio) {
      query = query.gte('dia', filtros.dataInicio);
    }
    if (filtros?.dataFim) {
      query = query.lte('dia', filtros.dataFim);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  atualizarStatusSolicitacao: async (
    id: string,
    payload: {
      status: StatusSolicitacaoApoio;
      parecer_gestor?: string;
      analisado_por?: string;
    }
  ): Promise<B3SolicitacaoApoio> => {
    const { data, error } = await supabase
      .from('b3_solicitacoes_apoio')
      .update({
        status: payload.status,
        parecer_gestor: payload.parecer_gestor || null,
        analisado_por: payload.analisado_por || null,
        analisado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  obterTotaisResumo: async () => {
    const { data, error } = await supabase
      .from('b3_solicitacoes_apoio')
      .select('status, criado_em');

    if (error) throw error;

    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    let pendente = 0;
    let em_analise = 0;
    let deferida = 0;
    let indeferida = 0;

    (data || []).forEach(item => {
      const dataCriacao = new Date(item.criado_em);
      if (dataCriacao.getMonth() === mesAtual && dataCriacao.getFullYear() === anoAtual) {
        if (item.status === 'pendente') pendente++;
        else if (item.status === 'em_analise') em_analise++;
        else if (item.status === 'deferida') deferida++;
        else if (item.status === 'indeferida') indeferida++;
      }
    });

    return { pendente, em_analise, deferida, indeferida };
  }
};
