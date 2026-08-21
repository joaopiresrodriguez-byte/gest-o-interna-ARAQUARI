import React, { useEffect, useState } from 'react';
import { bcEscalaService } from '../../services/bcEscalaService';
import { BcCiclo, BcIntencao, BcSelecionado, Personnel } from '../../services/types';

export const PainelRevisaoEscalaBC: React.FC = () => {
  const [mesRef, setMesRef] = useState<string>(() => {
    const agora = new Date();
    let m = agora.getMonth() + 2; // padrão próximo mês se próximo do dia 20
    let a = agora.getFullYear();
    if (m > 12) {
      m = 1;
      a += 1;
    }
    return `${a}-${String(m).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [ciclo, setCiclo] = useState<BcCiclo | null>(null);
  const [bcsAtivos, setBcsAtivos] = useState<Personnel[]>([]);
  const [intencoes, setIntencoes] = useState<BcIntencao[]>([]);
  const [selecionados, setSelecionados] = useState<(BcSelecionado & { personnel?: Personnel })[]>([]);

  // Modais de Gestão
  const [modalSubstituir, setModalSubstituir] = useState<{ aberto: boolean; selecionadoId: string | null; militarAtualNome: string }>({
    aberto: false,
    selecionadoId: null,
    militarAtualNome: '',
  });
  const [novoMilitarId, setNovoMilitarId] = useState<string>('');
  const [motivoSubstituicao, setMotivoSubstituicao] = useState<string>('');

  const [modalAdicionar, setModalAdicionar] = useState<boolean>(false);
  const [addDia, setAddDia] = useState<string>('');
  const [addMilitarId, setAddMilitarId] = useState<string>('');
  const [addInicio, setAddInicio] = useState<string>('08:00');
  const [addFim, setAddFim] = useState<string>('20:00');

  const [processando, setProcessando] = useState<boolean>(false);
  const [mensagemStatus, setMensagemStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [modalLinksTeste, setModalLinksTeste] = useState<{
    aberto: boolean;
    links: Array<{ bombeiro: Personnel; token: string; link: string }>;
    mesRef: string;
  }>({ aberto: false, links: [], mesRef: '' });

  // Gestão de Vagas / Capacidade Diária
  const [modalVagas, setModalVagas] = useState<boolean>(false);
  const [horasPadraoInput, setHorasPadraoInput] = useState<number>(36);
  const [excecoesVagas, setExcecoesVagas] = useState<Record<string, number>>({});
  const [diaExcecaoInput, setDiaExcecaoInput] = useState<string>('');
  const [horasExcecaoInput, setHorasExcecaoInput] = useState<number>(24);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await bcEscalaService.buscarDadosPainelGestor(mesRef);
      setCiclo(res.ciclo);
      setBcsAtivos(res.bcsAtivos);
      setIntencoes(res.intencoes);
      setSelecionados(res.selecionados);

      // Carregar vagas
      const cfgVagas = await bcEscalaService.obterConfigVagas(mesRef);
      setHorasPadraoInput(cfgVagas.horasPadraoDia);
      setExcecoesVagas(cfgVagas.excecoes);
    } catch (err: any) {
      console.error('Erro ao carregar painel BC:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [mesRef]);

  const [modalLinks, setModalLinks] = useState<{
    aberto: boolean;
    links: Array<{ bombeiro: Personnel; token: string; link: string }>;
  }>({ aberto: false, links: [] });

  // Executar Disparo Manual com Prazo de 1 Dia (24h)
  const handleAberturaManual = async () => {
    try {
      setProcessando(true);
      setMensagemStatus(null);
      const res = await bcEscalaService.abrirCicloEDispararLinks(mesRef, 'manual');
      setModalLinks({ aberto: true, links: res.links });
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Abertura MANUAL do ciclo ${mesRef} realizada com sucesso! Links válidos por 1 DIA (24 horas).`
      });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro na abertura manual do ciclo.' });
    } finally {
      setProcessando(false);
    }
  };

  // Executar Disparo Dia 20 Manualmente (5 dias) / Gerar Links
  const handleDispararDia20 = async () => {
    try {
      setProcessando(true);
      setMensagemStatus(null);
      const res = await bcEscalaService.abrirCicloEDispararLinks(mesRef, 'auto');
      setModalLinks({ aberto: true, links: res.links });
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Ciclo ${mesRef} aberto com prazo de 5 DIAS (até o dia 25)! ${res.tokensGerados} link(s) de acesso gerado(s).`
      });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao disparar ciclo.' });
    } finally {
      setProcessando(false);
    }
  };

  const handleVerLinks = async () => {
    try {
      setProcessando(true);
      const res = await bcEscalaService.abrirCicloEDispararLinks(mesRef, 'auto');
      setModalLinks({ aberto: true, links: res.links });
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao buscar links.' });
    } finally {
      setProcessando(false);
    }
  };

  // Executar Motor de Seleção (Dia 26)
  const handleRodarMotor = async () => {
    try {
      setProcessando(true);
      setMensagemStatus(null);
      const res = await bcEscalaService.rodarMotorSelecao(mesRef);
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Motor de seleção rodou com sucesso! ${res.processados} bombeiros rankeados em ${res.diasComEscala} dias.`
      });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao rodar motor de seleção.' });
    } finally {
      setProcessando(false);
    }
  };

  // Gerar Link de Teste — cria ciclo de teste para qualquer mês sem esperar dia 20
  const handleGerarLinkTeste = async () => {
    if (!confirm(`Isso irá RECRIAR o ciclo de ${mesRef} como TESTE, apagando quaisquer dados anteriores. Confirmar?`)) return;
    try {
      setProcessando(true);
      setMensagemStatus(null);
      const res = await bcEscalaService.gerarCicloTeste(mesRef);
      setModalLinksTeste({ aberto: true, links: res.links, mesRef });
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Ciclo de TESTE criado para ${mesRef}! ${res.tokensGerados} link(s) gerado(s). Válido por 5 dias.`
      });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao gerar ciclo de teste.' });
    } finally {
      setProcessando(false);
    }
  };

  // Confirmar Substituição
  const handleConfirmarSubstituicao = async () => {
    if (!modalSubstituir.selecionadoId || !novoMilitarId || !motivoSubstituicao.trim()) {
      alert('Preencha o substituto e o motivo.');
      return;
    }

    try {
      setProcessando(true);
      await bcEscalaService.substituirBombeiro(
        modalSubstituir.selecionadoId,
        Number(novoMilitarId),
        motivoSubstituicao
      );
      setModalSubstituir({ aberto: false, selecionadoId: null, militarAtualNome: '' });
      setNovoMilitarId('');
      setMotivoSubstituicao('');
      setMensagemStatus({ tipo: 'sucesso', texto: 'Bombeiro substituído com sucesso.' });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessando(false);
    }
  };

  // Confirmar Adição Excepcional
  const handleConfirmarAdicao = async () => {
    if (!addDia || !addMilitarId) {
      alert('Selecione o dia e o bombeiro.');
      return;
    }

    try {
      setProcessando(true);
      await bcEscalaService.adicionarExcecaoBombeiro(
        addDia,
        Number(addMilitarId),
        addInicio,
        addFim
      );
      setModalAdicionar(false);
      setMensagemStatus({ tipo: 'sucesso', texto: 'Bombeiro adicionado à escala.' });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessando(false);
    }
  };

  // Remover Selecionado
  const handleRemover = async (id: string) => {
    if (!confirm('Deseja realmente remover este bombeiro deste dia de serviço?')) return;
    try {
      setProcessando(true);
      await bcEscalaService.removerSelecionado(id);
      setMensagemStatus({ tipo: 'sucesso', texto: 'Registro removido da escala.' });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessando(false);
    }
  };

  // Publicar Escala Definitiva
  const handlePublicarEscala = async () => {
    if (!confirm('Deseja publicar esta escala? Os registros serão inseridos no módulo de escala oficial e os bombeiros serão notificados via WhatsApp.')) return;
    try {
      setProcessando(true);
      await bcEscalaService.publicarEscalaDefinitiva(mesRef);
      setMensagemStatus({ tipo: 'sucesso', texto: 'Escala publicada com sucesso no módulo oficial B1!' });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAINEL DE CONTROLE SUPERIOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/60 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Escala de Bombeiros Comunitários — B1
            </div>
            <h2 className="text-2xl font-black text-white">Gestão e Seleção BC</h2>
            <p className="text-slate-400 text-xs mt-1">Abertura de escolha (Auto/Manual), motor de critérios e revisão final.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Mês de Referência</label>
              <input
                type="month"
                value={mesRef}
                onChange={e => setMesRef(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button
                onClick={handleAberturaManual}
                disabled={processando}
                className="px-3 py-2 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                title="Abrir imediatamente os links de escolha para os BCs com prazo de 1 DIA (24 horas)"
              >
                <span>⚡</span> Abertura Manual (1 Dia)
              </button>

              <button
                onClick={handleDispararDia20}
                disabled={processando}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Abertura padrão do dia 20 com prazo de 5 DIAS (até o dia 25)"
              >
                <span>📲</span> Dia 20: Abertura Auto (5 Dias)
              </button>

              <button
                onClick={handleVerLinks}
                disabled={processando}
                className="px-3 py-2 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Visualizar e copiar os links das intenções gerados para os BCs"
              >
                <span>🔗</span> Ver Links (BCs)
              </button>

              <button
                onClick={handleRodarMotor}
                disabled={processando}
                className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Executar motor de seleção com 6 critérios"
              >
                <span>⚙️</span> Dia 26: Rodar Motor
              </button>

              <button
                onClick={handleGerarLinkTeste}
                disabled={processando}
                className="px-3 py-2 bg-violet-950/60 hover:bg-violet-900/70 text-violet-300 border border-violet-700/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="[ADMIN] Gerar ciclo de teste para o mês selecionado"
              >
                <span>🧪</span> Link de Teste
              </button>

              <button
                onClick={() => setModalVagas(true)}
                disabled={processando}
                className="px-3 py-2 bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Configurar limite de horas/vagas diárias para a escala"
              >
                <span>⚙️</span> Vagas ({horasPadraoInput}h/dia)
              </button>

              <button
                onClick={handlePublicarEscala}
                disabled={processando || selecionados.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold transition shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
              >
                <span>🚀</span> Publicar Escala
              </button>
            </div>
          </div>
        </div>

        {/* STATUS DO CICLO */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-400">Status do Ciclo:</span>
            <span className={`px-2.5 py-1 rounded-full font-bold uppercase ${
              ciclo?.status === 'publicado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              ciclo?.status === 'processado' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
              ciclo?.status === 'encerrado' ? 'bg-slate-800 text-slate-300' : 'bg-blue-950 text-blue-400 border border-blue-800'
            }`}>
              {ciclo?.status || 'Não Iniciado'}
            </span>

            {ciclo?.data_encerramento && (
              <span className="text-slate-400 font-medium">
                Prazo até: <strong className="text-amber-300">{new Date(ciclo.data_encerramento).toLocaleString('pt-BR')}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <span>Intenções Registradas: <strong className="text-white">{intencoes.length}</strong></span>
            <span>Bombeiros Selecionados: <strong className="text-emerald-400">{selecionados.length}</strong></span>
          </div>
        </div>
      </div>

      {/* MENSAGEM STATUS */}
      {mensagemStatus && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
          mensagemStatus.tipo === 'sucesso' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200' : 'bg-red-950/80 border-red-800 text-red-200'
        }`}>
          <span>{mensagemStatus.texto}</span>
          <button onClick={() => setMensagemStatus(null)} className="text-xs opacity-70 hover:opacity-100">✕ Fechar</button>
        </div>
      )}

      {/* BOTÃO ADICIONAR EXCEÇÃO MANUAL */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📅</span> Escala Diária Selecionada pelo Motor
        </h3>
        <button
          onClick={() => { setAddDia(`${mesRef}-01`); setModalAdicionar(true); }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
        >
          <span>➕</span> Adicionar Exceção (Fora da Intenção)
        </button>
      </div>

      {/* LISTA POR DIA */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 font-medium">Carregando painel de escala...</div>
      ) : diasOrdenados.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <p className="text-base font-semibold mb-1">Nenhum bombeiro selecionado para este mês.</p>
          <p className="text-xs text-slate-500">Clique em "Dia 26: Rodar Motor" para processar as intenções recebidas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diasOrdenados.map(dia => {
            const listaDia = selecionadosPorDia[dia];
            const [ano, mes, diaNum] = dia.split('-');

            return (
              <div key={dia} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-red-950/80 border border-red-800/80 rounded-xl text-red-400 font-black flex items-center justify-center text-lg">
                      {diaNum}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-base">Dia {diaNum}/{mes}/{ano}</h4>
                      <span className="text-xs text-slate-400">{listaDia.length} bombeiro(s) escalado(s)</span>
                    </div>
                  </div>

                  {/* INDICADOR DE CAPACIDADE DE HORAS */}
                  {(() => {
                    const totalHorasAlocadas = listaDia.reduce((acc, s) => acc + (s.total_horas || 12), 0);
                    const limiteHoras = excecoesVagas[dia] ?? horasPadraoInput;
                    const pct = Math.min(100, Math.round((totalHorasAlocadas / limiteHoras) * 100));

                    return (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 px-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400 font-medium">Vagas / Horas:</span>
                          <strong className={`font-bold ${pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {totalHorasAlocadas}h / {limiteHoras}h ({pct}%)
                          </strong>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {listaDia.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        s.substituido_por_gestor ? 'bg-amber-950/20 border-amber-800/60' : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-md uppercase">
                              #{s.posicao_ranking}º Lugar
                            </span>
                            <strong className="text-white text-sm">{s.personnel?.name || `ID #${s.bombeiro_id}`}</strong>
                          </div>
                          <p className="text-xs text-slate-400">
                            Horário: <span className="text-emerald-400 font-semibold">{s.horario_inicio} às {s.horario_fim}</span> ({s.total_horas}h)
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setModalSubstituir({
                                aberto: true,
                                selecionadoId: s.id!,
                                militarAtualNome: s.personnel?.name || '',
                              });
                            }}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-xs text-slate-400 hover:text-amber-400 transition"
                            title="Substituir bombeiro"
                          >
                            🔄
                          </button>
                          <button
                            onClick={() => handleRemover(s.id!)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-xs text-slate-400 hover:text-red-400 transition"
                            title="Remover da escala"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* DETALHE DO CRITÉRIO APLICADO */}
                      {(() => {
                        const c = s.criterio_aplicado || '';
                        const criterioNum = c.match(/Critério (\d)/)?.[1];
                        const badgeColor =
                          criterioNum === '1' ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400' :
                          criterioNum === '2' ? 'bg-blue-950/60 border-blue-800/60 text-blue-400' :
                          criterioNum === '3' ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400' :
                          criterioNum === '4' ? 'bg-yellow-950/60 border-yellow-700/60 text-yellow-400' :
                          criterioNum === '5' ? 'bg-orange-950/60 border-orange-800/60 text-orange-400' :
                          criterioNum === '6' ? 'bg-rose-950/60 border-rose-800/60 text-rose-400' :
                          s.substituido_por_gestor ? 'bg-amber-950/60 border-amber-800/60 text-amber-400' :
                          'bg-slate-900/90 border-slate-800/80 text-slate-400';
                        return (
                          <div className={`${badgeColor} border rounded-lg p-2 text-[11px] flex items-center justify-between gap-2`}>
                            <span className="truncate">🎯 {c || 'N/I'}</span>
                            {s.substituido_por_gestor && (
                              <span className="text-amber-400 font-semibold shrink-0">⚠️ Gestor</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL SUBSTITUIR BOMBEIRO */}
      {modalSubstituir.aberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Substituir Bombeiro</h3>
            <p className="text-xs text-slate-400 mb-4">Substituindo <strong className="text-white">{modalSubstituir.militarAtualNome}</strong></p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Novo Bombeiro</label>
                <select
                  value={novoMilitarId}
                  onChange={e => setNovoMilitarId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione um substituto...</option>
                  {bcsAtivos.map(bc => (
                    <option key={bc.id} value={bc.id}>{bc.name} ({bc.war_name || 'BC'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo da Substituição (Obrigatório)</label>
                <textarea
                  value={motivoSubstituicao}
                  onChange={e => setMotivoSubstituicao(e.target.value)}
                  placeholder="Ex: Troca acordada entre as partes / indisponibilidade de última hora..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSubstituir({ aberto: false, selecionadoId: null, militarAtualNome: '' })}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarSubstituicao}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
                >
                  Confirmar Substituição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR EXCEÇÃO */}
      {modalAdicionar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Adicionar Bombeiro à Escala</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Dia</label>
                <input
                  type="date"
                  value={addDia}
                  onChange={e => setAddDia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bombeiro Comunitário</label>
                <select
                  value={addMilitarId}
                  onChange={e => setAddMilitarId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {bcsAtivos.map(bc => (
                    <option key={bc.id} value={bc.id}>{bc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Início</label>
                  <input
                    type="time"
                    value={addInicio}
                    onChange={e => setAddInicio(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fim</label>
                  <input
                    type="time"
                    value={addFim}
                    onChange={e => setAddFim(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAdicionar(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAdicao}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                >
                  Adicionar Bombeiro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR VAGAS / CAPACIDADE */}
      {modalVagas && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⚙️</span> Configurar Vagas Diárias — {mesRef}
                </h3>
                <p className="text-xs text-cyan-400 mt-0.5">Defina o limite de horas disponíveis para alocação do motor.</p>
              </div>
              <button
                onClick={() => setModalVagas(false)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              {/* PADRÃO MENSAL */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Horas Padrão por Dia no Mês
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Ex: 36h permite até 3 BCs de 12h, ou 1 de 24h + 1 de 12h.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="12"
                    min="12"
                    max="120"
                    value={horasPadraoInput}
                    onChange={e => setHorasPadraoInput(Number(e.target.value))}
                    className="w-32 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold text-center"
                  />
                  <span className="text-xs text-slate-400 font-semibold">horas por dia</span>
                </div>
              </div>

              {/* EXCEÇÕES DIÁRIAS */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2">Exceções por Dia Específico (Finais de Semana / Feriados)</h4>
                
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="date"
                    value={diaExcecaoInput}
                    onChange={e => setDiaExcecaoInput(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs flex-1"
                  />
                  <input
                    type="number"
                    step="12"
                    min="12"
                    max="120"
                    value={horasExcecaoInput}
                    onChange={e => setHorasExcecaoInput(Number(e.target.value))}
                    className="w-20 bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs text-center font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!diaExcecaoInput) return;
                      setExcecoesVagas(prev => ({ ...prev, [diaExcecaoInput]: horasExcecaoInput }));
                      setDiaExcecaoInput('');
                    }}
                    className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold shrink-0"
                  >
                    ➕ Adicionar
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {Object.keys(excecoesVagas).length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-2">Nenhuma exceção cadastrada (todos usam {horasPadraoInput}h).</p>
                  ) : (
                    Object.entries(excecoesVagas).map(([d, h]) => (
                      <div key={d} className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-mono">📅 Dia {d.split('-').reverse().join('/')}: <strong className="text-cyan-400">{h}h</strong></span>
                        <button
                          onClick={() => {
                            const copy = { ...excecoesVagas };
                            delete copy[d];
                            setExcecoesVagas(copy);
                          }}
                          className="text-slate-500 hover:text-red-400 text-xs px-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AÇÕES DA MODAL */}
              <div className="border-t border-slate-800 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalVagas(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setProcessando(true);
                      await bcEscalaService.salvarConfigVagas(mesRef, horasPadraoInput, excecoesVagas);
                      setModalVagas(false);
                      setMensagemStatus({ tipo: 'sucesso', texto: 'Configuração de vagas diárias salva com sucesso!' });
                      await carregarDados();
                    } catch (err: any) {
                      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao salvar vagas.' });
                    } finally {
                      setProcessando(false);
                    }
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold"
                >
                  Salvar Vagas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LINKS DE TESTE */}
      {modalLinksTeste.aberto && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-violet-800/50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🧪</span> Links de Teste — {modalLinksTeste.mesRef}
                </h3>
                <p className="text-xs text-violet-400 mt-0.5">Ciclo criado manualmente para teste. Válido por 5 dias a partir de hoje.</p>
              </div>
              <button
                onClick={() => setModalLinksTeste({ aberto: false, links: [], mesRef: '' })}
                className="text-slate-400 hover:text-white p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {modalLinksTeste.links.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Nenhum bombeiro comunitário ativo encontrado.</p>
              ) : (
                modalLinksTeste.links.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-white text-sm block">{item.bombeiro.name}</strong>
                      <span className="text-slate-400 font-mono text-[11px] select-all block truncate max-w-md">{item.link}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.link);
                          setMensagemStatus({ tipo: 'sucesso', texto: `Link copiado para ${item.bombeiro.name}!` });
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        📋 Copiar
                      </button>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-xs font-bold"
                      >
                        🔗 Abrir
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setModalLinksTeste({ aberto: false, links: [], mesRef: '' })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LINKS DAS INTENÇÕES */}
      {modalLinks.aberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🔗</span> Links das Intenções de Serviço (BCs)
                </h3>
                <p className="text-xs text-slate-400">Mês de Referência: <span className="text-red-400 font-semibold">{mesRef}</span></p>
              </div>
              <button
                onClick={() => setModalLinks({ aberto: false, links: [] })}
                className="text-slate-400 hover:text-white p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {modalLinks.links.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Nenhum bombeiro comunitário ativo encontrado para este ciclo.</p>
              ) : (
                modalLinks.links.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-white text-sm block">{item.bombeiro.name}</strong>
                      <span className="text-slate-400 font-mono text-[11px] select-all block truncate max-w-md">{item.link}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.link);
                          setMensagemStatus({ tipo: 'sucesso', texto: `Link copiado para ${item.bombeiro.name}!` });
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        📋 Copiar Link
                      </button>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
                      >
                        🔗 Simular / Abrir
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setModalLinks({ aberto: false, links: [] })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
