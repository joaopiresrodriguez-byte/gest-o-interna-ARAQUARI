import { supabase } from './supabase';
import { B3WhatsappCadastro, B3SolicitacaoApoio, StatusSolicitacaoApoio, TipoDeferimentoB3 } from './types';
import { InstructionService } from './instructionService';
import { OperationalService } from './operationalService';

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
    empresa_entidade?: string;
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
        empresa_entidade: payload.empresa_entidade || null,
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
      tipo_deferimento?: TipoDeferimentoB3;
      referencia_criada_id?: string;
    }
  ): Promise<B3SolicitacaoApoio> => {
    const updateData: Record<string, any> = {
      status: payload.status,
      parecer_gestor: payload.parecer_gestor || null,
      analisado_por: payload.analisado_por || null,
      analisado_em: new Date().toISOString(),
    };

    if (payload.tipo_deferimento) {
      updateData.tipo_deferimento = payload.tipo_deferimento;
    }
    if (payload.referencia_criada_id) {
      updateData.referencia_criada_id = payload.referencia_criada_id;
    }

    // Tentar update completo
    const { data, error } = await supabase
      .from('b3_solicitacoes_apoio')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('Tentativa com colunas estendidas falhou, tentando update básico:', error);
      // Fallback: se a migration ainda não foi rodada no Supabase remoto, atualiza só os campos base
      const basicData = {
        status: payload.status,
        parecer_gestor: payload.parecer_gestor || null,
        analisado_por: payload.analisado_por || null,
        analisado_em: new Date().toISOString(),
      };

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('b3_solicitacoes_apoio')
        .update(basicData)
        .eq('id', id)
        .select('*')
        .single();

      if (fallbackError) {
        console.error('Erro no update de status:', fallbackError);
        throw fallbackError;
      }
      return fallbackData;
    }

    return data;
  },

  /**
   * Deferir uma solicitação com integração automática:
   *  - palestra_instrucao: cria MateriaInstrucao + Training agendado
   *  - operacao_presenca: cria DailyMission agendada
   * Retorna a solicitação atualizada + id do registro criado
   */
  deferir: async (
    solicitacao: B3SolicitacaoApoio,
    tipo: TipoDeferimentoB3,
    parecer: string,
    analisadoPorId?: string
  ): Promise<{ solicitacaoAtualizada: B3SolicitacaoApoio; referenciaId: string }> => {
    const sapNum = solicitacao.numero_solicitacao || 'SAP';
    const titulo = `[${sapNum}] ${tipo === 'palestra_instrucao' ? 'Palestra' : 'Operação Presença'}: ${solicitacao.tema}`;

    let referenciaId = '';

    try {
      if (tipo === 'palestra_instrucao') {
        // 1. Criar matéria de instrução
        const novaMateria = await InstructionService.addMateriaInstrucao({
          name: titulo,
          tema: solicitacao.tema,
          credit_hours: 1,
          category: 'Extensão Comunitária',
          level: 'basico',
          description:
            `Gerado automaticamente via Solicitação de Apoio ${sapNum}.\n` +
            `Solicitante: ${solicitacao.responsavel_nome}` +
            (solicitacao.empresa_entidade ? ` — Empresa/Entidade: ${solicitacao.empresa_entidade}` : '') +
            (solicitacao.responsavel_telefone ? ` — Tel: ${solicitacao.responsavel_telefone}` : '') +
            `\nEndereço: ${solicitacao.endereco}` +
            (solicitacao.complemento ? ` — ${solicitacao.complemento}` : ''),
          instructor: solicitacao.responsavel_nome,
          notes: parecer || undefined,
          status: 'active',
        });

        if (novaMateria && novaMateria.id) {
          referenciaId = String(novaMateria.id);

          // 2. Agendar treinamento no cronograma
          await InstructionService.addTraining({
            materia_id: novaMateria.id,
            date: solicitacao.dia,
            time: solicitacao.horario,
            instructor: solicitacao.responsavel_nome,
            location: [solicitacao.endereco, solicitacao.complemento].filter(Boolean).join(' — '),
            tema: solicitacao.tema,
            status: 'Scheduled',
          });
        }
      } else {
        // Criar missão diária — Operação Presença
        const novaMissao = await OperationalService.addDailyMission({
          title: titulo,
          description:
            `Solicitante: ${solicitacao.responsavel_nome}\n` +
            (solicitacao.empresa_entidade ? `Empresa/Entidade: ${solicitacao.empresa_entidade}\n` : '') +
            (solicitacao.responsavel_telefone ? `Telefone: ${solicitacao.responsavel_telefone}\n` : '') +
            `Endereço: ${solicitacao.endereco}` +
            (solicitacao.complemento ? `\n${solicitacao.complemento}` : '') +
            `\n\nGerado automaticamente via ${sapNum}.`,
          mission_date: solicitacao.dia,
          start_time: solicitacao.horario,
          location_address: [solicitacao.endereco, solicitacao.complemento].filter(Boolean).join(' — '),
          priority: 'media',
          status: 'agendada',
          notes: parecer || undefined,
          is_pbm_araquari: true,
        });

        if (novaMissao && novaMissao.id) {
          referenciaId = String(novaMissao.id);
        }
      }
    } catch (errCriacao) {
      console.warn('Aviso: Erro ao criar item integrado (Matéria/Missão), prosseguindo com deferimento:', errCriacao);
    }

    // Validar se referenciaId é um UUID válido para não dar erro no Postgres se for string vazia
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenciaId);

    // Atualizar solicitação com tipo, referência e status deferida
    const solicitacaoAtualizada = await b3SolicitacoesService.atualizarStatusSolicitacao(
      solicitacao.id!,
      {
        status: 'deferida',
        parecer_gestor: parecer,
        analisado_por: analisadoPorId,
        tipo_deferimento: tipo,
        referencia_criada_id: isUuid ? referenciaId : undefined,
      }
    );

    return { solicitacaoAtualizada, referenciaId };
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
