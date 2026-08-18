import React, { useState, useEffect, useMemo } from 'react';
import { CautelaService } from '../../services/cautelaService';
import { Cautela } from '../../services/types';
import { toast } from 'sonner';
import { imprimirDocumentoCautela } from '../../utils/cautelaPdfGenerator';

export const SecaoCautelasB4: React.FC = () => {
  const [cautelas, setCautelas] = useState<Cautela[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterSolicitante, setFilterSolicitante] = useState<string>('');
  const [filterDataInicio, setFilterDataInicio] = useState<string>('');
  const [filterDataFim, setFilterDataFim] = useState<string>('');

  const loadCautelas = async () => {
    setLoading(true);
    try {
      const data = await CautelaService.getCautelas();
      setCautelas(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar histórico de cautelas B4.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCautelas();
  }, []);

  // Filtragem dos dados
  const cautelasFiltradas = useMemo(() => {
    return cautelas.filter(c => {
      // Status
      if (filterStatus !== 'todos' && c.status !== filterStatus) return false;

      // Tipo de Item
      if (filterTipo !== 'todos') {
        const tipoNorm = c.tipo_item.toLowerCase();
        if (filterTipo === 'viatura' && !tipoNorm.includes('viatura')) return false;
        if (filterTipo === 'equipamento' && tipoNorm.includes('viatura')) return false;
      }

      // Solicitante / Busca Livre
      if (filterSolicitante.trim()) {
        const term = filterSolicitante.toLowerCase();
        const matchSolicitante = c.solicitante.toLowerCase().includes(term);
        const matchRetirado = c.retirado_por.toLowerCase().includes(term);
        const matchItem = c.item_nome.toLowerCase().includes(term);
        const matchNumero = c.numero_cautela.toLowerCase().includes(term);

        if (!matchSolicitante && !matchRetirado && !matchItem && !matchNumero) return false;
      }

      // Período de Empréstimo
      if (filterDataInicio) {
        const inicio = new Date(filterDataInicio);
        const ret = new Date(c.data_retirada);
        if (ret < inicio) return false;
      }
      if (filterDataFim) {
        const fim = new Date(filterDataFim);
        fim.setHours(23, 59, 59, 999);
        const ret = new Date(c.data_retirada);
        if (ret > fim) return false;
      }

      return true;
    });
  }, [cautelas, filterStatus, filterTipo, filterSolicitante, filterDataInicio, filterDataFim]);

  const resetFiltros = () => {
    setFilterStatus('todos');
    setFilterTipo('todos');
    setFilterSolicitante('');
    setFilterDataInicio('');
    setFilterDataFim('');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="bg-white p-5 rounded-2xl border border-rustic-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-rustic-brown flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">folder_shared</span>
            Base Administrativa de Cautelas (B4)
          </h2>
          <p className="text-xs text-rustic-brown/60 font-medium mt-0.5">
            Painel administrativo para consulta, auditoria histórica e relatórios de empréstimo de patrimônio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-600">
            Total Registrado: <strong>{cautelas.length}</strong>
          </span>
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      <div className="bg-white p-5 rounded-2xl border border-rustic-border shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-rustic-border/60 pb-3">
          <h3 className="text-xs font-black uppercase text-rustic-brown/70 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">filter_alt</span>
            Filtros da Consulta B4
          </h3>
          {(filterStatus !== 'todos' || filterTipo !== 'todos' || filterSolicitante || filterDataInicio || filterDataFim) && (
            <button
              onClick={resetFiltros}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">filter_alt_off</span>
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rustic-brown/60 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-rustic-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="devolvido">Devolvido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Tipo de Item */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rustic-brown/60 mb-1">Tipo de Item</label>
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-rustic-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="equipamento">Equipamento / Material</option>
              <option value="viatura">Viatura</option>
            </select>
          </div>

          {/* Solicitante / Busca */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rustic-brown/60 mb-1">Solicitante / Item / Nº</label>
            <input
              type="text"
              placeholder="Digite para buscar..."
              value={filterSolicitante}
              onChange={e => setFilterSolicitante(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-rustic-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rustic-brown/60 mb-1">Período De</label>
            <input
              type="date"
              value={filterDataInicio}
              onChange={e => setFilterDataInicio(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-rustic-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rustic-brown/60 mb-1">Período Até</label>
            <input
              type="date"
              value={filterDataFim}
              onChange={e => setFilterDataFim(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-rustic-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* LISTAGEM COMPLETA DE CAUTELAS */}
      <div className="bg-white rounded-2xl border border-rustic-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-rustic-brown/50 animate-pulse">
              Carregando base de cautelas B4...
            </div>
          ) : cautelasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-rustic-brown/50">
              <span className="material-symbols-outlined text-4xl text-rustic-brown/30 mb-2">search_off</span>
              <p className="text-sm font-bold">Nenhum registro de cautela corresponde aos filtros aplicados.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rustic-border bg-stone-50/80 text-[10px] font-black uppercase tracking-wider text-rustic-brown/60">
                  <th className="p-3 pl-5">Nº Cautela</th>
                  <th className="p-3">Item / Equipamento</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Data Empréstimo</th>
                  <th className="p-3">Data Prevista</th>
                  <th className="p-3">Data Devolução Real</th>
                  <th className="p-3">Status Atual</th>
                  <th className="p-3 pr-5 text-right">Documento PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rustic-border/60 text-xs">
                {cautelasFiltradas.map(cautela => (
                  <tr key={cautela.id} className="hover:bg-stone-50/60 transition-colors">
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
                        <div className="text-[10px] text-stone-500">Ret: {cautela.retirado_por}</div>
                      )}
                    </td>
                    <td className="p-3 text-stone-600 font-medium">
                      {new Date(cautela.data_retirada).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3 text-stone-600 font-medium">
                      {cautela.data_prevista_devolucao ? (
                        new Date(cautela.data_prevista_devolucao).toLocaleDateString('pt-BR')
                      ) : (
                        <span className="text-stone-400 italic">Sem prazo</span>
                      )}
                    </td>
                    <td className="p-3 text-stone-600 font-medium">
                      {cautela.data_devolucao_real ? (
                        new Date(cautela.data_devolucao_real).toLocaleDateString('pt-BR')
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {cautela.status === 'ativo' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-black uppercase">
                          Ativo
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
                      <button
                        onClick={() => imprimirDocumentoCautela(cautela)}
                        className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold flex items-center gap-1.5 ml-auto transition-colors"
                        title="Visualizar / Imprimir PDF da Cautela"
                      >
                        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                        Visualizar PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecaoCautelasB4;
