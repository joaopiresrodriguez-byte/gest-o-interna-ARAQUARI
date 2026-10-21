import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bcEscalaService } from '../services/bcEscalaService';
import { BcCiclo, Personnel } from '../services/types';

interface IntencaoForm {
  id?: string;
  dia: string;
  horario_inicio: string;
  horario_fim: string;
}

export const BcIntencaoPublica: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const mesParam = searchParams.get('mes') || '';

  // Determinar mês alvo
  const mesRef = useMemo(() => {
    if (mesParam) return mesParam;
    const agora = new Date();
    let m = agora.getMonth() + 2;
    let a = agora.getFullYear();
    if (m > 12) { m = 1; a += 1; }
    return `${a}-${String(m).padStart(2, '0')}`;
  }, [mesParam]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [ciclo, setCiclo] = useState<BcCiclo | null>(null);
  const [bcsAtivos, setBcsAtivos] = useState<Array<{ id: number; name: string; war_name: string | null; role: string | null; rank: string | null }>>([]);
  const [bombeiro, setBombeiro] = useState<Personnel | null>(null);

  // Estados de seleção no Link Coletivo
  const [bombeiroIdSelecionado, setBombeiroIdSelecionado] = useState<string>('');
  const [cpfDigitado, setCpfDigitado] = useState<string>('');
  const [autenticando, setAutenticando] = useState<boolean>(false);
  const [erroAutenticacao, setErroAutenticacao] = useState<string | null>(null);
  const [autenticado, setAutenticado] = useState<boolean>(false);

  // Contadores de prazo
  const [expirado, setExpirado] = useState<boolean>(false);
  const [diasRestantes, setDiasRestantes] = useState<number>(0);
  const [horasRestantes, setHorasRestantes] = useState<number>(0);
  const [minutosRestantes, setMinutosRestantes] = useState<number>(0);

  // Intenções e submissão
  const [intencoes, setIntencoes] = useState<IntencaoForm[]>([]);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // Inicialização
  useEffect(() => {
    const inicializar = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Se veio com token individual legado
        if (tokenParam) {
          const res = await bcEscalaService.buscarDadosPorToken(tokenParam);
          setBombeiro(res.bombeiro);
          setCiclo(res.ciclo);
          setExpirado(res.expirado);
          setDiasRestantes(res.diasRestantes);
          setHorasRestantes(res.horasRestantes || 0);
          setMinutosRestantes(res.minutosRestantes || 0);
          setAutenticado(true);

          if (res.intencoes && res.intencoes.length > 0) {
            setIntencoes(
              res.intencoes.map(i => ({
                id: i.id,
                dia: i.dia,
                horario_inicio: i.horario_inicio,
                horario_fim: i.horario_fim,
              }))
            );
          } else {
            const diaPadrao = res.ciclo.mes_referencia ? `${res.ciclo.mes_referencia}-01` : '';
            setIntencoes([{ dia: diaPadrao, horario_inicio: '08:00', horario_fim: '20:00' }]);
          }
        } else {
          // Link Coletivo Geral (mesRef)
          const dadosColetivos = await bcEscalaService.buscarDadosCicloColetivo(mesRef);
          setCiclo(dadosColetivos.ciclo);
          setBcsAtivos(dadosColetivos.bcsAtivos);
          setExpirado(dadosColetivos.expirado);
          setDiasRestantes(dadosColetivos.diasRestantes);
          setHorasRestantes(dadosColetivos.horasRestantes);
          setMinutosRestantes(dadosColetivos.minutosRestantes);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao carregar escala de intenção.');
      } finally {
        setLoading(false);
      }
    };

    inicializar();
  }, [tokenParam, mesRef]);

  // Ação de confirmar identidade do BC no Link Coletivo
  const handleConfirmarIdentidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bombeiroIdSelecionado) {
      setErroAutenticacao('Selecione o seu nome na lista.');
      return;
    }
    if (!cpfDigitado.trim()) {
      setErroAutenticacao('Digite seu CPF ou os 4 últimos dígitos para identificação.');
      return;
    }

    try {
      setAutenticando(true);
      setErroAutenticacao(null);
      const res = await bcEscalaService.validarBombeiroPorCPF(
        Number(bombeiroIdSelecionado),
        cpfDigitado,
        mesRef
      );

      setBombeiro(res.bombeiro);
      setAutenticado(true);

      if (res.intencoes && res.intencoes.length > 0) {
        setIntencoes(
          res.intencoes.map(i => ({
            id: i.id,
            dia: i.dia,
            horario_inicio: i.horario_inicio,
            horario_fim: i.horario_fim,
          }))
        );
      } else {
        const diaPadrao = `${mesRef}-01`;
        setIntencoes([{ dia: diaPadrao, horario_inicio: '08:00', horario_fim: '20:00' }]);
      }
    } catch (err: any) {
      setErroAutenticacao(err.message || 'Erro ao validar identidade.');
    } finally {
      setAutentando(false);
    }
  };

  // Adicionar nova linha de intenção
  const adicionarIntencao = () => {
    if (!ciclo) return;
    const proximoDiaNum = intencoes.length + 1;
    const diaFormatted = `${ciclo.mes_referencia}-${String(proximoDiaNum).padStart(2, '0')}`;
    setIntencoes(prev => [...prev, { dia: diaFormatted, horario_inicio: '08:00', horario_fim: '20:00' }]);

    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  // Remover intenção
  const removerIntencao = (index: number) => {
    const novas = [...intencoes];
    novas.splice(index, 1);
    setIntencoes(novas);
  };

  // Atualizar campo de intenção
  const atualizarCampo = (index: number, campo: keyof IntencaoForm, valor: string) => {
    const novas = [...intencoes];
    novas[index] = { ...novas[index], [campo]: valor };
    setIntencoes(novas);
  };

  // Validação geral do formulário para habilitação do botão Enviar
  const validacaoGeral = useMemo(() => {
    if (intencoes.length === 0) return { valido: false, msg: 'Adicione pelo menos uma intenção de serviço.' };

    for (let i = 0; i < intencoes.length; i++) {
      const item = intencoes[i];
      if (!item.dia || !item.horario_inicio || !item.horario_fim) {
        return { valido: false, msg: `Preencha todos os campos do item #${i + 1}.` };
      }
      const val = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);
      if (!val.valido) {
        return { valido: false, msg: `Item #${i + 1}: ${val.mensagem}` };
      }
    }

    return { valido: true };
  }, [intencoes]);

  // Submeter intenções
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validacaoGeral.valido || !bombeiro || !ciclo) return;

    try {
      setSalvando(true);
      setSucessoMsg(null);
      setErrorMsg(null);

      if (tokenParam) {
        await bcEscalaService.salvarIntencoesPorToken(tokenParam, intencoes);
      } else {
        await bcEscalaService.salvarIntencoesColetivo(bombeiro.id, ciclo.mes_referencia, intencoes);
      }

      setSucessoMsg('✅ Intenções salvas com sucesso! Você pode retornar e alterar até o encerramento do prazo.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar intenções de serviço.');
    } finally {
      setSalvando(false);
    }
  };

  // Formatação amigável do mês de referência
  const mesFormatado = useMemo(() => {
    if (!ciclo?.mes_referencia) return '';
    const [ano, mes] = ciclo.mes_referencia.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const idx = parseInt(mes, 10) - 1;
    return `${meses[idx] || mes} de ${ano}`;
  }, [ciclo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-sm font-semibold text-slate-400">Carregando formulário de intenção...</p>
      </div>
    );
  }

  if (errorMsg && !bombeiro && !ciclo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 bg-red-950 border border-red-800 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 text-xl font-bold">
            ✕
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Indisponível</h2>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (expirado) {
    return (
      <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-900/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 bg-amber-950/60 border border-amber-800/80 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 text-3xl">
            ⏰
          </div>
          <h2 className="text-2xl font-bold text-amber-400 mb-2">Prazo de Intenção Encerrado</h2>
          <p className="text-slate-300 mb-4 font-medium">
            Mês de Referência: <span className="text-white font-semibold">{mesFormatado}</span>
          </p>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6 text-slate-400 text-sm text-left">
            <p>
              O período para registrar ou alterar intenções de serviço para este mês foi encerrado pela gestão da escala.
            </p>
          </div>
          <p className="text-xs text-slate-500">Dúvidas ou solicitações excepcionais devem ser encaminhadas ao gestor responsável da escala.</p>
        </div>
      </div>
    );
  }

  // TELA 1 — IDENTIFICAÇÃO DO BOMBEIRO (Link Coletivo)
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/60 rounded-full text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              CBMSC Araquari
            </div>
            <h1 className="text-2xl font-black text-white">Intenção de Serviço</h1>
            <p className="text-slate-400 text-xs mt-1">
              Escala de Bombeiros Comunitários — Mês <strong className="text-red-400">{mesFormatado}</strong>
            </p>
          </div>

          {/* CONTADOR DE PRAZO */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-center mb-6">
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Prazo de Escolha</div>
            <div className="text-base font-black text-amber-400 flex items-center justify-center gap-1">
              <span>⏳</span>
              {horasRestantes <= 24 ? `${horasRestantes}h ${minutosRestantes}m restantes` : `${diasRestantes} dias restantes`}
            </div>
          </div>

          <form onSubmit={handleConfirmarIdentidade} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Selecione seu Nome na Lista <span className="text-red-400">*</span>
              </label>
              <select
                value={bombeiroIdSelecionado}
                onChange={e => {
                  setBombeiroIdSelecionado(e.target.value);
                  setErroAutenticacao(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                required
              >
                <option value="">-- Toque para selecionar seu nome --</option>
                {bcsAtivos.map(bc => (
                  <option key={bc.id} value={bc.id}>
                    {bc.name} {bc.war_name ? `(${bc.war_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Confirmação de CPF <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Digite seu CPF completo ou os 4 últimos dígitos"
                value={cpfDigitado}
                onChange={e => {
                  setCpfDigitado(e.target.value);
                  setErroAutenticacao(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono"
                required
              />
              <span className="block text-[11px] text-slate-500 mt-1">
                🔒 Confirmação segura para proteger suas disponibilidades.
              </span>
            </div>

            {erroAutenticacao && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-xs font-medium">
                ⚠️ {erroAutenticacao}
              </div>
            )}

            <button
              type="submit"
              disabled={autenticando || !bombeiroIdSelecionado}
              className={`w-full py-3 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                bombeiroIdSelecionado && !autenticando
                  ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-red-900/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {autenticando ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Validando Identidade...
                </>
              ) : (
                <>
                  <span>🔓</span> Acessar Minha Intenção
                </>
              )}
            </button>
          </form>

          <div className="text-center text-[11px] text-slate-500 mt-6">
            Corpo de Bombeiros Militar de Santa Catarina — Araquari
          </div>
        </div>
      </div>
    );
  }

  // TELA 2 — PREENCHIMENTO DE DISPONIBILIDADE (APÓS IDENTIFICAÇÃO)
  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 md:p-8 selection:bg-red-500 selection:text-white">
      <div className="max-w-4xl mx-auto pb-12">

        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/60 rounded-full text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                Bombeiros Comunitários — CBMSC
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Intenção de Serviço</h1>
              <p className="text-slate-400 text-sm mt-1">Mês de Referência: <span className="text-red-400 font-semibold">{mesFormatado}</span></p>
            </div>

            {/* CONTADOR DE PRAZO */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-center min-w-[170px]">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Prazo Encerra Em</div>
              <div className="text-lg sm:text-xl font-black text-amber-400 flex items-center justify-center gap-1">
                <span>⏳</span>
                {horasRestantes <= 24 ? (
                  `${horasRestantes}h ${minutosRestantes}m`
                ) : (
                  `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`
                )}
              </div>
              {ciclo?.data_encerramento && (
                <div className="text-[10px] text-slate-500 mt-1">
                  Encerramento: {new Date(ciclo.data_encerramento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>

          {/* IDENTIFICAÇÃO DO BOMBEIRO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-sm">
            <div>
              <span className="text-slate-400 block text-xs">Bombeiro Comunitário</span>
              <strong className="text-white text-base">{bombeiro?.name}</strong>
              {bombeiro?.war_name && <span className="text-slate-400 text-xs ml-2">({bombeiro.war_name})</span>}
            </div>
            <div className="flex sm:justify-end items-center">
              <button
                type="button"
                onClick={() => {
                  setAutenticado(false);
                  setCpfDigitado('');
                }}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Trocar Bombeiro / Sair
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK DE SUCESSO OU ERRO */}
        {sucessoMsg && (
          <div className="bg-emerald-950 border border-emerald-800 text-emerald-200 p-4 rounded-xl mb-6 flex items-center justify-between text-sm shadow-lg">
            <span>{sucessoMsg}</span>
            <button onClick={() => setSucessoMsg(null)} className="text-emerald-400 hover:text-white text-xs font-bold">✕ Fechar</button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center justify-between text-sm shadow-lg">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white text-xs font-bold">✕ Fechar</button>
          </div>
        )}

        {/* FORMULÁRIO DE INTENÇÕES */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📅</span> Seus Dias e Horários Disponíveis
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Selecione apenas turnos exatos de 12 horas ou 24 horas.</p>
            </div>

            <button
              type="button"
              onClick={adicionarIntencao}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 shadow-sm"
            >
              <span>➕</span> Adicionar Outro Dia
            </button>
          </div>

          {/* LISTA DE INTENÇÕES */}
          <div className="space-y-4">
            {intencoes.map((item, index) => {
              const valHoras = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);

              return (
                <div key={index} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 sm:p-5 relative transition-all">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      Disponibilidade #{index + 1}
                    </span>

                    {intencoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerIntencao(index)}
                        className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1"
                      >
                        <span>🗑️</span> Remover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* DIA */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Dia do Plantão</label>
                      <input
                        type="date"
                        value={item.dia}
                        onChange={e => atualizarCampo(index, 'dia', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                        required
                      />
                    </div>

                    {/* HORÁRIO INÍCIO */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Horário Início</label>
                      <div className="flex gap-2">
                        {['08:00', '20:00'].map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => atualizarCampo(index, 'horario_inicio', h)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                              item.horario_inicio === h
                                ? 'bg-red-600 text-white border-red-500 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* HORÁRIO FIM */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Horário Fim</label>
                      <div className="flex gap-2">
                        {['20:00', '08:00'].map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => atualizarCampo(index, 'horario_fim', h)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                              item.horario_fim === h
                                ? 'bg-red-600 text-white border-red-500 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* INDICADOR DE CARGA HORÁRIA E ERRO */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Total de Horas Calculado:</span>
                      <strong className={`font-bold ${valHoras.valido ? 'text-emerald-400' : 'text-red-400'}`}>
                        {valHoras.totalHoras > 0 ? `${valHoras.totalHoras}h` : '--'}
                      </strong>
                    </div>

                    {!valHoras.valido && (
                      <div className="text-red-400 bg-red-950/60 px-3 py-1 rounded-lg border border-red-900/60 font-medium">
                        ⚠️ {valHoras.mensagem}
                      </div>
                    )}

                    {valHoras.valido && (
                      <div className="text-emerald-400 font-medium flex items-center gap-1">
                        ✓ Turno de {valHoras.totalHoras}h Válido
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTÃO DE ENVIO */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              🔒 Suas respostas podem ser alteradas livremente até o encerramento do prazo.
            </div>

            <button
              type="submit"
              disabled={!validacaoGeral.valido || salvando}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                validacaoGeral.valido && !salvando
                  ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-red-900/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {salvando ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Gravando Intenções...
                </>
              ) : (
                <>
                  <span>🚀</span> Salvar Intenções de Serviço
                </>
              )}
            </button>
          </div>
        </form>

        {/* RODAPÉ */}
        <div className="text-center text-xs text-slate-500 mt-8">
          Corpo de Bombeiros Militar de Santa Catarina — 3º/1ª/7ºBBM (Araquari)
        </div>

      </div>
    </div>
  );
};
