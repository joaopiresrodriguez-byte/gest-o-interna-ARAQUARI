import { supabase } from './supabase';
import { BcCiclo, BcIntencao, BcSelecionado, Personnel } from './types';

export const BC_DURACAO_MENSAGEM_ERRO = "O serviço deve ter duração de exatamente 12 horas ou 24 horas. Ajuste os horários e tente novamente.";

export const bcEscalaService = {
  /**
   * BLOCO 2 — Validação de Carga Horária (12h ou 24h exatas)
   */
  validarHoras: (inicio: string, fim: string): { totalHoras: number; valido: boolean; mensagem?: string } => {
    if (!inicio || !fim) {
      return { totalHoras: 0, valido: false, mensagem: BC_DURACAO_MENSAGEM_ERRO };
    }

    const [hIni, mIni] = inicio.split(':').map(Number);
    const [hFim, mFim] = fim.split(':').map(Number);

    if (isNaN(hIni) || isNaN(mIni) || isNaN(hFim) || isNaN(mFim)) {
      return { totalHoras: 0, valido: false, mensagem: BC_DURACAO_MENSAGEM_ERRO };
    }

    let minutosInicio = hIni * 60 + mIni;
    let minutosFim = hFim * 60 + mFim;

    if (minutosFim <= minutosInicio) {
      // Virou o dia (ex: 19:00 às 07:00 ou 07:00 às 07:00)
      minutosFim += 24 * 60;
    }

    const diffMinutos = minutosFim - minutosInicio;
    const totalHoras = diffMinutos / 60;

    const eh12h = Math.abs(totalHoras - 12) < 0.01;
    const eh24h = Math.abs(totalHoras - 24) < 0.01;

    if (!eh12h && !eh24h) {
      return { totalHoras, valido: false, mensagem: BC_DURACAO_MENSAGEM_ERRO };
    }

    return { totalHoras, valido: true };
  },

  /**
   * Helper para gerar tokens únicos
   */
  gerarToken: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  /**
   * BLOCO 3 — Disparo Automático / Abertura de Ciclo
   */
  obterOuCriarCiclo: async (mesRef?: string): Promise<BcCiclo> => {
    const agora = new Date();
    // Se não passado mesRef, assume o próximo mês se hoje >= dia 20, ou o mês atual
    let targetAno = agora.getFullYear();
    let targetMes = agora.getMonth() + 1; // 1-12

    if (!mesRef) {
      if (agora.getDate() >= 20) {
        targetMes += 1;
        if (targetMes > 12) {
          targetMes = 1;
          targetAno += 1;
        }
      }
      mesRef = `${targetAno}-${String(targetMes).padStart(2, '0')}`;
    }

    const { data: existente } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    if (existente) {
      return existente as BcCiclo;
    }

    // Criar novo ciclo (abertura dia 20, encerramento dia 25 às 23:59:59)
    const [anoStr, mesStr] = mesRef.split('-');
    const dataAbertura = new Date(Number(anoStr), Number(mesStr) - 2, 20, 0, 0, 0); // Dia 20 do mês anterior
    const dataEncerramento = new Date(Number(anoStr), Number(mesStr) - 2, 25, 23, 59, 59); // Dia 25 23:59 do mês anterior

    const novoCiclo = {
      mes_referencia: mesRef,
      data_abertura: dataAbertura.toISOString(),
      data_encerramento: dataEncerramento.toISOString(),
      status: 'aberto',
    };

    const { data: criado, error } = await supabase
      .from('bc_ciclos')
      .insert(novoCiclo)
      .select()
      .single();

    if (error) throw error;
    return criado as BcCiclo;
  },

  /**
   * BLOCO 4 — Busca de Dados por Token Acesso
   */
  buscarDadosPorToken: async (token: string): Promise<{
    bombeiro: Personnel;
    ciclo: BcCiclo;
    intencoes: BcIntencao[];
    expirado: boolean;
    diasRestantes: number;
  }> => {
    if (!token) throw new Error('Token não fornecido');

    // Buscar intenção de amostra para identificar o bombeiro e ciclo
    const { data: intencaoAmostra, error: errInt } = await supabase
      .from('bc_intencoes')
      .select('*, personnel(*)')
      .eq('token_acesso', token)
      .limit(1)
      .maybeSingle();

    if (errInt || !intencaoAmostra) {
      throw new Error('Token inválido ou não encontrado.');
    }

    const bombeiroId = intencaoAmostra.bombeiro_id;
    const mesRef = intencaoAmostra.mes_referencia;

    // Buscar bombeiro
    const { data: bombeiro, error: errBomb } = await supabase
      .from('personnel')
      .select('*')
      .eq('id', bombeiroId)
      .single();

    if (errBomb || !bombeiro) throw new Error('Bombeiro não encontrado.');

    // Buscar ciclo
    const { data: ciclo, error: errCiclo } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .single();

    if (errCiclo || !ciclo) throw new Error('Ciclo de escala não encontrado.');

    // Buscar todas as intenções salvas para este bombeiro neste mês
    const { data: intencoes } = await supabase
      .from('bc_intencoes')
      .select('*')
      .eq('bombeiro_id', bombeiroId)
      .eq('mes_referencia', mesRef);

    // Calcular expiração (dia 25 às 23:59:59)
    const agora = new Date();
    const dataEnc = new Date(ciclo.data_encerramento);
    const expirado = ciclo.status !== 'aberto' || agora > dataEnc;

    const diffTime = dataEnc.getTime() - agora.getTime();
    const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      bombeiro: bombeiro as Personnel,
      ciclo: ciclo as BcCiclo,
      intencoes: (intencoes || []) as BcIntencao[],
      expirado,
      diasRestantes,
    };
  },

  /**
   * BLOCO 4 — Salvar / Editar Intenções
   */
  salvarIntencoesPorToken: async (
    token: string,
    novasIntencoes: Array<{ dia: string; horario_inicio: string; horario_fim: string }>
  ): Promise<{ ok: boolean; quantidade: number }> => {
    const { bombeiro, ciclo, expirado } = await bcEscalaService.buscarDadosPorToken(token);

    if (expirado) {
      throw new Error('O prazo de 5 dias foi encerrado. Não é mais possível registrar ou alterar intenções para este mês.');
    }

    // Validar todas as intenções antes de salvar
    for (const item of novasIntencoes) {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      if (!v.valido) {
        throw new Error(`Dia ${item.dia}: ${v.mensagem}`);
      }
    }

    // Remover intenções anteriores do mesmo bombeiro no mês
    await supabase
      .from('bc_intencoes')
      .delete()
      .eq('bombeiro_id', bombeiro.id)
      .eq('mes_referencia', ciclo.mes_referencia);

    if (novasIntencoes.length === 0) {
      return { ok: true, quantidade: 0 };
    }

    // Inserir novas intenções
    const records = novasIntencoes.map(item => {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      return {
        bombeiro_id: bombeiro.id,
        mes_referencia: ciclo.mes_referencia,
        dia: item.dia,
        horario_inicio: item.horario_inicio,
        horario_fim: item.horario_fim,
        total_horas: v.totalHoras,
        status: 'pendente',
        token_acesso: token,
      };
    });

    const { error: errIns } = await supabase
      .from('bc_intencoes')
      .insert(records);

    if (errIns) throw errIns;

    return { ok: true, quantidade: records.length };
  },

  /**
   * BLOCO 5 & 6 — Encerramento de Ciclo e Motor de Seleção
   */
  rodarMotorSelecao: async (mesRef: string): Promise<{ processados: number; diasComEscala: number }> => {
    // 1. Atualizar ciclo para encerrado/processado
    await supabase
      .from('bc_ciclos')
      .update({ status: 'processado' })
      .eq('mes_referencia', mesRef);

    // 2. Buscar todas as intenções do mês
    const { data: intencoes, error: errInt } = await supabase
      .from('bc_intencoes')
      .select('*, personnel(*)')
      .eq('mes_referencia', mesRef);

    if (errInt) throw errInt;
    if (!intencoes || intencoes.length === 0) {
      return { processados: 0, diasComEscala: 0 };
    }

    // Limpar seleções anteriores do mês (se houver re-processamento)
    const { data: intencaoDias } = await supabase
      .from('bc_intencoes')
      .select('dia')
      .eq('mes_referencia', mesRef);

    const diasUnicos = Array.from(new Set((intencaoDias || []).map(i => i.dia))).sort();

    if (diasUnicos.length > 0) {
      await supabase
        .from('bc_selecionados')
        .delete()
        .in('dia', diasUnicos);
    }

    let totalSelecionados = 0;

    // Agrupar intenções por dia
    for (const dia of diasUnicos) {
      const intencoesDoDia = intencoes.filter(i => i.dia === dia);
      if (intencoesDoDia.length === 0) continue;

      // Ordenar candidatos conforme CRITÉRIOS DE PRIORIDADE
      // CRITÉRIO 1 — ÚLTIMA PROMOÇÃO (Mais antiga tem prioridade)
      // CRITÉRIO 2 — CNH D E CVE ATIVO (Simultaneamente possuem prioridade)
      // CRITÉRIO 3 — DATA DE INCLUSÃO (Mais antiga tem prioridade)
      const candidatosOrdenados = [...intencoesDoDia].sort((a, b) => {
        const bombA: Personnel = a.personnel;
        const bombB: Personnel = b.personnel;

        // --- CRITÉRIO 1: Data última promoção mais antiga ---
        const dtPromA = bombA.data_ultima_promocao ? new Date(bombA.data_ultima_promocao).getTime() : Infinity;
        const dtPromB = bombB.data_ultima_promocao ? new Date(bombB.data_ultima_promocao).getTime() : Infinity;

        if (dtPromA !== dtPromB) {
          return dtPromA - dtPromB; // Menor timestamp = data mais antiga = prioridade
        }

        // --- CRITÉRIO 2: CNH D E CVE ATIVO ---
        const cnhDA = bombA.cnh_category?.toUpperCase().includes('D') ?? false;
        const cveAtivoA = ['SIM', 'ATIVO'].includes(bombA.cve_active?.toUpperCase() || '');
        const req2A = cnhDA && cveAtivoA;

        const cnhDB = bombB.cnh_category?.toUpperCase().includes('D') ?? false;
        const cveAtivoB = ['SIM', 'ATIVO'].includes(bombB.cve_active?.toUpperCase() || '');
        const req2B = cnhDB && cveAtivoB;

        if (req2A !== req2B) {
          return req2A ? -1 : 1; // Prioridade para quem tem ambos os requisitos
        }

        // --- CRITÉRIO 3: Data de inclusão mais antiga ---
        const dtIncA = bombA.data_inclusao ? new Date(bombA.data_inclusao).getTime() : Infinity;
        const dtIncB = bombB.data_inclusao ? new Date(bombB.data_inclusao).getTime() : Infinity;

        return dtIncA - dtIncB; // Menor timestamp = data mais antiga = prioridade
      });

      // Gravar ranking em bc_selecionados
      const registrosSelecionados = candidatosOrdenados.map((item, index) => {
        const bomb: Personnel = item.personnel;

        const dtPromA = bomb.data_ultima_promocao ? new Date(bomb.data_ultima_promocao).toLocaleDateString('pt-BR') : 'N/I';
        let descCriterio = `Critério 1 (Promoção: ${dtPromA})`;
        const cnhD = bomb.cnh_category?.toUpperCase().includes('D');
        const cve = ['SIM', 'ATIVO'].includes(bomb.cve_active?.toUpperCase() || '');

        if (cnhD && cve) {
          descCriterio += ' + CNH D & CVE Ativo';
        }
        if (bomb.data_inclusao) {
          descCriterio += ` + Inc: ${new Date(bomb.data_inclusao).toLocaleDateString('pt-BR')}`;
        }

        return {
          bombeiro_id: item.bombeiro_id,
          dia: item.dia,
          horario_inicio: item.horario_inicio,
          horario_fim: item.horario_fim,
          total_horas: item.total_horas,
          criterio_aplicado: descCriterio,
          posicao_ranking: index + 1,
          notificado: false,
        };
      });

      const { error: errInsSel } = await supabase
        .from('bc_selecionados')
        .insert(registrosSelecionados);

      if (errInsSel) throw errInsSel;
      totalSelecionados += registrosSelecionados.length;
    }

    return { processados: totalSelecionados, diasComEscala: diasUnicos.length };
  },

  /**
   * BLOCO 7 — Painel de Revisão para o Gestor
   */
  buscarDadosPainelGestor: async (mesRef: string) => {
    // Buscar ciclo
    const { data: ciclo } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    // Buscar todos os bombeiros BC ativos
    const { data: bcsAtivos } = await supabase
      .from('personnel')
      .select('*')
      .eq('type', 'BC')
      .order('name');

    // Buscar intenções do mês
    const { data: intencoes } = await supabase
      .from('bc_intencoes')
      .select('*, personnel(*)')
      .eq('mes_referencia', mesRef);

    // Buscar selecionados
    const { data: selecionados } = await supabase
      .from('bc_selecionados')
      .select('*, personnel(*)')
      .order('dia')
      .order('posicao_ranking');

    // Filtrar selecionados do mês de referência
    const selecionadosMes = (selecionados || []).filter(s => s.dia.startsWith(mesRef));

    return {
      ciclo: ciclo as BcCiclo | null,
      bcsAtivos: (bcsAtivos || []) as Personnel[],
      intencoes: (intencoes || []) as BcIntencao[],
      selecionados: selecionadosMes as (BcSelecionado & { personnel?: Personnel })[],
    };
  },

  /**
   * BLOCO 7 — Ações Manuais do Gestor
   */
  substituirBombeiro: async (
    selecionadoId: string,
    novoBombeiroId: number,
    motivo: string
  ) => {
    const { data: atual } = await supabase
      .from('bc_selecionados')
      .select('*')
      .eq('id', selecionadoId)
      .single();

    if (!atual) throw new Error('Registro não encontrado');

    const { error } = await supabase
      .from('bc_selecionados')
      .update({
        bombeiro_id: novoBombeiroId,
        criterio_aplicado: `Substituição Manual Gestor: ${motivo}`,
        substituido_por_gestor: true,
        motivo_substituicao: motivo,
      })
      .eq('id', selecionadoId);

    if (error) throw error;
  },

  adicionarExcecaoBombeiro: async (
    dia: string,
    bombeiroId: number,
    horarioInicio: string,
    horarioFim: string
  ) => {
    const v = bcEscalaService.validarHoras(horarioInicio, horarioFim);
    if (!v.valido) throw new Error(v.mensagem);

    const record = {
      bombeiro_id: bombeiroId,
      dia,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      total_horas: v.totalHoras,
      criterio_aplicado: 'Inserção Manual Gestor (Exceção)',
      posicao_ranking: 99,
      notificado: false,
      substituido_por_gestor: true,
    };

    const { error } = await supabase
      .from('bc_selecionados')
      .insert(record);

    if (error) throw error;
  },

  removerSelecionado: async (selecionadoId: string) => {
    const { error } = await supabase
      .from('bc_selecionados')
      .delete()
      .eq('id', selecionadoId);

    if (error) throw error;
  },

  /**
   * BLOCO 7 & 8 — Publicar Escala & Disparar Notificações WhatsApp
   */
  publicarEscala: async (mesRef: string): Promise<{ publicadas: number }> => {
    // 1. Atualizar ciclo para publicado
    await supabase
      .from('bc_ciclos')
      .update({ status: 'publicado' })
      .eq('mes_referencia', mesRef);

    // 2. Buscar selecionados do mês
    const { data: selecionados } = await supabase
      .from('bc_selecionados')
      .select('*, personnel(*)')
      .order('dia');

    const selecionadosMes = (selecionados || []).filter(s => s.dia.startsWith(mesRef));

    if (selecionadosMes.length === 0) {
      return { publicadas: 0 };
    }

    // 3. Inserir ou atualizar na tabela `escalas` do sistema para cada dia
    // Agrupar por dia
    const porDia: Record<string, number[]> = {};
    selecionadosMes.forEach(s => {
      if (!porDia[s.dia]) porDia[s.dia] = [];
      if (!porDia[s.dia].includes(s.bombeiro_id)) {
        porDia[s.dia].push(s.bombeiro_id);
      }
    });

    for (const [dia, militarIds] of Object.entries(porDia)) {
      const { data: escalaExistente } = await supabase
        .from('escalas')
        .select('*')
        .eq('data', dia)
        .maybeSingle();

      if (escalaExistente) {
        // Merge militares
        const novosMils = Array.from(new Set([...(escalaExistente.militares || []), ...militarIds]));
        await supabase
          .from('escalas')
          .update({ militares: novosMils, updated_at: new Date().toISOString() })
          .eq('id', escalaExistente.id);
      } else {
        await supabase
          .from('escalas')
          .insert({
            data: dia,
            equipe: 'BC',
            militares: militarIds,
            shift_type: '12x36',
          });
      }
    }

    // 4. Disparar notificações via Edge Function ou Z-API
    // Marcar como notificado em bc_selecionados
    const idsSel = selecionadosMes.map(s => s.id);
    await supabase
      .from('bc_selecionados')
      .update({ notificado: true })
      .in('id', idsSel);

    return { publicadas: selecionadosMes.length };
  }
};
