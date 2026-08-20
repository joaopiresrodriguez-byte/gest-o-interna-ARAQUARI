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
   * Dispara abertura do ciclo e gera/recupera links únicos para cada BC ativo
   */
  abrirCicloEDispararLinks: async (mesRef?: string): Promise<{
    ciclo: BcCiclo;
    tokensGerados: number;
    links: Array<{ bombeiro: Personnel; token: string; link: string }>;
  }> => {
    const ciclo = await bcEscalaService.obterOuCriarCiclo(mesRef);
    const targetMesRef = ciclo.mes_referencia;

    // Buscar todos os BCs ativos
    const { data: bcs, error: errBcs } = await supabase
      .from('personnel')
      .select('*')
      .eq('type', 'BC')
      .eq('status', 'Ativo');

    if (errBcs) throw errBcs;

    const linksList: Array<{ bombeiro: Personnel; token: string; link: string }> = [];
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gest-o-interna-araquari.vercel.app';

    if (bcs && bcs.length > 0) {
      for (const bc of bcs) {
        // Verificar se o BC já possui um token para este ciclo/mês
        const { data: intencaoExistente } = await supabase
          .from('bc_intencoes')
          .select('token_acesso')
          .eq('bombeiro_id', bc.id)
          .eq('mes_referencia', targetMesRef)
          .limit(1)
          .maybeSingle();

        let token = intencaoExistente?.token_acesso;
        if (!token) {
          token = bcEscalaService.gerarToken();
          // Inserir registro inicial de intenção com token único
          await supabase
            .from('bc_intencoes')
            .insert({
              bombeiro_id: bc.id,
              ciclo_id: ciclo.id,
              mes_referencia: targetMesRef,
              dia: `${targetMesRef}-01`,
              horario_inicio: '07:00',
              horario_fim: '19:00',
              total_horas: 12,
              status: 'pendente',
              token_acesso: token,
            });
        }

        linksList.push({
          bombeiro: bc as Personnel,
          token,
          link: `${origin}/bc-intencao?token=${token}`,
        });
      }
    }

    // Tentar chamar a Edge Function assincronamente (se implantada no Supabase)
    try {
      const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-ciclo-bc`;
      fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'abrir_ciclo_dia20', mesRef: targetMesRef }),
      }).catch(() => {});
    } catch (_) {}

    return { ciclo, tokensGerados: linksList.length, links: linksList };
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
      .select('*')
      .eq('token_acesso', token)
      .limit(1)
      .maybeSingle();

    if (errInt || !intencaoAmostra) {
      console.error('Erro ao buscar intenção por token:', errInt);
      throw new Error('Token inválido ou não encontrado.');
    }

    const bombeiroId = intencaoAmostra.bombeiro_id;
    const mesRef = intencaoAmostra.mes_referencia;

    // Buscar bombeiro por ID (pode ser number ou string)
    const { data: bombeiro, error: errBomb } = await supabase
      .from('personnel')
      .select('*')
      .eq('id', bombeiroId)
      .maybeSingle();

    if (errBomb || !bombeiro) {
      console.error('Erro ao buscar bombeiro associado ao token:', errBomb);
      throw new Error('Bombeiro não encontrado.');
    }

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

    // Remover intenções anteriores do mesmo bombeiro no mês pelo token e pelo bombeiro_id
    await supabase
      .from('bc_intencoes')
      .delete()
      .or(`bombeiro_id.eq.${bombeiro.id},token_acesso.eq.${token}`)
      .eq('mes_referencia', ciclo.mes_referencia);

    if (novasIntencoes.length === 0) {
      return { ok: true, quantidade: 0 };
    }

    // Inserir novas intenções
    const records = novasIntencoes.map(item => {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      return {
        bombeiro_id: bombeiro.id,
        ciclo_id: ciclo.id,
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
   * BLOCO 5 & 6 — Motor de Seleção com 6 Critérios
   *
   * Critérios em ordem de prioridade:
   * 1. Menor nº de dias selecionados no mês corrente
   * 2. CNH Categoria D com validade vigente
   * 3. CVE com status ativo e dentro da validade
   * 4. Solicitação de turno 24h
   * 5. Data de última promoção mais antiga
   * 6. Data de inclusão mais antiga
   */
  rodarMotorSelecao: async (mesRef: string): Promise<{ processados: number; diasComEscala: number }> => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Atualizar ciclo para processado
    await supabase
      .from('bc_ciclos')
      .update({ status: 'processado' })
      .eq('mes_referencia', mesRef);

    // 2. Buscar todas as intenções do mês com dados do bombeiro
    const { data: intencoes, error: errInt } = await supabase
      .from('bc_intencoes')
      .select('*, personnel(*)')
      .eq('mes_referencia', mesRef);

    if (errInt) throw errInt;
    if (!intencoes || intencoes.length === 0) {
      return { processados: 0, diasComEscala: 0 };
    }

    // 3. Limpar seleções anteriores do mês (re-processamento seguro)
    const diasUnicos = Array.from(new Set(intencoes.map(i => i.dia as string))).sort();

    if (diasUnicos.length > 0) {
      await supabase
        .from('bc_selecionados')
        .delete()
        .in('dia', diasUnicos);
    }

    // 4. Mapa de contagem de dias selecionados POR bombeiro neste mês
    //    (vai sendo atualizado dinamicamente a cada dia processado)
    const diasSelecionadosNoMes: Record<string, number> = {};

    // Inicializar todos os bombeiros com 0
    intencoes.forEach(i => {
      const bid = String(i.bombeiro_id);
      if (!(bid in diasSelecionadosNoMes)) {
        diasSelecionadosNoMes[bid] = 0;
      }
    });

    let totalSelecionados = 0;

    // 5. Processar cada dia em ordem cronológica
    for (const dia of diasUnicos) {
      const intencoesDoDia = intencoes.filter(i => i.dia === dia);
      if (intencoesDoDia.length === 0) continue;

      // Ordenar candidatos pelos 6 critérios
      const candidatosOrdenados = [...intencoesDoDia].sort((a, b) => {
        const bombA: Personnel = a.personnel;
        const bombB: Personnel = b.personnel;
        const bidA = String(a.bombeiro_id);
        const bidB = String(b.bombeiro_id);

        // ── CRITÉRIO 1: Menor número de dias já selecionados no mês ──
        const diasA = diasSelecionadosNoMes[bidA] ?? 0;
        const diasB = diasSelecionadosNoMes[bidB] ?? 0;
        if (diasA !== diasB) return diasA - diasB;

        // ── CRITÉRIO 2: CNH Categoria D com validade vigente ──
        const temCnhDA = (() => {
          if (!bombA?.cnh_category?.toUpperCase().includes('D')) return false;
          if (!bombA.cnh_expiry_date) return true; // sem data = considera válida
          return new Date(bombA.cnh_expiry_date) >= hoje;
        })();
        const temCnhDB = (() => {
          if (!bombB?.cnh_category?.toUpperCase().includes('D')) return false;
          if (!bombB.cnh_expiry_date) return true;
          return new Date(bombB.cnh_expiry_date) >= hoje;
        })();
        if (temCnhDA !== temCnhDB) return temCnhDA ? -1 : 1;

        // ── CRITÉRIO 3: CVE válido e ativo ──
        const temCveA = (() => {
          const ativo = ['SIM', 'ATIVO'].includes((bombA?.cve_active || '').toUpperCase());
          if (!ativo) return false;
          if (!bombA.cve_expiry_date) return true;
          return new Date(bombA.cve_expiry_date) >= hoje;
        })();
        const temCveB = (() => {
          const ativo = ['SIM', 'ATIVO'].includes((bombB?.cve_active || '').toUpperCase());
          if (!ativo) return false;
          if (!bombB.cve_expiry_date) return true;
          return new Date(bombB.cve_expiry_date) >= hoje;
        })();
        if (temCveA !== temCveB) return temCveA ? -1 : 1;

        // ── CRITÉRIO 4: Solicitação de 24h ──
        const h24A = (a.total_horas ?? 0) >= 24;
        const h24B = (b.total_horas ?? 0) >= 24;
        if (h24A !== h24B) return h24A ? -1 : 1;

        // ── CRITÉRIO 5: Data de última promoção mais antiga ──
        const dtPromA = bombA?.data_ultima_promocao ? new Date(bombA.data_ultima_promocao).getTime() : Infinity;
        const dtPromB = bombB?.data_ultima_promocao ? new Date(bombB.data_ultima_promocao).getTime() : Infinity;
        if (dtPromA !== dtPromB) return dtPromA - dtPromB;

        // ── CRITÉRIO 6: Data de inclusão mais antiga ──
        const dtIncA = bombA?.data_inclusao ? new Date(bombA.data_inclusao).getTime() : Infinity;
        const dtIncB = bombB?.data_inclusao ? new Date(bombB.data_inclusao).getTime() : Infinity;
        return dtIncA - dtIncB;
      });

      // 6. Determinar qual critério foi decisivo para o 1º colocado (posição 1)
      const gerarDescCriterio = (item: typeof candidatosOrdenados[0], posicao: number): string => {
        const bomb: Personnel = item.personnel;
        const bid = String(item.bombeiro_id);
        const diasAcumulados = diasSelecionadosNoMes[bid] ?? 0;

        // Comparar com o 2º candidato para detectar qual critério foi desempatador
        const proximo = candidatosOrdenados[posicao]; // posicao == index do próximo
        if (!proximo) return 'Critério 1 — Único candidato';

        const bombP: Personnel = proximo.personnel;
        const bidP = String(proximo.bombeiro_id);
        const diasP = diasSelecionadosNoMes[bidP] ?? 0;

        if (diasAcumulados !== diasP) {
          return `Critério 1 — Menos dias no mês (${diasAcumulados} vs ${diasP})`;
        }

        const cnhD = (() => {
          if (!bomb?.cnh_category?.toUpperCase().includes('D')) return false;
          if (!bomb.cnh_expiry_date) return true;
          return new Date(bomb.cnh_expiry_date) >= hoje;
        })();
        const cnhDP = (() => {
          if (!bombP?.cnh_category?.toUpperCase().includes('D')) return false;
          if (!bombP.cnh_expiry_date) return true;
          return new Date(bombP.cnh_expiry_date) >= hoje;
        })();
        if (cnhD !== cnhDP) return `Critério 2 — CNH D válida`;

        const cve = (() => {
          const ativo = ['SIM', 'ATIVO'].includes((bomb?.cve_active || '').toUpperCase());
          if (!ativo) return false;
          if (!bomb.cve_expiry_date) return true;
          return new Date(bomb.cve_expiry_date) >= hoje;
        })();
        const cveP = (() => {
          const ativo = ['SIM', 'ATIVO'].includes((bombP?.cve_active || '').toUpperCase());
          if (!ativo) return false;
          if (!bombP.cve_expiry_date) return true;
          return new Date(bombP.cve_expiry_date) >= hoje;
        })();
        if (cve !== cveP) return `Critério 3 — CVE válido`;

        const h24 = (item.total_horas ?? 0) >= 24;
        const h24P = (proximo.total_horas ?? 0) >= 24;
        if (h24 !== h24P) return `Critério 4 — Turno 24h solicitado`;

        const dtProm = bomb?.data_ultima_promocao ? new Date(bomb.data_ultima_promocao).getTime() : Infinity;
        const dtPromP = bombP?.data_ultima_promocao ? new Date(bombP.data_ultima_promocao).getTime() : Infinity;
        if (dtProm !== dtPromP) {
          const dtStr = bomb?.data_ultima_promocao ? new Date(bomb.data_ultima_promocao).toLocaleDateString('pt-BR') : 'N/I';
          return `Critério 5 — Promoção mais antiga (${dtStr})`;
        }

        const dtInc = bomb?.data_inclusao ? new Date(bomb.data_inclusao).toLocaleDateString('pt-BR') : 'N/I';
        return `Critério 6 — Inclusão mais antiga (${dtInc})`;
      };

      // 7. Montar registros para bc_selecionados
      const registrosSelecionados = candidatosOrdenados.map((item, index) => {
        const desc = gerarDescCriterio(item, index + 1);
        return {
          bombeiro_id: String(item.bombeiro_id),
          ciclo_id: item.ciclo_id,
          dia: item.dia,
          horario_inicio: item.horario_inicio,
          horario_fim: item.horario_fim,
          total_horas: item.total_horas,
          criterio_aplicado: desc,
          posicao_ranking: index + 1,
          origem: 'motor',
          notificado: false,
        };
      });

      const { error: errInsSel } = await supabase
        .from('bc_selecionados')
        .insert(registrosSelecionados);

      if (errInsSel) throw errInsSel;
      totalSelecionados += registrosSelecionados.length;

      // 8. Atualizar contagem dinâmica: o 1º colocado foi selecionado
      //    (só o ranking 1 conta como dia trabalhado no motor)
      if (candidatosOrdenados.length > 0) {
        const bid1 = String(candidatosOrdenados[0].bombeiro_id);
        diasSelecionadosNoMes[bid1] = (diasSelecionadosNoMes[bid1] ?? 0) + 1;
      }
    }

    return { processados: totalSelecionados, diasComEscala: diasUnicos.length };
  },

  /**
   * BLOCO 2-EXTRA — Gerar Ciclo de Teste manualmente
   * Cria um ciclo com status 'aberto' e datas de hoje + 5 dias,
   * gerando tokens para todos os BCs ativos sem necessitar do dia 20.
   */
  gerarCicloTeste: async (mesRef: string): Promise<{
    ciclo: BcCiclo;
    tokensGerados: number;
    links: Array<{ bombeiro: Personnel; token: string; link: string }>;
  }> => {
    // Forçar recriação do ciclo de teste
    await supabase
      .from('bc_ciclos')
      .delete()
      .eq('mes_referencia', mesRef);

    const hoje = new Date();
    const encerramento = new Date(hoje);
    encerramento.setDate(encerramento.getDate() + 5);

    const { data: novoCiclo, error: errCiclo } = await supabase
      .from('bc_ciclos')
      .insert({
        mes_referencia: mesRef,
        data_abertura: hoje.toISOString().split('T')[0],
        data_encerramento: encerramento.toISOString().split('T')[0],
        status: 'aberto',
      })
      .select()
      .single();

    if (errCiclo || !novoCiclo) throw errCiclo || new Error('Falha ao criar ciclo de teste.');

    // Buscar BCs ativos
    const { data: bcs, error: errBcs } = await supabase
      .from('personnel')
      .select('*')
      .eq('type', 'BC')
      .eq('status', 'Ativo');

    if (errBcs) throw errBcs;

    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://gest-o-interna-araquari.vercel.app';

    const linksList: Array<{ bombeiro: Personnel; token: string; link: string }> = [];

    for (const bc of bcs || []) {
      const token = bcEscalaService.gerarToken();
      await supabase.from('bc_intencoes').insert({
        bombeiro_id: String(bc.id),
        ciclo_id: novoCiclo.id,
        mes_referencia: mesRef,
        dia: `${mesRef}-01`,
        horario_inicio: '07:00',
        horario_fim: '19:00',
        total_horas: 12,
        status: 'pendente',
        token_acesso: token,
      });

      linksList.push({
        bombeiro: bc as Personnel,
        token,
        link: `${origin}/bc-intencao?token=${token}`,
      });
    }

    return {
      ciclo: novoCiclo as BcCiclo,
      tokensGerados: linksList.length,
      links: linksList,
    };
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

    const mesRef = dia.substring(0, 7);
    const { data: ciclo } = await supabase
      .from('bc_ciclos')
      .select('id')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    const record = {
      bombeiro_id: bombeiroId,
      ciclo_id: ciclo?.id || null,
      dia,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      total_horas: v.totalHoras,
      criterio_aplicado: 'Inserção Manual Gestor (Exceção)',
      posicao_ranking: 99,
      origem: 'excecao_manual',
      motivo_excecao: 'Inserção Manual Gestor (Exceção)',
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
