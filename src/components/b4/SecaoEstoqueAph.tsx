import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { EstoqueAphService, MaterialEstoqueAPH } from '../../services/estoqueAphService';
import { SupabaseService } from '../../services/SupabaseService';

export const SecaoEstoqueAph: React.FC = () => {
  const [materiais, setMateriais] = useState<MaterialEstoqueAPH[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState<'todos' | 'criticos' | 'vencendo'>('todos');

  // Modal de Movimentação
  const [modalAberto, setModalAberto] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<MaterialEstoqueAPH | null>(null);
  const [tipoMov, setTipoMov] = useState<'ENTRADA' | 'AJUSTE_INVENTARIO' | 'BAIXA_AVARIA'>('ENTRADA');
  const [quantidadeMov, setQuantidadeMov] = useState<number>(1);
  const [motivoMov, setMotivoMov] = useState('');
  const [loteMov, setLoteMov] = useState('');
  const [validadeMov, setValidadeMov] = useState('');
  const [estMinMov, setEstMinMov] = useState<number>(5);
  const [estIdealMov, setEstIdealMov] = useState<number>(20);

  // Modal de Histórico
  const [modalHistAberto, setModalHistAberto] = useState(false);

  // Modal de Limites (Mínimo e Ideal/Máximo)
  const [modalLimitesAberto, setModalLimitesAberto] = useState(false);
  const [itemLimites, setItemLimites] = useState<MaterialEstoqueAPH | null>(null);
  const [novoMinimo, setNovoMinimo] = useState<number>(5);
  const [novoIdeal, setNovoIdeal] = useState<number>(20);
  const [salvandoLimites, setSalvandoLimites] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await EstoqueAphService.getMateriaisEstoque();
      setMateriais(data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar estoque da Sala de APH');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const abrirModalMov = (item: MaterialEstoqueAPH, tipo: 'ENTRADA' | 'AJUSTE_INVENTARIO' | 'BAIXA_AVARIA') => {
    setItemSelecionado(item);
    setTipoMov(tipo);
    setQuantidadeMov(tipo === 'AJUSTE_INVENTARIO' ? item.quantidade : 1);
    setMotivoMov('');
    setLoteMov(item.lote || '');
    setValidadeMov(item.data_validade || '');
    setEstMinMov(item.estoque_minimo || 5);
    setEstIdealMov(item.estoque_ideal || 20);
    setModalAberto(true);
  };

  const abrirModalLimites = (item: MaterialEstoqueAPH) => {
    setItemLimites(item);
    setNovoMinimo(Number(item.estoque_minimo) >= 0 ? Number(item.estoque_minimo) : 5);
    setNovoIdeal(Number(item.estoque_ideal) >= 0 ? Number(item.estoque_ideal) : 20);
    setModalLimitesAberto(true);
  };

  const handleSalvarLimites = async () => {
    if (!itemLimites) return;
    if (novoMinimo < 0 || novoIdeal < 0) {
      toast.error('As quantidades mínima e máxima devem ser iguais ou maiores que zero.');
      return;
    }
    if (novoIdeal < novoMinimo) {
      toast.error('O estoque ideal/máximo não pode ser menor do que o estoque mínimo.');
      return;
    }

    setSalvandoLimites(true);
    try {
      const ok = await EstoqueAphService.atualizarLimitesEstoque({
        itemId: itemLimites.id,
        estoqueMinimo: Number(novoMinimo),
        estoqueIdeal: Number(novoIdeal),
        responsavel: 'Gestor B4',
      });

      if (ok) {
        toast.success(`Limites atualizados: Mínimo ${novoMinimo} | Ideal ${novoIdeal}`);
        setModalLimitesAberto(false);
        carregarDados();
      } else {
        toast.error('Não foi possível salvar os limites.');
      }
    } catch (e: any) {
      toast.error('Erro ao atualizar limites: ' + (e?.message || e));
    } finally {
      setSalvandoLimites(false);
    }
  };

  const handleSalvarMov = async () => {
    if (!itemSelecionado) return;
    if (quantidadeMov <= 0 && tipoMov !== 'AJUSTE_INVENTARIO') {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    try {
      const ok = await EstoqueAphService.movimentarEstoque({
        itemId: itemSelecionado.id,
        tipo: tipoMov,
        quantidade: Number(quantidadeMov),
        motivo: motivoMov || (tipoMov === 'ENTRADA' ? 'Entrada / Reabastecimento' : tipoMov === 'AJUSTE_INVENTARIO' ? 'Ajuste de Balanço' : 'Baixa por avaria'),
        responsavel: 'Gestor B4',
        lote: loteMov,
        dataValidade: validadeMov,
        estoqueMinimo: Number(estMinMov),
        estoqueIdeal: Number(estIdealMov),
      });

      if (ok) {
        toast.success('Movimentação de estoque registrada com sucesso!');
        setModalAberto(false);
        carregarDados();
      } else {
        toast.error('Não foi possível salvar a movimentação.');
      }
    } catch (e: any) {
      toast.error('Erro ao movimentar: ' + e.message);
    }
  };

  // Cálculos de Alerta
  const hoje = new Date().toISOString().split('T')[0];
  const limite30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const materiaisFiltrados = materiais.filter(m => {
    const bateTexto = (m.name || '').toLowerCase().includes(filtroTexto.toLowerCase()) ||
      (m.lote || '').toLowerCase().includes(filtroTexto.toLowerCase());
    if (!bateTexto) return false;

    const ehCritico = m.quantidade <= (m.estoque_minimo || 5);
    const estaVencendo = m.data_validade ? m.data_validade <= limite30Dias : false;

    if (filtroAlerta === 'criticos') return ehCritico;
    if (filtroAlerta === 'vencendo') return estaVencendo;
    return true;
  });

  const totalCriticos = materiais.filter(m => m.quantidade <= (m.estoque_minimo || 5)).length;
  const totalVencendo = materiais.filter(m => m.data_validade && m.data_validade <= limite30Dias).length;

  return (
    <div className="space-y-6">
      {/* Header com Indicadores Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rustic-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-black">
            🚑
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-stone-400">Total de Insumos APH</p>
            <p className="text-xl font-black text-rustic-brown">{materiais.length}</p>
          </div>
        </div>

        <div
          onClick={() => setFiltroAlerta(filtroAlerta === 'criticos' ? 'todos' : 'criticos')}
          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
            filtroAlerta === 'criticos' ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-300' : 'bg-white border-rustic-border hover:bg-stone-50'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            ⚠️
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-amber-700">Estoque Crítico / Mínimo</p>
            <p className="text-xl font-black text-amber-900">{totalCriticos} itens</p>
          </div>
        </div>

        <div
          onClick={() => setFiltroAlerta(filtroAlerta === 'vencendo' ? 'todos' : 'vencendo')}
          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
            filtroAlerta === 'vencendo' ? 'ring-2 ring-red-500 bg-red-50 border-red-300' : 'bg-white border-rustic-border hover:bg-stone-50'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-black">
            ⏰
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-red-700">Vencendo ou Vencidos</p>
            <p className="text-xl font-black text-red-900">{totalVencendo} lotes</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
            🔄
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-800">Baixa Automática</p>
            <p className="text-xs font-bold text-emerald-900">Ativa via Conferência ASU</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-rustic-border">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-stone-400 text-[18px]">search</span>
          <input
            type="text"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Buscar por material, lote ou insumo..."
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-rustic-border text-xs font-medium focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-2">
          {filtroAlerta !== 'todos' && (
            <button
              onClick={() => setFiltroAlerta('todos')}
              className="text-xs font-bold text-red-700 hover:underline px-2"
            >
              Limpar Filtro ({filtroAlerta})
            </button>
          )}
          <button
            onClick={carregarDados}
            className="h-10 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela de Materiais de APH & Reserva */}
      <div className="bg-white rounded-xl border border-rustic-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-rustic-border text-[10px] font-black uppercase text-stone-500">
              <tr>
                <th className="py-3 px-4">Material / Insumo</th>
                <th className="py-3 px-4">Local</th>
                <th className="py-3 px-4">Lote / Validade</th>
                <th className="py-3 px-4 text-center">Saldo em Estoque</th>
                <th className="py-3 px-4 text-center">Status & Alertas</th>
                <th className="py-3 px-4 text-right">Ações de Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rustic-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-400 font-bold">
                    Carregando estoque de APH...
                  </td>
                </tr>
              ) : materiaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-400 italic">
                    Nenhum material de APH encontrado.
                  </td>
                </tr>
              ) : (
                materiaisFiltrados.map(item => {
                  const estMin = item.estoque_minimo || 5;
                  const estCritico = item.quantidade <= estMin;
                  const vencido = item.data_validade && item.data_validade < hoje;
                  const vencendo = item.data_validade && !vencido && item.data_validade <= limite30Dias;

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-black text-rustic-brown text-sm">{item.name}</p>
                        <p className="text-[10px] text-stone-400 uppercase font-bold">{item.type} · ID: {item.id}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold text-[10px] border border-stone-200">
                          {item.local_nome || 'Sala de APH / Geral'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.lote || item.data_validade ? (
                          <div className="space-y-0.5">
                            {item.lote && <p className="font-bold text-stone-700 text-[11px]">Lote: {item.lote}</p>}
                            {item.data_validade && (
                              <p className={`text-[10px] font-black ${vencido ? 'text-red-700' : vencendo ? 'text-amber-700' : 'text-stone-500'}`}>
                                Val: {new Date(item.data_validade + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">Não informado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-base font-black px-2.5 py-0.5 rounded-lg ${
                            estCritico ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {item.quantidade} {item.unidade_medida || 'un'}
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirModalLimites(item)}
                            className="group/lim mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-[10px] text-stone-600 hover:text-amber-900 transition-all cursor-pointer shadow-2xs"
                            title="Clique para alterar Estoque Mínimo e Ideal/Máximo"
                          >
                            <span>Mín: <strong>{estMin}</strong> | Ideal: <strong>{item.estoque_ideal || 20}</strong></span>
                            <span className="material-symbols-outlined text-[12px] text-amber-600 group-hover/lim:scale-110 transition-transform">edit</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {vencido ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-red-600 text-white shadow-xs">
                              VENCIDO
                            </span>
                          ) : vencendo ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500 text-white shadow-xs">
                              VENCE EM BREVE
                            </span>
                          ) : null}

                          {estCritico ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 border border-red-300">
                              ESTOQUE CRÍTICO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">
                              ABASTECIDO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => abrirModalMov(item, 'ENTRADA')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-black text-[10px] uppercase shadow-xs flex items-center gap-1"
                            title="Dar entrada / reabastecer"
                          >
                            <span className="material-symbols-outlined text-[12px]">add</span>
                            Entrada
                          </button>

                          <button
                            onClick={() => abrirModalLimites(item)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-black text-[10px] uppercase border border-amber-300 shadow-xs flex items-center gap-1"
                            title="Definir estoque mínimo e ideal/máximo"
                          >
                            <span className="material-symbols-outlined text-[12px]">tune</span>
                            Limites
                          </button>

                          <button
                            onClick={() => abrirModalMov(item, 'AJUSTE_INVENTARIO')}
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-black text-[10px] uppercase border border-stone-200 flex items-center gap-1"
                            title="Ajustar saldo e parâmetros"
                          >
                            <span className="material-symbols-outlined text-[12px]">tune</span>
                            Ajuste
                          </button>

                          {item.historico_movimentacoes && item.historico_movimentacoes.length > 0 && (
                            <button
                              onClick={() => {
                                setItemSelecionado(item);
                                setModalHistAberto(true);
                              }}
                              className="p-1 text-stone-500 hover:text-stone-800 rounded hover:bg-stone-100"
                              title="Ver histórico de movimentações"
                            >
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Movimentação */}
      {modalAberto && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rustic-border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-rustic-brown">
                  {tipoMov === 'ENTRADA' ? '➕ Entrada de Material' : tipoMov === 'AJUSTE_INVENTARIO' ? '⚙️ Ajuste de Inventário' : '⚠️ Baixa por Avaria'}
                </h3>
                <p className="text-xs text-stone-500 font-bold">{itemSelecionado.name}</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-stone-400 hover:text-stone-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-600 block mb-1">
                  {tipoMov === 'ENTRADA' ? 'Quantidade a Adicionar' : tipoMov === 'AJUSTE_INVENTARIO' ? 'Novo Saldo Real Contado' : 'Quantidade a Retirar'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantidadeMov}
                  onChange={e => setQuantidadeMov(Number(e.target.value))}
                  className="w-full h-10 px-3 border rounded-lg font-black text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Número do Lote</label>
                  <input
                    type="text"
                    value={loteMov}
                    onChange={e => setLoteMov(e.target.value)}
                    placeholder="Ex: LT-2026-44"
                    className="w-full h-10 px-3 border rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Data de Validade</label>
                  <input
                    type="date"
                    value={validadeMov}
                    onChange={e => setValidadeMov(e.target.value)}
                    className="w-full h-10 px-3 border rounded-lg font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="1"
                    value={estMinMov}
                    onChange={e => setEstMinMov(Number(e.target.value))}
                    className="w-full h-10 px-3 border rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Estoque Ideal</label>
                  <input
                    type="number"
                    min="1"
                    value={estIdealMov}
                    onChange={e => setEstIdealMov(Number(e.target.value))}
                    className="w-full h-10 px-3 border rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-600 block mb-1">Motivo / Observação</label>
                <input
                  type="text"
                  value={motivoMov}
                  onChange={e => setMotivoMov(e.target.value)}
                  placeholder="Ex: Compra NF 1234, Doação, Contagem semanal..."
                  className="w-full h-10 px-3 border rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarMov}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-xs shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {modalHistAberto && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rustic-border space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-rustic-brown">📜 Histórico de Movimentações</h3>
                <p className="text-xs text-stone-500 font-bold">{itemSelecionado.name}</p>
              </div>
              <button onClick={() => setModalHistAberto(false)} className="text-stone-400 hover:text-stone-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {(itemSelecionado.historico_movimentacoes || []).map((h, i) => (
                <div key={i} className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      h.tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' :
                      h.tipo === 'REPOSICAO_VIATURA' ? 'bg-blue-100 text-blue-800' : 'bg-stone-200 text-stone-800'
                    }`}>
                      {h.tipo}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {new Date(h.data).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="font-bold text-stone-800">
                    Qtd: {h.quantidade} un | Saldo: {h.saldo_anterior} ➔ {h.saldo_novo}
                  </p>
                  <p className="text-stone-600 text-[11px]">{h.motivo}</p>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">Resp: {h.responsavel}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setModalHistAberto(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dedicado para Alteração Manual de Limites de Estoque (Mínimo & Ideal/Máximo) */}
      {modalLimitesAberto && itemLimites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rustic-border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  ⚙️
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-rustic-brown">
                    Definir Limites de Estoque
                  </h3>
                  <p className="text-xs text-stone-500 font-bold">{itemLimites.name}</p>
                </div>
              </div>
              <button onClick={() => setModalLimitesAberto(false)} className="text-stone-400 hover:text-stone-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">info</span>
                Parâmetros Personalizados por Insumo
              </p>
              <p className="text-[11px] text-amber-800">
                Defina a quantidade mínima de segurança (que gera alerta crítico e compras automáticas) e a quantidade ideal/máxima para abastecimento da Sala de APH.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                <span className="text-[11px] text-stone-500 font-bold block">Saldo Físico Atual:</span>
                <span className="text-sm font-black text-stone-800">
                  {itemLimites.quantidade} {itemLimites.unidade_medida || 'un'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    🚨 Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={novoMinimo}
                    onChange={e => setNovoMinimo(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-stone-300 rounded-lg font-black text-sm focus:border-amber-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Alerta de reposição se saldo &le; {novoMinimo}
                  </span>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    📦 Estoque Ideal / Máx.
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={novoIdeal}
                    onChange={e => setNovoIdeal(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-stone-300 rounded-lg font-black text-sm focus:border-amber-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Capacidade ideal de prateleira
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalLimitesAberto(false)}
                disabled={salvandoLimites}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarLimites}
                disabled={salvandoLimites}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-xs shadow flex items-center gap-1.5"
              >
                {salvandoLimites ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    Salvar Limites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
