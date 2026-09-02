import React, { useState, useEffect } from 'react';
import { b3SolicitacoesService } from '../../services/b3SolicitacoesService';
import { B3SolicitacaoApoio, StatusSolicitacaoApoio } from '../../services/types';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

export const SubmoduloSolicitacoesApoio: React.FC = () => {
  const { user } = useAuth();

  const [solicitacoes, setSolicitacoes] = useState<B3SolicitacaoApoio[]>([]);
  const [loading, setLoading] = useState(true);

  // Totais Resumo
  const [resumo, setResumo] = useState({
    pendente: 0,
    em_analise: 0,
    deferida: 0,
    indeferida: 0,
  });

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // Modal Detalhes & Parecer
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<B3SolicitacaoApoio | null>(null);
  const [parecerTexto, setParecerTexto] = useState('');
  const [salvandoParecer, setSalvandoParecer] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [lista, tot] = await Promise.all([
        b3SolicitacoesService.listarSolicitacoesGestor({
          status: filtroStatus !== 'todos' ? (filtroStatus as StatusSolicitacaoApoio) : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }),
        b3SolicitacoesService.obterTotaisResumo(),
      ]);

      setSolicitacoes(lista);
      setResumo(tot);
    } catch (err) {
      console.error('Erro ao carregar solicitações de apoio:', err);
      toast.error('Erro ao carregar solicitações de apoio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();

    // Inscrever no Realtime para atualizações imediatas
    const channel = supabase
      .channel('realtime_b3_solicitacoes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b3_solicitacoes_apoio' },
        () => {
          carregarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtroStatus, dataInicio, dataFim]);

  const handleAbrirDetalhes = (sol: B3SolicitacaoApoio) => {
    setSolicitacaoSelecionada(sol);
    setParecerTexto(sol.parecer_gestor || '');
  };

  const handleAtualizarStatus = async (novoStatus: StatusSolicitacaoApoio) => {
    if (!solicitacaoSelecionada?.id) return;

    try {
      setSalvandoParecer(true);
      const atualizada = await b3SolicitacoesService.atualizarStatusSolicitacao(
        solicitacaoSelecionada.id,
        {
          status: novoStatus,
          parecer_gestor: parecerTexto,
          analisado_por: (user as any)?.id,
        }
      );

      toast.success(`Solicitação marcada como ${novoStatus.toUpperCase().replace('_', ' ')}!`);
      setSolicitacaoSelecionada(null);
      carregarDados();
    } catch (err) {
      console.error('Erro ao atualizar status da solicitação:', err);
      toast.error('Erro ao atualizar status.');
    } finally {
      setSalvandoParecer(false);
    }
  };

  const getStatusBadge = (status: StatusSolicitacaoApoio) => {
    switch (status) {
      case 'pendente':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">Pendente</span>;
      case 'em_analise':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">Em Análise</span>;
      case 'deferida':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-800 border border-green-200">Deferida</span>;
      case 'indeferida':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">Indeferida</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Pendentes (Mês)</span>
            <span className="text-xl font-black text-stone-800">{resumo.pendente}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined">search</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Em Análise (Mês)</span>
            <span className="text-xl font-black text-stone-800">{resumo.em_analise}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Deferidas (Mês)</span>
            <span className="text-xl font-black text-stone-800">{resumo.deferida}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined">cancel</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Indeferidas (Mês)</span>
            <span className="text-xl font-black text-stone-800">{resumo.indeferida}</span>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Lista */}
      <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
        <div className="p-5 border-b border-rustic-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-rustic-brown flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">inbox_customize</span>
              Solicitações de Apoio Recebidas
            </h3>
            <p className="text-xs text-stone-500">Gerenciamento e análise de pedidos públicos dos cidadãos</p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendentes</option>
              <option value="em_analise">Em Análise</option>
              <option value="deferida">Deferidas</option>
              <option value="indeferida">Indeferidas</option>
            </select>

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-stone-300 text-xs"
                title="Data Solicitação Início"
              />
              <span className="text-stone-400 text-xs">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-stone-300 text-xs"
                title="Data Solicitação Fim"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Solicitações */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-stone-400 animate-pulse text-xs">
              Carregando solicitações de apoio...
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              Nenhuma solicitação encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-rustic-brown font-bold uppercase bg-stone-50">
                    <th className="py-3 px-4">Nº Solicitação</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Tema / Assunto</th>
                    <th className="py-3 px-4">Data Solicitada</th>
                    <th className="py-3 px-4">Horário</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {solicitacoes.map(sol => (
                    <tr
                      key={sol.id}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                      onClick={() => handleAbrirDetalhes(sol)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-red-700">
                        {sol.numero_solicitacao || 'SAP-N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-800">{sol.responsavel_nome}</div>
                        <div className="text-[11px] text-stone-500">{sol.responsavel_telefone || 'Sem telefone'}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-stone-700 font-medium">
                        {sol.tema}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {new Date(sol.dia + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 font-mono">
                        {sol.horario}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(sol.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirDetalhes(sol);
                          }}
                          className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Analisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes & Análise */}
      {solicitacaoSelecionada && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-rustic-brown to-[#4c2d27] p-5 text-white flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-mono font-bold rounded uppercase">
                  {solicitacaoSelecionada.numero_solicitacao}
                </span>
                <h3 className="text-lg font-bold mt-1">Análise de Solicitação de Apoio</h3>
              </div>
              <button
                onClick={() => setSolicitacaoSelecionada(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 font-bold block uppercase text-[10px]">Solicitante</span>
                  <span className="text-stone-800 font-bold text-sm">{solicitacaoSelecionada.responsavel_nome}</span>
                  <span className="block text-stone-600 mt-0.5">{solicitacaoSelecionada.responsavel_telefone || 'Telefone não informado'}</span>
                </div>

                <div>
                  <span className="text-stone-500 font-bold block uppercase text-[10px]">Data & Horário</span>
                  <span className="text-stone-800 font-bold text-sm">
                    {new Date(solicitacaoSelecionada.dia + 'T00:00:00').toLocaleDateString('pt-BR')} às {solicitacaoSelecionada.horario}
                  </span>
                  <span className="block text-stone-500 text-[10px] mt-0.5">
                    Criado em: {new Date(solicitacaoSelecionada.criado_em || '').toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Tema / Objeto do Apoio</label>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 text-xs whitespace-pre-wrap leading-relaxed font-medium">
                  {solicitacaoSelecionada.tema}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Endereço do Local</label>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 text-xs">
                    {solicitacaoSelecionada.endereco}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Complemento / Obs</label>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 text-xs">
                    {solicitacaoSelecionada.complemento || 'Nenhum complemento informado'}
                  </div>
                </div>
              </div>

              {/* Status Atual */}
              <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                <span className="text-xs font-bold text-stone-600">Status Atual:</span>
                {getStatusBadge(solicitacaoSelecionada.status)}
              </div>

              {/* Parecer do Gestor */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-rustic-brown uppercase">
                  Parecer do Gestor / Justificativa
                </label>
                <textarea
                  rows={3}
                  value={parecerTexto}
                  onChange={e => setParecerTexto(e.target.value)}
                  placeholder="Registre aqui o parecer, observações internas ou motivo do deferimento/indeferimento..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Ações do Gestor */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => handleAtualizarStatus('em_analise')}
                disabled={salvandoParecer}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Colocar Em Análise
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAtualizarStatus('indeferida')}
                  disabled={salvandoParecer}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Indeferir
                </button>

                <button
                  onClick={() => handleAtualizarStatus('deferida')}
                  disabled={salvandoParecer}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Deferir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmoduloSolicitacoesApoio;
