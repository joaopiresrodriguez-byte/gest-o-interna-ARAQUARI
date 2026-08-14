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

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await bcEscalaService.buscarDadosPainelGestor(mesRef);
      setCiclo(res.ciclo);
      setBcsAtivos(res.bcsAtivos);
      setIntencoes(res.intencoes);
      setSelecionados(res.selecionados);
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

  // Executar Disparo Dia 20 Manualmente / Gerar Links
  const handleDispararDia20 = async () => {
    try {
      setProcessando(true);
      setMensagemStatus(null);
      const res = await bcEscalaService.abrirCicloEDispararLinks(mesRef);
      setModalLinks({ aberto: true, links: res.links });
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Ciclo ${mesRef} aberto com sucesso! ${res.tokensGerados} link(s) de acesso gerado(s).`
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
      const res = await bcEscalaService.abrirCicloEDispararLinks(mesRef);
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
      setMensagemStatus(null);
      const res = await bcEscalaService.publicarEscala(mesRef);

      // Invocação da Edge Function para disparo de notificações de confirmação
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-ciclo-bc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'notificar_selecionados', mesRef }),
      });

      setMensagemStatus({ tipo: 'sucesso', texto: `Escala de ${mesRef} publicada com sucesso (${res.publicadas} inserções/notificações)!` });
      await carregarDados();
    } catch (err: any) {
      setMensagemStatus({ tipo: 'erro', texto: err.message || 'Erro ao publicar escala.' });
    } finally {
      setProcessando(false);
    }
  };

  // Agrupar selecionados por dia
  const selecionadosPorDia: Record<string, typeof selecionados> = {};
  selecionados.forEach(s => {
    if (!selecionadosPorDia[s.dia]) selecionadosPorDia[s.dia] = [];
    selecionadosPorDia[s.dia].push(s);
  });

  const diasOrdenados = Object.keys(selecionadosPorDia).sort();

  return (
    <div className="space-y-6">
      {/* CABEÇALHO E CONTROLES DE MÊS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/80 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
              🚨 Módulo Bombeiros Comunitários
            </div>
            <h2 className="text-2xl font-black text-white">Revisão de Escala Mensal</h2>
            <p className="text-sm text-slate-400">Coleta automatizada de intenções e motor de seleção por critérios</p>
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

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={handleDispararDia20}
                disabled={processando}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Simular disparo automático do link no dia 20"
              >
                <span>📲</span> Dia 20: Abrir Links
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
                title="Executar motor de seleção dos 3 critérios"
              >
                <span>⚙️</span> Dia 26: Rodar Motor
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
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Status do Ciclo:</span>
            <span className={`px-2.5 py-1 rounded-full font-bold uppercase ${
              ciclo?.status === 'publicado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              ciclo?.status === 'processado' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
              ciclo?.status === 'encerrado' ? 'bg-slate-800 text-slate-300' : 'bg-blue-950 text-blue-400 border border-blue-800'
            }`}>
              {ciclo?.status || 'Não Iniciado'}
            </span>
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-red-950/80 border border-red-800/80 rounded-xl text-red-400 font-black flex items-center justify-center text-lg">
                      {diaNum}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-base">Dia {diaNum}/{mes}/{ano}</h4>
                      <span className="text-xs text-slate-400">{listaDia.length} bombeiro(s) escalado(s)</span>
                    </div>
                  </div>
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
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 text-[11px] text-slate-400 flex items-center justify-between">
                        <span className="truncate">🎯 {s.criterio_aplicado}</span>
                        {s.substituido_por_gestor && (
                          <span className="text-amber-400 font-semibold ml-2 shrink-0">⚠️ Alterado pelo Gestor</span>
                        )}
                      </div>
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
