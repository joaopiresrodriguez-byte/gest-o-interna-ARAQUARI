import React, { useState, useEffect } from 'react';
import { b3SolicitacoesService } from '../../services/b3SolicitacoesService';
import { B3SolicitacaoApoio, StatusSolicitacaoApoio, TipoDeferimentoB3 } from '../../services/types';
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
  const [tipoDeferimento, setTipoDeferimento] = useState<TipoDeferimentoB3>('palestra_instrucao');
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
    setTipoDeferimento(sol.tipo_deferimento || 'palestra_instrucao');
  };

  const handleAtualizarStatus = async (novoStatus: StatusSolicitacaoApoio) => {
    if (!solicitacaoSelecionada?.id) return;

    try {
      setSalvandoParecer(true);
      
      if (novoStatus === 'deferida') {
        const res = await b3SolicitacoesService.deferir(
          solicitacaoSelecionada,
          tipoDeferimento,
          parecerTexto,
          (user as any)?.id
        );

        const msgTipo = tipoDeferimento === 'palestra_instrucao' 
          ? 'Palestra/Instrução (adicionada ao Acervo & Cronograma do B3)' 
          : 'Operação Presença (adicionada ao fluxo de Missões Diárias)';

        toast.success(`Solicitação DEFERIDA como ${msgTipo}!`);
      } else {
        await b3SolicitacoesService.atualizarStatusSolicitacao(
          solicitacaoSelecionada.id,
          {
            status: novoStatus,
            parecer_gestor: parecerTexto,
            analisado_por: (user as any)?.id,
          }
        );
        toast.success(`Solicitação marcada como ${novoStatus.toUpperCase().replace('_', ' ')}!`);
      }

      setSolicitacaoSelecionada(null);
      carregarDados();
    } catch (err) {
      console.error('Erro ao atualizar status da solicitação:', err);
      toast.error('Erro ao atualizar status da solicitação.');
    } finally {
      setSalvandoParecer(false);
    }
  };

  const getStatusBadge = (status: StatusSolicitacaoApoio, tipoDef?: TipoDeferimentoB3) => {
    switch (status) {
      case 'pendente':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">Pendente</span>;
      case 'em_analise':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">Em Análise</span>;
      case 'deferida':
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-800 border border-green-200">Deferida</span>
            {tipoDef === 'palestra_instrucao' && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">🎓 Palestra/Instrução</span>
            )}
            {tipoDef === 'operacao_presenca' && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200">🚒 Op. Presença</span>
            )}
          </div>
        );
      case 'indeferida':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">Indeferida</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo dos Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pendentes</span>
          <span className="text-2xl font-black text-amber-600 mt-1">{resumo.pendente}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Em Análise</span>
          <span className="text-2xl font-black text-blue-600 mt-1">{resumo.em_analise}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Deferidas</span>
          <span className="text-2xl font-black text-green-600 mt-1">{resumo.deferida}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Indeferidas</span>
          <span className="text-2xl font-black text-red-600 mt-1">{resumo.indeferida}</span>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Status</label>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="em_analise">Em Análise</option>
              <option value="deferida">Deferida</option>
              <option value="indeferida">Indeferida</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Solicitações */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="font-bold text-rustic-brown text-sm">Solicitações Recebidas ({solicitacoes.length})</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-500 text-xs font-medium">Carregando solicitações...</div>
        ) : solicitacoes.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs font-medium">Nenhuma solicitação encontrada com os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-100 text-stone-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Nº / Data</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Tema / Objeto</th>
                  <th className="px-4 py-3">Data/Hora Evento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {solicitacoes.map(sol => (
                  <tr key={sol.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <span className="font-bold text-rustic-brown block">{sol.numero_solicitacao || 'SAP'}</span>
                      <span className="text-[10px] text-stone-500">{new Date(sol.criado_em || '').toLocaleDateString('pt-BR')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold block text-stone-800">{sol.responsavel_nome}</span>
                      {sol.empresa_entidade && (
                        <span className="text-[11px] font-medium text-stone-600 block">{sol.empresa_entidade}</span>
                      )}
                      <span className="text-[10px] text-stone-500">{sol.responsavel_telefone || 'Sem WhatsApp'}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={sol.tema}>
                      {sol.tema}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="block text-stone-800">{new Date(sol.dia + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="text-[10px] text-stone-500">{sol.horario}</span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(sol.status, sol.tipo_deferimento)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleAbrirDetalhes(sol)}
                        className="px-3 py-1.5 bg-rustic-brown text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
                      >
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

      {/* Modal de Análise e Deferimento Integrado */}
      {solicitacaoSelecionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-rustic-brown text-base">
                  Análise da Solicitação #{solicitacaoSelecionada.numero_solicitacao || 'SAP'}
                </h3>
                <p className="text-xs text-stone-500">Gestão de Apoio Comunitário — B3</p>
              </div>
              <button
                onClick={() => setSolicitacaoSelecionada(null)}
                className="text-stone-400 hover:text-stone-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Informações da Solicitação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 font-bold block uppercase text-[10px]">Solicitante</span>
                  <span className="text-stone-800 font-bold text-sm">{solicitacaoSelecionada.responsavel_nome}</span>
                  {solicitacaoSelecionada.empresa_entidade && (
                    <span className="block text-stone-700 font-semibold text-xs mt-0.5">
                      🏢 {solicitacaoSelecionada.empresa_entidade}
                    </span>
                  )}
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
                {getStatusBadge(solicitacaoSelecionada.status, solicitacaoSelecionada.tipo_deferimento)}
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

              {/* Seleção do Tipo de Deferimento (Somente se for deferir ou ainda não deferida) */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                <label className="block text-xs font-bold text-amber-900 uppercase">
                  Opção de Deferimento (Destino da Solicitação):
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    onClick={() => setTipoDeferimento('palestra_instrucao')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                      tipoDeferimento === 'palestra_instrucao'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs">🎓 Palestra / Instrução</span>
                      <input
                        type="radio"
                        name="tipoDeferimento"
                        checked={tipoDeferimento === 'palestra_instrucao'}
                        onChange={() => setTipoDeferimento('palestra_instrucao')}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                    </div>
                    <span className="text-[11px] leading-tight text-stone-600">
                      Entra no Acervo do B3 e agenda no Cronograma de Instruções (com opção de adicionar matérias depois).
                    </span>
                  </label>

                  <label
                    onClick={() => setTipoDeferimento('operacao_presenca')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                      tipoDeferimento === 'operacao_presenca'
                        ? 'border-orange-600 bg-orange-50 text-orange-900 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs">🚒 Missão: Operação Presença</span>
                      <input
                        type="radio"
                        name="tipoDeferimento"
                        checked={tipoDeferimento === 'operacao_presenca'}
                        onChange={() => setTipoDeferimento('operacao_presenca')}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                    </div>
                    <span className="text-[11px] leading-tight text-stone-600">
                      Entra na lista e no fluxo de Missões Diárias no submódulo Operacional.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Ações do Gestor */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0">
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
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Deferir como {tipoDeferimento === 'palestra_instrucao' ? 'Palestra' : 'Missão'}</span>
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
