import React, { useState, useEffect, useMemo } from 'react';
import { CautelaService } from '../../services/cautelaService';
import { Cautela, CondicaoDevolucao, Vehicle } from '../../services/types';
import { toast } from 'sonner';
import { imprimirDocumentoCautela } from '../../utils/cautelaPdfGenerator';

interface Props {
  isEditor?: boolean;
}

export const SecaoCautelasOperacional: React.FC<Props> = ({ isEditor = true }) => {
  const [cautelas, setCautelas] = useState<Cautela[]>([]);
  const [catalogo, setCatalogo] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ativas' | 'devolvidas' | 'canceladas'>('ativas');

  // Modais
  const [showModalRetirada, setShowModalRetirada] = useState<boolean>(false);
  const [showModalDevolucao, setShowModalDevolucao] = useState<boolean>(false);
  const [showModalCancelar, setShowModalCancelar] = useState<boolean>(false);

  // Form Retirada State
  const [retiradaSearch, setRetiradaSearch] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<Vehicle | null>(null);
  const [dataRetirada, setDataRetirada] = useState<string>(new Date().toISOString().slice(0, 16));
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [solicitante, setSolicitante] = useState<string>('');
  const [retiradoPor, setRetiradoPor] = useState<string>('');
  const [observacoesRetirada, setObservacoesRetirada] = useState<string>('');
  const [salvandoRetirada, setSalvandoRetirada] = useState<boolean>(false);

  // Form Devolução State
  const [cautelaDevolucao, setCautelaDevolucao] = useState<Cautela | null>(null);
  const [dataDevolucaoReal, setDataDevolucaoReal] = useState<string>(new Date().toISOString().slice(0, 16));
  const [condicaoDevolucao, setCondicaoDevolucao] = useState<CondicaoDevolucao>('perfeito_estado');
  const [observacoesDevolucao, setObservacoesDevolucao] = useState<string>('');
  const [devolvidoPor, setDevolvidoPor] = useState<string>('');
  const [salvandoDevolucao, setSalvandoDevolucao] = useState<boolean>(false);

  // Form Cancelar State
  const [cautelaCancelar, setCautelaCancelar] = useState<Cautela | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState<string>('');
  const [salvandoCancelar, setSalvandoCancelar] = useState<boolean>(false);

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      const [cautelasData, catalogoData] = await Promise.all([
        CautelaService.getCautelas(),
        CautelaService.getItensDisponiveisCat(),
      ]);
      setCautelas(cautelasData);
      setCatalogo(catalogoData);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de cautelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Métricas dos Cards
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const em3Dias = new Date(hoje);
  em3Dias.setDate(em3Dias.getDate() + 3);

  const cautelasAtivas = useMemo(() => {
    return cautelas.filter(c => c.status === 'ativo');
  }, [cautelas]);

  const cautelasVencidas = useMemo(() => {
    return cautelasAtivas.filter(c => {
      if (!c.data_prevista_devolucao) return false;
      const prev = new Date(c.data_prevista_devolucao);
      return prev < hoje;
    });
  }, [cautelasAtivas, hoje]);

  const cautelasVencendoEmBreve = useMemo(() => {
    return cautelasAtivas.filter(c => {
      if (!c.data_prevista_devolucao) return false;
      const prev = new Date(c.data_prevista_devolucao);
      return prev >= hoje && prev <= em3Dias;
    });
  }, [cautelasAtivas, hoje, em3Dias]);

  // Lista filtrada por Abas
  const listagemFiltrada = useMemo(() => {
    if (activeTab === 'ativas') {
      return [...cautelasAtivas].sort((a, b) => {
        if (!a.data_prevista_devolucao) return 1;
        if (!b.data_prevista_devolucao) return -1;
        return new Date(a.data_prevista_devolucao).getTime() - new Date(b.data_prevista_devolucao).getTime();
      });
    }
    if (activeTab === 'devolvidas') {
      return cautelas.filter(c => c.status === 'devolvido');
    }
    if (activeTab === 'canceladas') {
      return cautelas.filter(c => c.status === 'cancelado');
    }
    return [];
  }, [cautelas, cautelasAtivas, activeTab]);

  // Itens filtrados para a busca de Nova Retirada
  const itensCatalogoFiltrados = useMemo(() => {
    if (!retiradaSearch.trim()) return catalogo;
    const term = retiradaSearch.toLowerCase();
    return catalogo.filter(
      item => item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term) || item.details?.toLowerCase().includes(term)
    );
  }, [catalogo, retiradaSearch]);

  // Handler Nova Retirada
  const handleNovaRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      toast.error('Por favor, selecione um item para cautelar.');
      return;
    }
    if (selectedItem.status === 'cautelado' || selectedItem.is_cautelado) {
      toast.error('Este item já se encontra cautelado.');
      return;
    }
    if (!solicitante.trim()) {
      toast.error('O nome do solicitante responsável é obrigatório.');
      return;
    }
    if (!retiradoPor.trim()) {
      toast.error('O nome de quem está retirando é obrigatório.');
      return;
    }

    setSalvandoRetirada(true);
    try {
      const novaCautela = await CautelaService.criarCautela({
        item_id: selectedItem.id,
        tipo_item: selectedItem.type,
        item_nome: selectedItem.name,
        solicitante: solicitante.trim(),
        retirado_por: retiradoPor.trim(),
        data_retirada: dataRetirada ? new Date(dataRetirada).toISOString() : new Date().toISOString(),
        data_prevista_devolucao: dataPrevista ? new Date(dataPrevista).toISOString() : null,
        observacoes: observacoesRetirada.trim() || null,
      });

      toast.success(`Cautela ${novaCautela.numero_cautela} registrada com sucesso!`);
      setShowModalRetirada(false);
      resetFormRetirada();
      await loadData();

      // Pergunta se deseja imprimir o termo
      imprimirDocumentoCautela(novaCautela);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar retirada.');
    } finally {
      setSalvandoRetirada(false);
    }
  };

  const resetFormRetirada = () => {
    setSelectedItem(null);
    setRetiradaSearch('');
    setDataRetirada(new Date().toISOString().slice(0, 16));
    setDataPrevista('');
    setSolicitante('');
    setRetiradoPor('');
    setObservacoesRetirada('');
  };

  // Handler Registrar Devolução
  const handleConfirmarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cautelaDevolucao) return;
    if (!devolvidoPor.trim()) {
      toast.error('Informe quem está realizando a devolução.');
      return;
    }

    setSalvandoDevolucao(true);
    try {
      const cautelaAtualizada = await CautelaService.registrarDevolucao(
        cautelaDevolucao.id,
        cautelaDevolucao.item_id,
        condicaoDevolucao,
        observacoesDevolucao.trim() || undefined,
        dataDevolucaoReal ? new Date(dataDevolucaoReal).toISOString() : undefined,
        devolvidoPor.trim()
      );

      toast.success(`Devolução da Cautela ${cautelaDevolucao.numero_cautela} concluída!`);
      setShowModalDevolucao(false);
      setCautelaDevolucao(null);
      setDevolvidoPor('');
      await loadData();

      // Opção de imprimir termo de devolução
      imprimirDocumentoCautela(cautelaAtualizada);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar devolução.');
    } finally {
      setSalvandoDevolucao(false);
    }
  };

  // Handler Cancelar Cautela
  const handleConfirmarCancelar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cautelaCancelar) return;
    if (!motivoCancelamento.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }

    setSalvandoCancelar(true);
    try {
      await CautelaService.cancelarCautela(
        cautelaCancelar.id,
        cautelaCancelar.item_id,
        motivoCancelamento.trim()
      );

      toast.success(`Cautela ${cautelaCancelar.numero_cautela} cancelada com sucesso.`);
      setShowModalCancelar(false);
      setCautelaCancelar(null);
      setMotivoCancelamento('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar cautela.');
    } finally {
      setSalvandoCancelar(false);
    }
  };

  // Helper para ver se cautela está atrasada ou vencendo
  const getItemAtrasoStatus = (c: Cautela) => {
    if (c.status !== 'ativo' || !c.data_prevista_devolucao) return 'normal';
    const prev = new Date(c.data_prevista_devolucao);
    if (prev < hoje) return 'atrasado';
    if (prev <= em3Dias) return 'vencendo';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-rustic-border shadow-xs">
        <div>
          <h2 className="text-xl font-black text-rustic-brown flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">assignment_return</span>
            Gestão Operacional de Cautelas
          </h2>
          <p className="text-xs text-rustic-brown/60 font-medium mt-0.5">
            Ponto central para registro de retiradas, recepções e devoluções de equipamentos e viaturas.
          </p>
        </div>
        {isEditor && (
          <button
            onClick={() => {
              resetFormRetirada();
              setShowModalRetirada(true);
            }}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-black rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Nova Retirada
          </button>
        )}
      </div>

      {/* BLOCO 2 — 3 CARDS DE RESUMO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Ativas */}
        <div className="bg-white p-5 rounded-2xl border border-rustic-border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-rustic-brown/50 mb-1">
              Total de Cautelas Ativas
            </p>
            <p className="text-3xl font-black text-rustic-brown">{cautelasAtivas.length}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Itens em uso externo</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
        </div>

        {/* Card 2: Devoluções Pendentes Vencidas (Vermelho/Laranja) */}
        <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between transition-all ${
          cautelasVencidas.length > 0 ? 'bg-red-50/90 border-red-200 text-red-950' : 'bg-white border-rustic-border'
        }`}>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${cautelasVencidas.length > 0 ? 'text-red-700' : 'text-rustic-brown/50'}`}>
              Devoluções Vencidas (Em Atraso)
            </p>
            <p className={`text-3xl font-black ${cautelasVencidas.length > 0 ? 'text-red-600' : 'text-rustic-brown'}`}>
              {cautelasVencidas.length}
            </p>
            <p className={`text-[11px] font-semibold mt-1 ${cautelasVencidas.length > 0 ? 'text-red-700 font-bold' : 'text-slate-500'}`}>
              {cautelasVencidas.length > 0 ? '⚠️ Requer cobrança imediata' : 'Nenhum atraso registrado'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            cautelasVencidas.length > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        </div>

        {/* Card 3: Vencendo em até 3 Dias (Amarelo) */}
        <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between transition-all ${
          cautelasVencendoEmBreve.length > 0 ? 'bg-amber-50/90 border-amber-200 text-amber-950' : 'bg-white border-rustic-border'
        }`}>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${cautelasVencendoEmBreve.length > 0 ? 'text-amber-800' : 'text-rustic-brown/50'}`}>
              Vencem em até 3 Dias
            </p>
            <p className={`text-3xl font-black ${cautelasVencendoEmBreve.length > 0 ? 'text-amber-600' : 'text-rustic-brown'}`}>
              {cautelasVencendoEmBreve.length}
            </p>
            <p className={`text-[11px] font-semibold mt-1 ${cautelasVencendoEmBreve.length > 0 ? 'text-amber-800 font-bold' : 'text-slate-500'}`}>
              {cautelasVencendoEmBreve.length > 0 ? '🔔 Alerta preventivo' : 'Nenhuma prestes a vencer'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            cautelasVencendoEmBreve.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
        </div>
      </div>

      {/* BLOCO 3 — ABAS E LISTAGEM */}
      <div className="bg-white rounded-2xl border border-rustic-border shadow-xs overflow-hidden">
        {/* Abas */}
        <div className="flex border-b border-rustic-border bg-stone-50/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('ativas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'ativas'
                ? 'bg-primary text-white shadow-xs'
                : 'text-rustic-brown/60 hover:text-rustic-brown hover:bg-stone-200/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">pending_actions</span>
            Ativas
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'ativas' ? 'bg-white/30 text-white' : 'bg-stone-200 text-rustic-brown'
            }`}>
              {cautelasAtivas.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('devolvidas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'devolvidas'
                ? 'bg-primary text-white shadow-xs'
                : 'text-rustic-brown/60 hover:text-rustic-brown hover:bg-stone-200/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">task_alt</span>
            Devolvidas
          </button>

          <button
            onClick={() => setActiveTab('canceladas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'canceladas'
                ? 'bg-primary text-white shadow-xs'
                : 'text-rustic-brown/60 hover:text-rustic-brown hover:bg-stone-200/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">cancel</span>
            Canceladas
          </button>
        </div>

        {/* Tabela de Cautelas */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-rustic-brown/50 animate-pulse">
              Carregando cautelas...
            </div>
          ) : listagemFiltrada.length === 0 ? (
            <div className="p-12 text-center text-rustic-brown/50">
              <span className="material-symbols-outlined text-4xl text-rustic-brown/30 mb-2">folder_off</span>
              <p className="text-sm font-bold">Nenhuma cautela encontrada nesta aba.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rustic-border bg-stone-50/80 text-[10px] font-black uppercase tracking-wider text-rustic-brown/60">
                  <th className="p-3 pl-5">Nº Cautela</th>
                  <th className="p-3">Item / Equipamento</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Solicitante / Retirante</th>
                  <th className="p-3">Data/Hora Retirada</th>
                  <th className="p-3">Data Prevista</th>
                  {activeTab === 'devolvidas' && <th className="p-3">Devolvido Por</th>}
                  {activeTab === 'devolvidas' && <th className="p-3">Condição Devolução</th>}
                  {activeTab === 'canceladas' && <th className="p-3">Motivo Cancelamento</th>}
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rustic-border/60 text-xs">
                {listagemFiltrada.map(cautela => {
                  const statusPrazo = getItemAtrasoStatus(cautela);

                  let rowBg = 'hover:bg-stone-50/60';
                  if (cautela.status === 'ativo') {
                    if (statusPrazo === 'atrasado') rowBg = 'bg-red-50/80 hover:bg-red-100/60';
                    else if (statusPrazo === 'vencendo') rowBg = 'bg-amber-50/80 hover:bg-amber-100/60';
                  }

                  return (
                    <tr key={cautela.id} className={`transition-colors ${rowBg}`}>
                      <td className="p-3 pl-5 font-mono font-bold text-rustic-brown">
                        {cautela.numero_cautela}
                      </td>
                      <td className="p-3 font-bold text-rustic-brown">
                        {cautela.item_nome}
                      </td>
                      <td className="p-3 text-stone-600 font-medium">
                        {cautela.tipo_item}
                      </td>
                      <td className="p-3 text-stone-700">
                        <div className="font-bold">{cautela.solicitante}</div>
                        {cautela.retirado_por !== cautela.solicitante && (
                          <div className="text-[10px] text-stone-500">Retirado: {cautela.retirado_por}</div>
                        )}
                      </td>
                      <td className="p-3 text-stone-600 font-medium">
                        {new Date(cautela.data_retirada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3 font-medium">
                        {cautela.data_prevista_devolucao ? (
                          <span className={statusPrazo === 'atrasado' ? 'text-red-700 font-black' : statusPrazo === 'vencendo' ? 'text-amber-800 font-bold' : 'text-stone-600'}>
                            {new Date(cautela.data_prevista_devolucao).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">Sem prazo</span>
                        )}
                      </td>

                      {activeTab === 'devolvidas' && (
                        <td className="p-3 font-semibold text-stone-700">
                          {cautela.devolvido_por ? (
                            <span className="text-xs font-bold text-emerald-800">{cautela.devolvido_por}</span>
                          ) : (
                            <span className="text-stone-400 italic text-[10px]">Não informado</span>
                          )}
                        </td>
                      )}

                      {activeTab === 'devolvidas' && (
                        <td className="p-3 font-semibold text-stone-700">
                          {cautela.condicao_devolucao === 'perfeito_estado' && <span className="text-emerald-700">Perfeito Estado</span>}
                          {cautela.condicao_devolucao === 'avaria_leve' && <span className="text-amber-700">Avaria Leve</span>}
                          {cautela.condicao_devolucao === 'avaria_grave' && <span className="text-red-700">Avaria Grave</span>}
                          {cautela.condicao_devolucao === 'item_perdido' && <span className="text-red-900 font-black">Item Perdido</span>}
                          {!cautela.condicao_devolucao && '—'}
                        </td>
                      )}

                      {activeTab === 'canceladas' && (
                        <td className="p-3 font-medium text-red-700 max-w-xs truncate" title={cautela.motivo_cancelamento || ''}>
                          {cautela.motivo_cancelamento || '—'}
                        </td>
                      )}

                      <td className="p-3">
                        {cautela.status === 'ativo' && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            statusPrazo === 'atrasado'
                              ? 'bg-red-600 text-white animate-pulse'
                              : statusPrazo === 'vencendo'
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {statusPrazo === 'atrasado' ? 'Em Atraso' : statusPrazo === 'vencendo' ? 'Vence em Breve' : 'Ativo'}
                          </span>
                        )}
                        {cautela.status === 'devolvido' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black uppercase">
                            Devolvido
                          </span>
                        )}
                        {cautela.status === 'cancelado' && (
                          <span className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-black uppercase">
                            Cancelado
                          </span>
                        )}
                      </td>

                      <td className="p-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Imprimir Termo PDF */}
                          <button
                            onClick={() => imprimirDocumentoCautela(cautela)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                            title="Imprimir Termo PDF"
                          >
                            <span className="material-symbols-outlined text-lg">print</span>
                          </button>

                          {/* Ações operacionais apenas para Cautelas Ativas e Perfil Editor */}
                          {cautela.status === 'ativo' && isEditor && (
                            <>
                              {/* Registrar Devolução */}
                              <button
                                onClick={() => {
                                  setCautelaDevolucao(cautela);
                                  setDataDevolucaoReal(new Date().toISOString().slice(0, 16));
                                  setCondicaoDevolucao('perfeito_estado');
                                  setObservacoesDevolucao('');
                                  setDevolvidoPor('');
                                  setShowModalDevolucao(true);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                                title="Registrar Devolução"
                              >
                                <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                                Devolver
                              </button>

                              {/* Cancelar Cautela */}
                              <button
                                onClick={() => {
                                  setCautelaCancelar(cautela);
                                  setMotivoCancelamento('');
                                  setShowModalCancelar(true);
                                }}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancelar Cautela"
                              >
                                <span className="material-symbols-outlined text-lg">block</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: NOVA RETIRADA (CAUTELA) */}
      {showModalRetirada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-rustic-border my-8">
            <div className="flex items-center justify-between border-b border-rustic-border pb-4 mb-4">
              <h3 className="text-lg font-black text-rustic-brown flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Nova Retirada de Equipamento / Viatura
              </h3>
              <button
                onClick={() => setShowModalRetirada(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleNovaRetirada} className="space-y-4">
              {/* Seleção do Item */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Selecionar Item do Catálogo B4 * (Menu Suspenso)
                </label>
                <select
                  value={selectedItem?.id || ''}
                  onChange={e => {
                    const item = catalogo.find(i => i.id === e.target.value);
                    if (item && item.status !== 'cautelado' && !item.is_cautelado) {
                      setSelectedItem(item);
                    } else if (item) {
                      toast.error('Este item está cautelado e não pode ser selecionado.');
                      setSelectedItem(null);
                    } else {
                      setSelectedItem(null);
                    }
                  }}
                  className="w-full px-3 py-2.5 border-2 border-rustic-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary focus:border-primary bg-white text-rustic-brown mb-2 shadow-xs"
                >
                  <option value="">-- Selecione um item do catálogo ({catalogo.length} cadastrados) --</option>
                  {itensCatalogoFiltrados.map(item => {
                    const isCautelado = item.status === 'cautelado' || item.is_cautelado;
                    return (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={isCautelado}
                        className={isCautelado ? 'text-red-600 bg-red-50 font-semibold' : 'text-stone-900 font-bold'}
                      >
                        {isCautelado ? `🔒 [CAUTELADO] ${item.name} (${item.type})` : `✅ ${item.name} (${item.type}) — Disponível`}
                      </option>
                    );
                  })}
                </select>

                {/* Filtro auxiliar */}
                <input
                  type="text"
                  placeholder="Ou digite o nome do equipamento para filtrar as opções acima..."
                  value={retiradaSearch}
                  onChange={e => setRetiradaSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-rustic-border/80 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary bg-stone-50 mb-2"
                />

                {/* Card de confirmação do Item Selecionado */}
                {selectedItem ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                        {selectedItem.name}
                        <span className="text-[10px] px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-black uppercase">
                          {selectedItem.type}
                        </span>
                      </div>
                      {selectedItem.location && (
                        <div className="text-[10px] text-blue-800 font-medium mt-0.5">
                          Localização: <strong>{selectedItem.location}</strong> {selectedItem.patrimonio_number ? `| Patrimônio: ${selectedItem.patrimonio_number}` : ''}
                        </div>
                      )}
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-xs">
                      Item Selecionado
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800 font-semibold italic">
                    ⚠️ Selecione um item no menu suspenso acima para autorizar a retirada.
                  </p>
                )}
              </div>

              {/* Solicitante & Retirante */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                    Solicitante Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sgt Silva"
                    value={solicitante}
                    onChange={e => setSolicitante(e.target.value)}
                    className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                    Quem está Retirando (Nome) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cb Oliveira"
                    value={retiradoPor}
                    onChange={e => setRetiradoPor(e.target.value)}
                    className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                    Data e Hora de Retirada
                  </label>
                  <input
                    type="datetime-local"
                    value={dataRetirada}
                    onChange={e => setDataRetirada(e.target.value)}
                    className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                    Data Prevista de Devolução (Opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={dataPrevista}
                    onChange={e => setDataPrevista(e.target.value)}
                    className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary"
                  />
                  {!dataPrevista && (
                    <p className="text-[10px] text-amber-700 font-semibold mt-1">
                      ⚠️ Se deixado em branco, a cautela não terá prazo definido.
                    </p>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Finalidade do empréstimo, ocorrência ou observação do item..."
                  value={observacoesRetirada}
                  onChange={e => setObservacoesRetirada(e.target.value)}
                  className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-rustic-border">
                <button
                  type="button"
                  onClick={() => setShowModalRetirada(false)}
                  className="px-4 py-2 text-xs font-bold text-rustic-brown hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoRetirada}
                  className="px-5 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-all shadow-md"
                >
                  {salvandoRetirada ? 'Salvando...' : '✅ Gerar Cautela & Imprimir Termo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR DEVOLUÇÃO */}
      {showModalDevolucao && cautelaDevolucao && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rustic-border">
            <div className="flex items-center justify-between border-b border-rustic-border pb-3 mb-4">
              <h3 className="text-base font-black text-rustic-brown flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">assignment_turned_in</span>
                Registrar Devolução de Cautela
              </h3>
              <button
                onClick={() => setShowModalDevolucao(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmarDevolucao} className="space-y-4">
              {/* Contexto Fixo */}
              <div className="bg-stone-50 border border-rustic-border rounded-xl p-3 space-y-1">
                <div className="text-[10px] font-black uppercase text-rustic-brown/60">Informações da Cautela</div>
                <div className="text-sm font-bold text-rustic-brown flex justify-between">
                  <span>{cautelaDevolucao.numero_cautela}</span>
                  <span className="text-stone-600">{cautelaDevolucao.item_nome}</span>
                </div>
                <div className="text-xs text-stone-500">
                  Solicitante: <strong className="text-rustic-brown">{cautelaDevolucao.solicitante}</strong>
                </div>
              </div>

              {/* Quem está Devolvendo */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Quem Está Devolvendo (Nome / Posto) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cb Oliveira"
                  value={devolvidoPor}
                  onChange={e => setDevolvidoPor(e.target.value)}
                  className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Data Devolução Real */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Data e Hora Real da Devolução
                </label>
                <input
                  type="datetime-local"
                  value={dataDevolucaoReal}
                  onChange={e => setDataDevolucaoReal(e.target.value)}
                  className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Condição do Item */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Condição do Item Devolvido *
                </label>
                <select
                  value={condicaoDevolucao}
                  onChange={e => setCondicaoDevolucao(e.target.value as CondicaoDevolucao)}
                  className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="perfeito_estado">🟢 Perfeito Estado</option>
                  <option value="avaria_leve">🟡 Com Avaria Leve</option>
                  <option value="avaria_grave">🔴 Com Avaria Grave</option>
                  <option value="item_perdido">❌ Item Perdido ou Não Devolvido</option>
                </select>
              </div>

              {/* Observações da Devolução */}
              <div>
                <label className="block text-xs font-black uppercase text-rustic-brown/70 mb-1">
                  Observações da Devolução (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva qualquer detalhe sobre o estado de conservação do retorno..."
                  value={observacoesDevolucao}
                  onChange={e => setObservacoesDevolucao(e.target.value)}
                  className="w-full px-3 py-2 border border-rustic-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-rustic-border">
                <button
                  type="button"
                  onClick={() => setShowModalDevolucao(false)}
                  className="px-4 py-2 text-xs font-bold text-rustic-brown hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoDevolucao}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                >
                  {salvandoDevolucao ? 'Salvando...' : 'Confirmar Devolução & Liberar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCELAR CAUTELA */}
      {showModalCancelar && cautelaCancelar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rustic-border">
            <div className="flex items-center justify-between border-b border-rustic-border pb-3 mb-4">
              <h3 className="text-base font-black text-red-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">block</span>
                Cancelar Cautela {cautelaCancelar.numero_cautela}
              </h3>
              <button
                onClick={() => setShowModalCancelar(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmarCancelar} className="space-y-4">
              <p className="text-xs text-stone-600 font-medium">
                Ao cancelar esta cautela, o item <strong>{cautelaCancelar.item_nome}</strong> retornará imediatamente para o status "disponivel" no catálogo B4.
              </p>

              <div>
                <label className="block text-xs font-black uppercase text-red-800 mb-1">
                  Motivo do Cancelamento * (Obrigatório)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Justifique o motivo do cancelamento desta cautela..."
                  value={motivoCancelamento}
                  onChange={e => setMotivoCancelamento(e.target.value)}
                  className="w-full px-3 py-2 border border-red-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-rustic-border">
                <button
                  type="button"
                  onClick={() => setShowModalCancelar(false)}
                  className="px-4 py-2 text-xs font-bold text-rustic-brown hover:bg-stone-100 rounded-xl"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={salvandoCancelar}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                >
                  {salvandoCancelar ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecaoCautelasOperacional;
