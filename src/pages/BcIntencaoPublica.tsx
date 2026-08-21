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
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [bombeiro, setBombeiro] = useState<Personnel | null>(null);
  const [ciclo, setCiclo] = useState<BcCiclo | null>(null);
  const [expirado, setExpirado] = useState<boolean>(false);
  const [diasRestantes, setDiasRestantes] = useState<number>(0);
  const [horasRestantes, setHorasRestantes] = useState<number>(0);
  const [minutosRestantes, setMinutosRestantes] = useState<number>(0);

  const [intencoes, setIntencoes] = useState<IntencaoForm[]>([]);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // Carregar dados por token
  const carregarDados = async () => {
    if (!token) {
      setErrorMsg('Link inválido ou sem token de acesso.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await bcEscalaService.buscarDadosPorToken(token);

      setBombeiro(res.bombeiro);
      setCiclo(res.ciclo);
      setExpirado(res.expirado);
      setDiasRestantes(res.diasRestantes);
      setHorasRestantes(res.horasRestantes || 0);
      setMinutosRestantes(res.minutosRestantes || 0);

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
        // Inicializar com 1 item padrão no dia 1º do mês de referência
        const diaPadrao = res.ciclo.mes_referencia ? `${res.ciclo.mes_referencia}-01` : '';
        setIntencoes([{ dia: diaPadrao, horario_inicio: '07:00', horario_fim: '19:00' }]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar link de intenções.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [token]);

  // Adicionar nova linha de intenção
  const adicionarIntencao = () => {
    if (!ciclo) return;
    const proximoDiaNum = intencoes.length + 1;
    const diaFormatted = `${ciclo.mes_referencia}-${String(proximoDiaNum).padStart(2, '0')}`;
    setIntencoes(prev => [...prev, { dia: diaFormatted, horario_inicio: '07:00', horario_fim: '19:00' }]);

    // Rolar a tela suavemente para baixo para acompanhar o novo item adicionado
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
    if (!validacaoGeral.valido || !token) return;

    try {
      setSalvando(true);
      setSucessoMsg(null);
      setErrorMsg(null);

      await bcEscalaService.salvarIntencoesPorToken(token, intencoes);
      setSucessoMsg('Intenções salvas com sucesso! Você pode alterar até o final do prazo.');
      // Re-carregar para atualizar estados
      await carregarDados();
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

  if (errorMsg && !bombeiro) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-950/60 border border-red-800/80 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Acesso Não Permitido</h2>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <p className="text-xs text-slate-500">Se você acredita que isso é um erro, entre em contato com a seção responsável do CBMSC.</p>
        </div>
      </div>
    );
  }

  if (expirado) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-900/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl"></div>
          <div className="w-16 h-16 bg-amber-950/60 border border-amber-800/80 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 text-3xl">
            ⏰
          </div>
          <h2 className="text-2xl font-bold text-amber-400 mb-2">Prazo de Intenção Encerrado</h2>
          <p className="text-slate-300 mb-4 font-medium">
            Mês de Referência: <span className="text-white font-semibold">{mesFormatado}</span>
          </p>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6 text-slate-400 text-sm text-left">
            <p className="mb-2 text-slate-300">
              Olá, <strong className="text-white">{bombeiro?.name}</strong>.
            </p>
            <p>
              O período de 5 dias para registrar ou alterar intenções de serviço para este mês foi encerrado.
            </p>
          </div>
          <p className="text-xs text-slate-500">Dúvidas ou solicitações excepcionais devem ser encaminhadas ao gestor responsável da escala.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 md:p-8 selection:bg-red-500 selection:text-white">
      <div className="max-w-4xl mx-auto">

        {/* CABEÇALHO DA PÁGINA */}
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
            <div>
              <span className="text-slate-400 block text-xs">Status do Ciclo</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Aberto para Escolha ({horasRestantes <= 24 ? '1 dia' : '5 dias'})
              </span>
            </div>
          </div>
        </div>

        {/* ALERTA DE SUCESSO / ERRO */}
        {sucessoMsg && (
          <div className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-lg">
            <span className="text-xl">✅</span>
            <div>
              <strong className="font-semibold block text-emerald-100">Intenções Registradas!</strong>
              <p className="text-sm text-emerald-300">{sucessoMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800/80 text-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-lg">
            <span className="text-xl">🚨</span>
            <div>
              <strong className="font-semibold block text-red-100">Atenção</strong>
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* FORMULÁRIO DE INTENÇÕES */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Dias e Horários Pretendidos</h2>
              <p className="text-xs text-slate-400 mt-0.5">Disponibilidade voluntária para o serviço comunitário</p>
            </div>
            <button
              type="button"
              onClick={adicionarIntencao}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700"
            >
              <span>➕</span> Adicionar Dia
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {intencoes.map((item, index) => {
              const valHoras = bcEscalaService.validarHoras(item.horario_inicio, item.horario_fim);

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    valHoras.valido
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-red-950/30 border-red-800/80 shadow-[0_0_15px_rgba(220,38,38,0.15)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      Intenção #{index + 1}
                    </span>

                    {intencoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerIntencao(index)}
                        className="text-xs text-slate-500 hover:text-red-400 transition flex items-center gap-1"
                      >
                        🗑️ Remover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* DIA DO MÊS */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Dia de Serviço</label>
                      <input
                        type="date"
                        value={item.dia}
                        onChange={e => atualizarCampo(index, 'dia', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        required
                      />
                    </div>

                    {/* HORÁRIO INÍCIO */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Horário Início</label>
                      <input
                        type="time"
                        value={item.horario_inicio}
                        onChange={e => atualizarCampo(index, 'horario_inicio', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        required
                      />
                    </div>

                    {/* HORÁRIO FIM */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Horário Fim</label>
                      <input
                        type="time"
                        value={item.horario_fim}
                        onChange={e => atualizarCampo(index, 'horario_fim', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        required
                      />
                    </div>
                  </div>

                  {/* INDICADOR DE CARGA HORÁRIA E ERRO BLOCO 2 & 4 */}
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
