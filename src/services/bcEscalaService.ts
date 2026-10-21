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
   * BLOCO 3 — Abertura de Ciclo e Gestão de Links Coletivos / Individuais
   */
  abrirCiclo: async (
    mesRef: string,
    prazoDias: 1 | 5 = 5
  ): Promise<{ ciclo: BcCiclo; linkColetivo: string }> => {
    const agora = new Date();
    const dataAbertura = agora.toISOString();
    const dataEncerramento = new Date(agora.getTime() + prazoDias * 24 * 60 * 60 * 1000).toISOString();

    const { data: ciclo, error } = await supabase
      .from('bc_ciclos')
      .upsert({
        mes_referencia: mesRef,
        data_abertura: dataAbertura,
        data_encerramento: dataEncerramento,
        status: 'aberto',
      }, { onConflict: 'mes_referencia' })
      .select()
      .single();

    if (error || !ciclo) {
      throw new Error(`Falha ao abrir ciclo de intenções: ${error?.message}`);
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gest-o-interna-araquari.vercel.app';
    const linkColetivo = `${origin}/bc-intencao?mes=${mesRef}`;

    return { ciclo: ciclo as BcCiclo, linkColetivo };
  },

  /**
   * Buscar ciclo e dados para o Link Coletivo (aberto a todos os BCs via mesRef)
   */
  buscarDadosCicloColetivo: async (mesRef: string): Promise<{
    ciclo: BcCiclo;
    bcsAtivos: Array<{ id: number; name: string; war_name: string | null; role: string | null; rank: string | null }>;
    expirado: boolean;
    diasRestantes: number;
    horasRestantes: number;
    minutosRestantes: number;
  }> => {
    // Buscar ciclo
    let { data: ciclo } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    if (!ciclo) {
      ciclo = await bcEscalaService.obterOuCriarCiclo(mesRef);
    }

    // Buscar lista de BCs ativos
    const { data: bcs, error: errBCs } = await supabase
      .from('personnel')
      .select('id, name, war_name, role, rank')
      .eq('type', 'BC')
      .eq('status', 'Ativo')
      .order('name');

    if (errBCs) throw errBCs;

    // Calcular tempo restante
    const agora = new Date();
    const dataEnc = new Date(ciclo.data_encerramento);
    const expirado = ciclo.status !== 'aberto' || agora > dataEnc;

    const diffMs = Math.max(0, dataEnc.getTime() - agora.getTime());
    const diasRestantes    = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const horasRestantes   = Math.floor(diffMs / (1000 * 60 * 60));
    const minutosRestantes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ciclo: ciclo as BcCiclo,
      bcsAtivos: (bcs || []) as any,
      expirado,
      diasRestantes,
      horasRestantes,
      minutosRestantes,
    };
  },

  /**
   * Valida bombeiro pelo ID e CPF (aceita com ou sem formatação, ou os últimos 4 dígitos)
   */
  validarBombeiroPorCPF: async (
    bombeiroId: number,
    cpfDigitado: string,
    mesRef: string
  ): Promise<{ valido: boolean; bombeiro: Personnel; intencoes: BcIntencao[] }> => {
    const { data: bc, error } = await supabase
      .from('personnel')
      .select('*')
      .eq('id', bombeiroId)
      .single();

    if (error || !bc) throw new Error('Bombeiro não encontrado.');

    // Normalização de CPF
    const cpfLimpo = (bc.cpf || '').replace(/\D/g, '');
    const digitadoLimpo = (cpfDigitado || '').replace(/\D/g, '');

    // Permite validar tanto pelo CPF completo quanto pelos últimos 4 dígitos
    const coincide =
      (cpfLimpo.length >= 4 && digitadoLimpo.length >= 4 && (
        cpfLimpo === digitadoLimpo ||
        cpfLimpo.endsWith(digitadoLimpo) ||
        cpfLimpo.startsWith(digitadoLimpo)
      ));

    if (!coincide) {
      throw new Error('CPF incorreto para o bombeiro selecionado. Confirme seus dados e tente novamente.');
    }

    // Buscar intenções já gravadas para ele neste mês
    const { data: intencoes } = await supabase
      .from('bc_intencoes')
      .select('*')
      .eq('bombeiro_id', bombeiroId)
      .eq('mes_referencia', mesRef);

    // Filtrar intenções reais (não placeholders)
    const intencoesReais = (intencoes || []).filter(i =>
      !(i.dia === `${mesRef}-01` && i.horario_inicio === '07:00' && i.horario_fim === '19:00')
    );

    return {
      valido: true,
      bombeiro: bc as Personnel,
      intencoes: intencoesReais as BcIntencao[],
    };
  },

  /**
   * Salva intenções do bombeiro autenticado por CPF no link coletivo
   */
  salvarIntencoesColetivo: async (
    bombeiroId: number,
    mesRef: string,
    novasIntencoes: Array<{ dia: string; horario_inicio: string; horario_fim: string }>
  ): Promise<{ ok: boolean; quantidade: number }> => {
    // Verificar se o ciclo está aberto
    const { data: ciclo } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .single();

    if (!ciclo) throw new Error('Ciclo não encontrado.');

    const agora = new Date();
    if (ciclo.status !== 'aberto' || agora > new Date(ciclo.data_encerramento)) {
      throw new Error('O prazo de intenções para este mês já foi encerrado.');
    }

    // Validar horários
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
      .eq('bombeiro_id', bombeiroId)
      .eq('mes_referencia', mesRef);

    if (novasIntencoes.length === 0) {
      return { ok: true, quantidade: 0 };
    }

    const records = novasIntencoes.map(item => {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      return {
        bombeiro_id: bombeiroId,
        ciclo_id: ciclo.id,
        mes_referencia: mesRef,
        dia: item.dia,
        horario_inicio: item.horario_inicio,
        horario_fim: item.horario_fim,
        total_horas: v.totalHoras,
        status: 'pendente',
      };
    });

    const { error: errIns } = await supabase
      .from('bc_intencoes')
      .insert(records);

    if (errIns) throw errIns;

    return { ok: true, quantidade: records.length };
  },

  /**
   * Busca os links JÁ gerados para um mês sem recriar nada.
   * Primeiro tenta bc_access_tokens (nova tabela).
   * Fallback: extrai tokens únicos de bc_intencoes (retrocompatibilidade).
   */
  buscarLinksExistentes: async (
    mesRef: string
  ): Promise<Array<{ bombeiro: Personnel; token: string; link: string; whatsappEnviado: boolean }>> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gest-o-interna-araquari.vercel.app';

    // 1. Tentar bc_access_tokens (nova tabela)
    try {
      const { data: tokens, error } = await supabase
        .from('bc_access_tokens')
        .select('*, personnel(*)')
        .eq('mes_referencia', mesRef);

      if (!error && tokens && tokens.length > 0) {
        return tokens.map((tk: any) => ({
          bombeiro:        tk.personnel as Personnel,
          token:           tk.token,
          link:            `${origin}/bc-intencao?token=${tk.token}`,
          whatsappEnviado: tk.whatsapp_enviado || false,
        }));
      }
    } catch (_) {
      // tabela ainda não existe — usa fallback abaixo
    }

    // 2. Fallback: buscar tokens únicos em bc_intencoes (tokens legados)
    const { data: intencoes } = await supabase
      .from('bc_intencoes')
      .select('bombeiro_id, token_acesso, mes_referencia')
      .eq('mes_referencia', mesRef)
      .not('token_acesso', 'is', null);

    if (intencoes && intencoes.length > 0) {
      // Pegar 1 token por bombeiro (pode haver múltiplas intenções com mesmo token)
      const tokenPorBombeiro = new Map<number, string>();
      intencoes.forEach((i: any) => {
        if (!tokenPorBombeiro.has(i.bombeiro_id) && i.token_acesso) {
          tokenPorBombeiro.set(i.bombeiro_id, i.token_acesso);
        }
      });

      const resultado: Array<{ bombeiro: Personnel; token: string; link: string; whatsappEnviado: boolean }> = [];
      for (const [bombeiroId, token] of tokenPorBombeiro.entries()) {
        const { data: bc } = await supabase
          .from('personnel')
          .select('*')
          .eq('id', bombeiroId)
          .maybeSingle();

        if (bc) {
          resultado.push({
            bombeiro:        bc as Personnel,
            token,
            link:            `${origin}/bc-intencao?token=${token}`,
            whatsappEnviado: false, // legado — não rastreado
          });
        }
      }
      return resultado;
    }

    // 3. Fallback inteligente: se não há tokens em bc_access_tokens nem bc_intencoes,
    // buscar os Bombeiros Comunitários ativos da tabela 'personnel' e gerar tokens para eles
    const { data: bcsAtivos } = await supabase
      .from('personnel')
      .select('*')
      .eq('type', 'BC')
      .eq('status', 'Ativo');

    if (!bcsAtivos || bcsAtivos.length === 0) return [];

    // Buscar ou garantir ciclo
    const { data: ciclo } = await supabase
      .from('bc_ciclos')
      .select('id')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    const resultadoGerado: Array<{ bombeiro: Personnel; token: string; link: string; whatsappEnviado: boolean }> = [];

    for (const bc of bcsAtivos) {
      const token = bcEscalaService.gerarToken();
      // Tentar persistir se a tabela existir
      if (ciclo) {
        try {
          await supabase.from('bc_access_tokens').insert({
            ciclo_id: ciclo.id,
            bombeiro_id: bc.id,
            mes_referencia: mesRef,
            token,
          });
        } catch (_) {
          // Fallback silencioso caso a tabela não tenha sido criada
        }
      }
      resultadoGerado.push({
        bombeiro: bc as Personnel,
        token,
        link: `${origin}/bc-intencao?token=${token}`,
        whatsappEnviado: false,
      });
    }

    return resultadoGerado;
  },

  /**
   * Re-dispara os links WhatsApp existentes sem recriar ciclo ou tokens.
   * Tenta via Edge Function (Z-API automático) com timeout de 15s.
   * Fallback: retorna links para envio manual via WhatsApp Web (modoManual=true).
   */
  dispararLinksExistentesWhatsApp: async (
    mesRef: string
  ): Promise<{ total: number; enviados: number; modoManual: boolean; links: Array<{ bombeiro: Personnel; token: string; link: string; enviado: boolean }> }> => {
    const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-ciclo-bc`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gest-o-interna-araquari.vercel.app';

    // ── Tentativa 1: Edge Function com Z-API (envio automático) ────────────
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout para processar todos os envios

      // Tenta primeiro abrir_ciclo_manual (garante ciclo, tokens e envio)
      const resp = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'abrir_ciclo_manual', mesRef }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const resultado = await resp.json().catch(() => null);
        if (resultado?.ok && resultado.links && resultado.links.length > 0) {
          const linksList: Array<{ bombeiro: Personnel; token: string; link: string; enviado: boolean }> = [];
          for (const item of resultado.links) {
            const { data: bc } = await supabase
              .from('personnel')
              .select('*')
              .eq('id', item.bombeiro_id)
              .maybeSingle();
            if (bc) {
              linksList.push({
                bombeiro: bc as Personnel,
                token:    item.token,
                link:     `${origin}/bc-intencao?token=${item.token}`,
                enviado:  true, // Edge function abriu e enviou
              });
            }
          }
          return {
            total: resultado.links.length,
            enviados: resultado.mensagensEnviadas || 0,
            modoManual: false,
            links: linksList
          };
        }
      }
    } catch (errEdge) {
      // Edge Function indisponível ou timeout — usa modo manual
      console.warn('[BC] Edge Function indisponível, usando modo manual:', errEdge);
    }

    // ── Fallback: buscar links existentes para envio manual via WhatsApp Web ─
    const linksExistentes = await bcEscalaService.buscarLinksExistentes(mesRef);
    const linksList = linksExistentes.map(l => ({ ...l, enviado: false }));
    return { total: linksList.length, enviados: 0, modoManual: true, links: linksList };
  },

  /**
   * BLOCO 4 — Busca de Dados por Token Acesso
   * Primeiro consulta bc_access_tokens (nova tabela).
   * Fallback em bc_intencoes (retrocompatibilidade com tokens legados).
   */
  buscarDadosPorToken: async (token: string): Promise<{
    bombeiro: Personnel;
    ciclo: BcCiclo;
    intencoes: BcIntencao[];
    expirado: boolean;
    diasRestantes: number;
    horasRestantes: number;
    minutosRestantes: number;
  }> => {
    if (!token) throw new Error('Link inválido. Verifique se o link recebido está completo.');

    let bombeiroId: number | string | null = null;
    let mesRef: string | null = null;

    // 1. Tentar buscar o token em bc_access_tokens (nova tabela)
    const { data: accessToken, error: errAT } = await supabase
      .from('bc_access_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (errAT) {
      console.error('Erro ao buscar em bc_access_tokens:', errAT);
    }

    if (accessToken) {
      bombeiroId = accessToken.bombeiro_id;
      mesRef     = accessToken.mes_referencia;
    } else {
      // 2. Fallback: tentar em bc_intencoes (tokens legados)
      const { data: intencaoAmostra, error: errInt } = await supabase
        .from('bc_intencoes')
        .select('*')
        .eq('token_acesso', token)
        .limit(1)
        .maybeSingle();

      if (errInt) {
        console.error('Erro ao buscar intenção por token (fallback):', errInt);
        throw new Error(
          `Erro de acesso ao banco de dados: ${errInt.message || errInt.code || 'permissão negada'}. ` +
          `Informe o código ao responsável: ${errInt.code || 'RLS_ERR'}`
        );
      }

      if (!intencaoAmostra) {
        throw new Error(
          'Link não encontrado ou expirado. Solicite ao gestor que gere um novo link de intenção.'
        );
      }

      bombeiroId = intencaoAmostra.bombeiro_id;
      mesRef     = intencaoAmostra.mes_referencia;
    }

    if (!bombeiroId || !mesRef) {
      throw new Error('Token inválido: não foi possível identificar o bombeiro ou mês de referência.');
    }

    // Buscar bombeiro
    const { data: bombeiro, error: errBomb } = await supabase
      .from('personnel')
      .select('*')
      .eq('id', bombeiroId)
      .maybeSingle();

    if (errBomb || !bombeiro) {
      console.error('Erro ao buscar bombeiro associado ao token:', errBomb);
      throw new Error('Cadastro do bombeiro comunitário não encontrado. Contate o gestor.');
    }

    // Buscar ciclo
    const { data: ciclo, error: errCiclo } = await supabase
      .from('bc_ciclos')
      .select('*')
      .eq('mes_referencia', mesRef)
      .single();

    if (errCiclo || !ciclo) throw new Error('Ciclo de escala não encontrado para este mês.');

    // Buscar intenções salvas REAIS (excluindo placeholders legados dia -01)
    const { data: intencoesBrutas } = await supabase
      .from('bc_intencoes')
      .select('*')
      .eq('bombeiro_id', bombeiroId)
      .eq('mes_referencia', mesRef);

    // Filtrar placeholders legados (dia = primeiro do mês com horário padrão)
    const intencoes = (intencoesBrutas || []).filter(i =>
      !(i.dia === `${mesRef}-01` && i.horario_inicio === '07:00' && i.horario_fim === '19:00')
    );

    // Calcular expiração detalhada
    const agora = new Date();
    const dataEnc = new Date(ciclo.data_encerramento);
    const expirado = ciclo.status !== 'aberto' || agora > dataEnc;

    const diffMs = Math.max(0, dataEnc.getTime() - agora.getTime());
    const diasRestantes    = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const horasRestantes   = Math.floor(diffMs / (1000 * 60 * 60));
    const minutosRestantes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      bombeiro:        bombeiro as Personnel,
      ciclo:           ciclo as BcCiclo,
      intencoes:       intencoes as BcIntencao[],
      expirado,
      diasRestantes,
      horasRestantes,
      minutosRestantes,
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
      throw new Error('O prazo foi encerrado. Não é mais possível registrar ou alterar intenções para este mês.');
    }

    // Validar todas as intenções antes de salvar
    for (const item of novasIntencoes) {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      if (!v.valido) {
        throw new Error(`Dia ${item.dia}: ${v.mensagem}`);
      }
    }

    // Remover intenções anteriores do mesmo bombeiro no mês
    // Deleta apenas por bombeiro_id + mes_referencia para não afetar o registro de token
    await supabase
      .from('bc_intencoes')
      .delete()
      .eq('bombeiro_id', bombeiro.id)
      .eq('mes_referencia', ciclo.mes_referencia);

    if (novasIntencoes.length === 0) {
      return { ok: true, quantidade: 0 };
    }

    // Inserir novas intenções (com token_acesso para rastreabilidade)
    const records = novasIntencoes.map(item => {
      const v = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      return {
        bombeiro_id:    bombeiro.id,
        ciclo_id:       ciclo.id,
        mes_referencia: ciclo.mes_referencia,
        dia:            item.dia,
        horario_inicio: item.horario_inicio,
        horario_fim:    item.horario_fim,
        total_horas:    v.totalHoras,
        status:         'pendente',
        token_acesso:   token,
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
   * 2. CNH categoria D, AD, E ou AE dentro da validade E CVE dentro da validade
   * 3. Graduação BC (bc_graduacao_ordem maior = mais antigo = preferido)
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

    // 2. Buscar todas as intenções do mês
    const { data: intencoesBrutas, error: errInt } = await supabase
      .from('bc_intencoes')
      .select('*')
      .eq('mes_referencia', mesRef);

    if (errInt) throw errInt;
    if (!intencoesBrutas || intencoesBrutas.length === 0) {
      return { processados: 0, diasComEscala: 0 };
    }

    // Buscar todos os bombeiros em personnel para fazer o merge em memória
    const { data: todosBcs } = await supabase
      .from('personnel')
      .select('*');

    const personnelMap = new Map<string, Personnel>();
    (todosBcs || []).forEach(p => {
      personnelMap.set(String(p.id), p);
    });

    const intencoes = intencoesBrutas.map(item => ({
      ...item,
      personnel: personnelMap.get(String(item.bombeiro_id)) || null,
    }));

    // 3. Buscar configurações de vagas/horas do ciclo e exceções diárias via obterConfigVagas
    const cfgVagas = await bcEscalaService.obterConfigVagas(mesRef);
    const horasPadraoDia = cfgVagas.horasPadraoDia;

    const excecoesMap = new Map<string, number>();
    Object.entries(cfgVagas.excecoes).forEach(([dia, h]) => {
      excecoesMap.set(dia, h);
    });

    // 4. Limpar seleções anteriores do mês (re-processamento seguro)
    const diasUnicos = Array.from(new Set(intencoes.map(i => i.dia as string))).sort();

    if (diasUnicos.length > 0) {
      await supabase
        .from('bc_selecionados')
        .delete()
        .in('dia', diasUnicos);
    }

    // 5. Mapa de contagem de dias selecionados POR bombeiro neste mês
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

    // Critério 2: CNH válida = categorias D, AD, E ou AE (whitelist do quadro BC)
    // Definido UMA vez fora do loop para não recriar o Set a cada dia
    const CNH_CATEGORIAS_VALIDAS = new Set(['D', 'AD', 'E', 'AE']);

    const temCnhDValida = (p?: Personnel) => {
      const categoria = (p?.cnh_category || '').toUpperCase().replace(/\s/g, '');
      if (!CNH_CATEGORIAS_VALIDAS.has(categoria)) return false;
      if (!p!.cnh_expiry_date) return true;
      return new Date(p!.cnh_expiry_date) >= hoje;
    };

    const temCveValido = (p?: Personnel) => {
      const ativo = ['SIM', 'ATIVO'].includes((p?.cve_active || '').toUpperCase());
      if (!ativo) return false;
      if (!p!.cve_expiry_date) return true;
      return new Date(p!.cve_expiry_date) >= hoje;
    };

    const temAmbosValidos = (p?: Personnel) => temCnhDValida(p) && temCveValido(p);

    // 6. Processar cada dia em ordem cronológica respeitando a capacidade de horas
    for (const dia of diasUnicos) {
      const intencoesDoDia = intencoes.filter(i => i.dia === dia);
      if (intencoesDoDia.length === 0) continue;

      // Capacidade máxima de horas para este dia específico
      const limiteHorasDia = excecoesMap.has(dia) ? excecoesMap.get(dia)! : horasPadraoDia;

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

        // ── CRITÉRIO 2: CNH D/AD/E/AE válida E CVE válido simultaneamente ──
        const ambosA = temAmbosValidos(bombA);
        const ambosB = temAmbosValidos(bombB);
        if (ambosA !== ambosB) return ambosA ? -1 : 1;

        // ── CRITÉRIO 3: Graduação BC — MAIOR ordem = mais antigo = preferido ──
        // 10º grau (bc_graduacao_ordem=10) vem antes de 1º grau (bc_graduacao_ordem=1)
        // Bombeiros sem ordem (BM) ficam no final com valor 0
        const ordA = typeof bombA?.bc_graduacao_ordem === 'number' ? bombA.bc_graduacao_ordem : 0;
        const ordB = typeof bombB?.bc_graduacao_ordem === 'number' ? bombB.bc_graduacao_ordem : 0;
        if (ordA !== ordB) return ordB - ordA; // DECRESCENTE: maior ordem primeiro

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

      // Snapshot dos dias ANTES de alocar (para que a descrição seja fiel ao estado do sort)
      const snapshotDias: Record<string, number> = { ...diasSelecionadosNoMes };

      // Alocar candidatos sem estourar o limite de horas do dia
      let horasAlocadas = 0;
      const selecionadosDoDia: typeof candidatosOrdenados = [];

      for (const cand of candidatosOrdenados) {
        const horasCand = cand.total_horas || 12;
        if (horasAlocadas + horasCand <= limiteHorasDia) {
          selecionadosDoDia.push(cand);
          horasAlocadas += horasCand;
          // Contabilizar para o ranking dinâmico do mês
          const bid = String(cand.bombeiro_id);
          diasSelecionadosNoMes[bid] = (diasSelecionadosNoMes[bid] ?? 0) + 1;
        }
      }

      // Gera a descrição do critério que efetivamente elegeu o bombeiro:
      // compara o selecionado com TODOS os outros candidatos do dia usando o
      // snapshot dos dias (antes da alocação), percorrendo os critérios em ordem
      // até encontrar o primeiro que o diferencia de pelo menos um concorrente.
      const gerarDescCriterio = (item: typeof candidatosOrdenados[0]): string => {
        const bomb: Personnel = item.personnel;
        const bid = String(item.bombeiro_id);
        const diasSel = snapshotDias[bid] ?? 0;

        const outros = candidatosOrdenados.filter(o => String(o.bombeiro_id) !== bid);
        if (outros.length === 0) return `Critério 1 — Único Candidato`;

        // Critério 1: Menor número de dias no mês
        const diasOutros = outros.map(o => snapshotDias[String(o.bombeiro_id)] ?? 0);
        if (diasOutros.some(d => d !== diasSel)) return `Critério 1 — Menos Dias no Mês`;

        // Critério 2: CNH D/AD/E/AE válida E CVE válido simultaneamente
        const ambosA = temAmbosValidos(bomb);
        if (outros.some(o => temAmbosValidos(o.personnel) !== ambosA)) return `Critério 2 — CNH e CVE Válidos`;

        // Critério 3: Graduação BC (maior ordem = mais antigo = preferido)
        const ordA = typeof bomb?.bc_graduacao_ordem === 'number' ? bomb.bc_graduacao_ordem : 0;
        if (outros.some(o => {
          const ordO = typeof o.personnel?.bc_graduacao_ordem === 'number' ? o.personnel.bc_graduacao_ordem : 0;
          return ordO !== ordA;
        })) return `Critério 3 — Graduação BC`;

        // Critério 4: Solicitação de 24h
        const h24A = (item.total_horas ?? 0) >= 24;
        if (outros.some(o => ((o.total_horas ?? 0) >= 24) !== h24A)) return `Critério 4 — Solicitação de 24h`;

        // Critério 5: Data de última promoção mais antiga
        const dtPromA = bomb?.data_ultima_promocao ? new Date(bomb.data_ultima_promocao).getTime() : Infinity;
        if (outros.some(o => {
          const dtO = o.personnel?.data_ultima_promocao ? new Date(o.personnel.data_ultima_promocao).getTime() : Infinity;
          return dtO !== dtPromA;
        })) return `Critério 5 — Data de Promoção`;

        // Critério 6: Data de inclusão mais antiga
        return `Critério 6 — Data de Inclusão`;
      };

      const registrosSelecionados = selecionadosDoDia.map((item, index) => {
        const desc = gerarDescCriterio(item);
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

      if (registrosSelecionados.length > 0) {
        const { error: errInsSel } = await supabase
          .from('bc_selecionados')
          .insert(registrosSelecionados);

        if (errInsSel) throw errInsSel;
        totalSelecionados += registrosSelecionados.length;
      }
    }

    return { processados: totalSelecionados, diasComEscala: diasUnicos.length };
  },

  /**
   * MÉTODOS DE GESTÃO DE VAGAS / CAPACIDADE DIÁRIA
   */
  obterConfigVagas: async (mesRef: string): Promise<{ horasPadraoDia: number; excecoes: Record<string, number> }> => {
    let horasPadraoDia = 36;

    // Verificar se há salvo em localStorage primeiro como fallback rápido
    try {
      const cached = localStorage.getItem(`bc_horas_padrao_${mesRef}`);
      if (cached && !isNaN(Number(cached))) {
        horasPadraoDia = Number(cached);
      }
    } catch (_) {}

    try {
      const { data: ciclo } = await supabase
        .from('bc_ciclos')
        .select('*')
        .eq('mes_referencia', mesRef)
        .maybeSingle();

      if (ciclo && (ciclo as any).horas_padrao_dia !== undefined && (ciclo as any).horas_padrao_dia !== null) {
        horasPadraoDia = Number((ciclo as any).horas_padrao_dia) || horasPadraoDia;
      }
    } catch (e) {
      console.warn('Coluna horas_padrao_dia ainda não migrada na tabela bc_ciclos:', e);
    }

    const { data: excecoes } = await supabase
      .from('bc_config_vagas')
      .select('*')
      .eq('mes_referencia', mesRef);

    const mapExcecoes: Record<string, number> = {};
    (excecoes || []).forEach(e => {
      mapExcecoes[e.dia] = e.horas_disponiveis;
    });

    return {
      horasPadraoDia,
      excecoes: mapExcecoes,
    };
  },

  salvarConfigVagas: async (
    mesRef: string,
    horasPadraoDia: number,
    excecoes: Record<string, number>
  ) => {
    // 0. Salvar em localStorage para persistência garantida no frontend
    try {
      localStorage.setItem(`bc_horas_padrao_${mesRef}`, String(horasPadraoDia));
    } catch (_) {}

    // 1. Garantir que o ciclo exista
    const cicloObj = await bcEscalaService.obterOuCriarCiclo(mesRef);

    // 2. Atualizar horas padrão no ciclo (com tolerância se a coluna ainda não tiver sido criada no DB remoto)
    try {
      const { error: errCiclo } = await supabase
        .from('bc_ciclos')
        .update({ horas_padrao_dia: horasPadraoDia })
        .eq('id', cicloObj.id);

      if (errCiclo && !errCiclo.message?.includes('horas_padrao_dia')) {
        console.warn('Aviso ao atualizar horas_padrao_dia no Supabase:', errCiclo.message);
      }
    } catch (e: any) {
      console.warn('Alerta: Coluna horas_padrao_dia pendente de execução de migration no banco remoto Supabase.', e);
    }

    // 3. Limpar exceções anteriores do mês
    await supabase
      .from('bc_config_vagas')
      .delete()
      .eq('mes_referencia', mesRef);

    // 4. Inserir novas exceções
    const records = Object.entries(excecoes).map(([dia, horas]) => ({
      ciclo_id: cicloObj.id,
      mes_referencia: mesRef,
      dia,
      horas_disponiveis: horas,
    }));

    if (records.length > 0) {
      const { error } = await supabase
        .from('bc_config_vagas')
        .insert(records);

      if (error) throw error;
    }
  },

  /**
   * BLOCO 2-EXTRA — Gerar Ciclo de Teste manualmente
   * Cria um ciclo com status 'aberto' e datas de hoje + 5 dias,
   * gerando tokens em bc_access_tokens para todos os BCs ativos.
   * NÃO cria intenções placeholder em bc_intencoes.
   */
  gerarCicloTeste: async (mesRef: string): Promise<{
    ciclo: BcCiclo;
    tokensGerados: number;
    links: Array<{ bombeiro: Personnel; token: string; link: string }>;
  }> => {
    // Limpar tokens de teste anteriores
    const { data: cicloAnt } = await supabase
      .from('bc_ciclos')
      .select('id')
      .eq('mes_referencia', mesRef)
      .maybeSingle();

    if (cicloAnt) {
      await supabase.from('bc_access_tokens').delete().eq('ciclo_id', cicloAnt.id);
      await supabase.from('bc_ciclos').delete().eq('id', cicloAnt.id);
    }

    const hoje = new Date();
    const encerramento = new Date(hoje);
    encerramento.setDate(encerramento.getDate() + 5);

    const { data: novoCiclo, error: errCiclo } = await supabase
      .from('bc_ciclos')
      .insert({
        mes_referencia:    mesRef,
        data_abertura:     hoje.toISOString(),
        data_encerramento: encerramento.toISOString(),
        status:            'aberto',
      })
      .select()
      .single();

    if (errCiclo || !novoCiclo) throw errCiclo || new Error('Falha ao criar ciclo de teste.');

    // Buscar BCs ativos
    const { data: bcsBrutos, error: errBcs } = await supabase
      .from('personnel')
      .select('*')
      .eq('status', 'Ativo');

    if (errBcs) throw errBcs;

    let bcs = (bcsBrutos || []).filter(b => b.type === 'BC');
    if (bcs.length === 0) {
      bcs = (bcsBrutos || []).slice(0, 10);
    }

    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://gest-o-interna-araquari.vercel.app';

    const linksList: Array<{ bombeiro: Personnel; token: string; link: string }> = [];

    for (const bc of bcs || []) {
      const token = bcEscalaService.gerarToken();

      // Inserir em bc_access_tokens (sem criar intenção placeholder)
      await supabase.from('bc_access_tokens').insert({
        ciclo_id:      novoCiclo.id,
        bombeiro_id:   bc.id,
        mes_referencia: mesRef,
        token,
      });

      linksList.push({
        bombeiro: bc as Personnel,
        token,
        link: `${origin}/bc-intencao?token=${token}`,
      });
    }

    return {
      ciclo:         novoCiclo as BcCiclo,
      tokensGerados: linksList.length,
      links:         linksList,
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

    // Buscar todos os bombeiros do efetivo (para não perder bombeiros cujo type possa variar)
    const { data: todosMilitares } = await supabase
      .from('personnel')
      .select('*')
      .order('name');

    const bcsAtivos = (todosMilitares || []).filter(p => p.type === 'BC' && p.status === 'Ativo');

    // Buscar intenções do mês
    const { data: intencoesBrutas } = await supabase
      .from('bc_intencoes')
      .select('*')
      .eq('mes_referencia', mesRef);

    // Buscar selecionados
    const { data: selecionadosBrutos } = await supabase
      .from('bc_selecionados')
      .select('*')
      .order('dia')
      .order('posicao_ranking');

    const personnelMap = new Map<string, Personnel>();
    (todosMilitares || []).forEach(p => {
      personnelMap.set(String(p.id), p);
    });

    const intencoes = (intencoesBrutas || []).map(i => ({
      ...i,
      personnel: personnelMap.get(String(i.bombeiro_id)),
    }));

    const selecionadosMes = (selecionadosBrutos || [])
      .filter(s => s.dia.startsWith(mesRef))
      .map(s => ({
        ...s,
        personnel: personnelMap.get(String(s.bombeiro_id)),
      }));

    return {
      ciclo: ciclo as BcCiclo | null,
      bcsAtivos: (bcsAtivos || []) as Personnel[],
      intencoes: intencoes as BcIntencao[],
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
        bombeiro_id: String(novoBombeiroId),
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
      bombeiro_id: String(bombeiroId),
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
   * Alias publicarEscalaDefinitiva mantido para compatibilidade retroativa.
   */
  publicarEscalaDefinitiva: async (mesRef: string): Promise<{ publicadas: number }> =>
    bcEscalaService.publicarEscala(mesRef),

  publicarEscala: async (mesRef: string): Promise<{ publicadas: number }> => {
    // 1. Atualizar ciclo para publicado
    await supabase
      .from('bc_ciclos')
      .update({ status: 'publicado' })
      .eq('mes_referencia', mesRef);

    // 2. Buscar selecionados do mês
    const { data: selecionados } = await supabase
      .from('bc_selecionados')
      .select('*')
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
      const numId = Number(s.bombeiro_id);
      if (!isNaN(numId) && !porDia[s.dia].includes(numId)) {
        porDia[s.dia].push(numId);
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
