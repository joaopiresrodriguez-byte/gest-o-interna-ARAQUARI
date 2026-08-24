import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { Vehicle, CompartimentoViatura } from '../../services/types';
import { toast } from 'sonner';
import { ModalEditarItemB4 } from './ModalEditarItemB4';
import { ModalAdicionarChecklistItem } from './ModalAdicionarChecklistItem';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisualizacaoViaturaProps {
  viatura: Vehicle;
  onBack?: () => void;
  onAddItem?: (viaturaId: string, compartimentoId?: string) => void;
}

interface ItemFlota {
  id: string;
  nome: string;
  tipo?: string;
  quantidade: number;
  status: string;
  compartimento_id?: string;
  local_id?: string;
  fonte: 'fleet' | 'equipamentos' | 'materiais' | 'checklist';
  rawItem: Vehicle;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeText = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.startsWith('{')) {
      try { const p = JSON.parse(val); return p.raw || p.descricao || p.details || ''; } catch { return val; }
    }
    return val;
  }
  if (typeof val === 'object') return (val as any).raw || (val as any).descricao || '';
  return String(val);
};

const statusInfo = (s: string) => {
  if (!s || s === 'active') return { label: 'Ativo', cls: 'bg-green-50 text-green-700 border-green-200' };
  if (s === 'maintenance') return { label: 'Manutenção', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (s === 'down') return { label: 'Inativo', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (s === 'cautelado') return { label: 'Cautelado', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { label: s, cls: 'bg-stone-50 text-stone-600 border-stone-200' };
};

const fonteEmoji: Record<ItemFlota['fonte'], string> = {
  fleet: '🔩',
  equipamentos: '🔧',
  materiais: '📦',
  checklist: '✅',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const VisualizacaoViatura: React.FC<VisualizacaoViaturaProps> = ({
  viatura,
  onBack,
  onAddItem,
}) => {
  const [compartimentos, setCompartimentos] = useState<CompartimentoViatura[]>([]);
  const [itens, setItens] = useState<ItemFlota[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemParaEditar, setItemParaEditar] = useState<Vehicle | null>(null);
  const [expandedComp, setExpandedComp] = useState<Record<string, boolean>>({});
  const [qrModalComp, setQrModalComp] = useState<CompartimentoViatura | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  // Modal de adição de checklist item
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [compartimentoParaAdd, setCompartimentoParaAdd] = useState<CompartimentoViatura | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Compartimentos desta viatura
      const { data: dataComp, error: errComp } = await supabase
        .from('compartimentos_viatura')
        .select('*')
        .eq('viatura_id', viatura.id)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (errComp) throw errComp;
      const comps = dataComp || [];
      setCompartimentos(comps);

      const compIds = comps.map((c: CompartimentoViatura) => c.id);
      const todosItens: ItemFlota[] = [];

      // 2. Tabela `fleet` (equipamentos não-viatura)
      let queryFleet = supabase
        .from('fleet')
        .select('*')
        .neq('type', 'Viatura');

      if (compIds.length > 0) {
        queryFleet = queryFleet.or(`local_id.eq.${viatura.id},compartimento_id.in.(${compIds.join(',')})`);
      } else {
        queryFleet = queryFleet.eq('local_id', viatura.id);
      }

      const { data: dataFleet } = await queryFleet;
      if (dataFleet) {
        dataFleet.forEach((f: any) => {
          todosItens.push({
            id: f.id,
            nome: f.name || 'Item sem nome',
            tipo: f.type || 'Equipamento',
            quantidade: Number(f.quantidade) || 1,
            status: f.status || 'active',
            compartimento_id: f.compartimento_id || undefined,
            local_id: f.local_id || undefined,
            fonte: 'fleet',
            rawItem: { ...f, details: safeText(f.details) } as Vehicle,
          });
        });
      }

      // 3. Tabela `equipamentos`
      let queryEquip = supabase.from('equipamentos').select('*');

      if (compIds.length > 0) {
        queryEquip = queryEquip.or(`viatura_id.eq.${viatura.id},compartimento_id.in.(${compIds.join(',')})`);
      } else {
        queryEquip = queryEquip.eq('viatura_id', viatura.id);
      }

      const { data: dataEquip } = await queryEquip;
      if (dataEquip) {
        dataEquip.forEach((e: any) => {
          if (!todosItens.some(i => i.id === e.id)) {
            todosItens.push({
              id: e.id,
              nome: e.nome || 'Equipamento',
              tipo: e.tipo || 'Equipamento',
              quantidade: Number(e.quantidade) || 1,
              status: e.status === 'Ok' || e.status === 'ativo' ? 'active' : (e.status || 'active'),
              compartimento_id: e.compartimento_id || undefined,
              local_id: e.viatura_id || undefined,
              fonte: 'equipamentos',
              rawItem: {
                id: e.id,
                name: e.nome,
                type: (e.tipo as any) || 'Equipamento',
                status: e.status === 'Ok' ? 'active' : 'maintenance',
                details: e.numero_serie ? `Série: ${e.numero_serie}` : '',
                quantidade: e.quantidade || 1,
                compartimento_id: e.compartimento_id,
              } as Vehicle,
            });
          }
        });
      }

      // 4. Tabela `materiais_consumo`
      if (compIds.length > 0) {
        const { data: dataConsumo } = await supabase
          .from('materiais_consumo')
          .select('*')
          .in('compartimento_id', compIds);

        if (dataConsumo) {
          dataConsumo.forEach((c: any) => {
            if (!todosItens.some(i => i.id === c.id)) {
              todosItens.push({
                id: c.id,
                nome: c.nome || c.description || 'Material de Consumo',
                tipo: 'Material de Consumo',
                quantidade: Number(c.quantidade || c.quantity) || 1,
                status: 'active',
                compartimento_id: c.compartimento_id || undefined,
                fonte: 'materiais',
                rawItem: {
                  id: c.id,
                  name: c.nome || c.description,
                  type: 'Material',
                  status: 'active',
                  details: c.unidade ? `Unidade: ${c.unidade}` : '',
                  quantidade: c.quantidade || c.quantity || 1,
                  compartimento_id: c.compartimento_id,
                } as Vehicle,
              });
            }
          });
        }
      }

      // 5. Tabela `checklist_items` — busca por viatura_id E por compartimento_id
      const { data: dataChecklist } = await supabase
        .from('checklist_items')
        .select('*')
        .or(
          compIds.length > 0
            ? `viatura_id.eq.${viatura.id},compartimento_id.in.(${compIds.join(',')})`
            : `viatura_id.eq.${viatura.id}`
        )
        .eq('is_active', true);

      if (dataChecklist) {
        dataChecklist.forEach((ci: any) => {
          if (!todosItens.some(i => i.id === ci.id)) {
            todosItens.push({
              id: ci.id,
              nome: ci.item_name || 'Item de Checklist',
              tipo: ci.category ? `${ci.category}` : 'Equipamento',
              quantidade: Number(ci.quantidade) || 1,
              status: ci.is_active === false ? 'down' : 'active',
              // Prioriza compartimento_id direto; se não tiver, fica sem compartimento
              compartimento_id: ci.compartimento_id || undefined,
              local_id: ci.viatura_id || undefined,
              fonte: 'checklist',
              rawItem: {
                id: ci.id,
                name: ci.item_name,
                type: (ci.category as any) || 'Equipamento',
                status: ci.is_active === false ? 'down' : 'active',
                details: ci.description || '',
                quantidade: ci.quantidade || 1,
                compartimento_id: ci.compartimento_id || undefined,
                // Sinalizador para o modal de edição saber a origem
                _source: 'checklist',
              } as any,
            });
          }
        });
      }

      setItens(todosItens);
    } catch (err: any) {
      console.error('Erro ao carregar visualização da viatura:', err);
      toast.error('Erro ao carregar itens: ' + (err?.message || 'Falha de conexão'));
    } finally {
      setLoading(false);
    }
  }, [viatura.id]);

  useEffect(() => {
    if (viatura?.id) carregarDados();
  }, [viatura.id, carregarDados]);

  const itensPorComp = (compId: string) => itens.filter(i => i.compartimento_id === compId);
  const itensSemComp = itens.filter(i => !i.compartimento_id);
  const totalUnidades = itens.reduce((acc, i) => acc + i.quantidade, 0);

  const handleEditar = (item: ItemFlota) => {
    setItemParaEditar(item.rawItem || {
      id: item.id, name: item.nome, details: '', status: 'active',
      type: 'Equipamento', quantidade: item.quantidade,
      compartimento_id: item.compartimento_id, local_id: item.local_id,
    } as Vehicle);
  };

  const handleExcluirChecklist = async (item: ItemFlota) => {
    if (!confirm(`Deseja remover "${item.nome}" permanentemente?`)) return;
    try {
      setDeletandoId(item.id);
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      toast.success(`"${item.nome}" removido.`);
      await carregarDados();
    } catch (err: any) {
      toast.error('Erro ao remover item: ' + (err?.message || 'Falha'));
    } finally {
      setDeletandoId(null);
    }
  };

  const abrirModalAdd = (comp: CompartimentoViatura | null) => {
    setCompartimentoParaAdd(comp);
    setModalAddOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 border-4 border-stone-200 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">Carregando itens da viatura...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Botão Voltar */}
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors group">
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          Voltar para listagem
        </button>
      )}

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">🚒</div>
            <div>
              <h1 className="text-xl font-black">{viatura.name}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {viatura.plate && <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded">{viatura.plate}</span>}
                {viatura.brand && <span className="text-xs text-white/60 font-semibold">{viatura.brand}</span>}
                {viatura.year && <span className="text-xs text-white/60 font-semibold">{viatura.year}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/10 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wide">Compartimentos</p>
              <p className="text-xl font-black mt-0.5">{compartimentos.length}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wide">Tipos de Item</p>
              <p className="text-xl font-black mt-0.5">{itens.length}</p>
            </div>
            <div className="bg-amber-500/80 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <p className="text-[10px] uppercase font-bold text-white/70 tracking-wide">Total Unidades</p>
              <p className="text-xl font-black mt-0.5">{totalUnidades}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── EMPTY STATE ───────────────────────────────────────────────── */}
      {itens.length === 0 && compartimentos.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-amber-900">Nenhum item cadastrado nesta viatura</p>
          <p className="text-xs text-amber-700 mt-1">
            Primeiro cadastre os compartimentos, depois adicione os equipamentos.
          </p>
          <button
            onClick={() => abrirModalAdd(null)}
            className="mt-4 px-5 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors"
          >
            + Adicionar Item
          </button>
        </div>
      )}

      {itens.length === 0 && compartimentos.length > 0 && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center">
          <p className="text-3xl mb-2">🗂️</p>
          <p className="font-bold text-stone-700 text-sm">Compartimentos cadastrados, mas sem itens ainda</p>
          <p className="text-xs text-stone-500 mt-1">Adicione equipamentos a cada compartimento pelo botão abaixo.</p>
        </div>
      )}

      {/* ── COMPARTIMENTOS ─────────────────────────────────────────────── */}
      {compartimentos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <span className="material-symbols-outlined text-stone-400 text-[18px]">view_module</span>
            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500">Compartimentos ({compartimentos.length})</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {compartimentos.map(comp => {
              const compItens = itensPorComp(comp.id);
              const isOpen = expandedComp[comp.id] !== false;

              return (
                <div key={comp.id} className="bg-white border border-rustic-border rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedComp(p => ({ ...p, [comp.id]: !isOpen }))}
                    className="w-full bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center hover:bg-stone-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center text-base">📦</div>
                      <div className="text-left">
                        <p className="font-bold text-stone-800 text-sm">{comp.nome}</p>
                        {comp.posicao && <p className="text-[10px] text-stone-500 font-semibold">{comp.posicao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${compItens.length > 0 ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-500'}`}>
                        {compItens.length} {compItens.length === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="material-symbols-outlined text-stone-400 text-[18px]">
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <>
                      <div className="divide-y divide-stone-100 min-h-[60px]">
                        {compItens.length === 0 ? (
                          <p className="text-xs text-stone-400 italic py-5 text-center">Nenhum equipamento neste compartimento.</p>
                        ) : (
                          compItens.map(item => {
                            const st = statusInfo(item.status);
                            const emoji = fonteEmoji[item.fonte];
                            const isDeleting = deletandoId === item.id;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors group ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <span className="text-base">{emoji}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-stone-800 truncate">{item.nome}</p>
                                    {item.tipo && <p className="text-[10px] text-stone-400 capitalize">{item.tipo}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">x{item.quantidade}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.cls}`}>{st.label}</span>

                                  {/* Editar */}
                                  <button
                                    onClick={() => handleEditar(item)}
                                    title="Editar item"
                                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">edit</span>
                                  </button>

                                  {/* Remover (apenas checklist_items) */}
                                  {item.fonte === 'checklist' && (
                                    <button
                                      onClick={() => handleExcluirChecklist(item)}
                                      title="Remover item"
                                      disabled={isDeleting}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Rodapé do compartimento */}
                      <div className="p-3 border-t border-stone-100 bg-stone-50/40 flex items-center gap-2">
                        <button
                          onClick={() => abrirModalAdd(comp)}
                          className="flex-1 py-1.5 text-[11px] font-bold text-stone-600 hover:text-stone-900 border border-dashed border-stone-300 hover:border-stone-500 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span> Adicionar item
                        </button>
                        {onAddItem && (
                          <button
                            onClick={() => onAddItem(viatura.id, comp.id)}
                            title="Adicionar via aba Cadastro"
                            className="py-1.5 px-2 text-[11px] font-bold text-stone-400 hover:text-stone-700 border border-stone-200 hover:border-stone-400 bg-white rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                          </button>
                        )}
                        <button
                          onClick={() => setQrModalComp(comp)}
                          className="py-1.5 px-3 text-[11px] font-bold text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 bg-white rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">qr_code</span> QR
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ITENS SEM COMPARTIMENTO ────────────────────────────────────── */}
      {itensSemComp.length > 0 && (
        <div className="bg-white border border-rustic-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <div>
                <h3 className="font-bold text-stone-800 text-sm">Itens da Viatura (geral)</h3>
                <p className="text-[10px] text-stone-500">Equipamentos sem compartimento específico</p>
              </div>
            </div>
            <span className="text-xs font-black bg-stone-200 text-stone-700 px-2.5 py-1 rounded-full">
              {itensSemComp.length} {itensSemComp.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {itensSemComp.map(item => {
              const st = statusInfo(item.status);
              const emoji = fonteEmoji[item.fonte];
              const isDeleting = deletandoId === item.id;
              return (
                <div key={item.id} className={`flex items-center justify-between px-5 py-3 hover:bg-stone-50 transition-colors group ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center text-sm flex-shrink-0">{emoji}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">{item.nome}</p>
                      {item.tipo && <p className="text-[10px] text-stone-500 font-semibold capitalize">{item.tipo}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">x{item.quantidade}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                    <button
                      onClick={() => handleEditar(item)}
                      title="Editar item"
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    {item.fonte === 'checklist' && (
                      <button
                        onClick={() => handleExcluirChecklist(item)}
                        title="Remover item"
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-stone-100 bg-stone-50/50">
            <button
              onClick={() => abrirModalAdd(null)}
              className="w-full py-2 text-xs font-bold text-stone-600 hover:text-stone-900 border border-dashed border-stone-300 hover:border-stone-500 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> Adicionar item à viatura
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL ADICIONAR CHECKLIST ITEM ─────────────────────────────── */}
      <ModalAdicionarChecklistItem
        isOpen={modalAddOpen}
        onClose={() => setModalAddOpen(false)}
        onSaved={carregarDados}
        viaturaId={viatura.id}
        compartimento={compartimentoParaAdd}
      />

      {/* ── MODAL EDITAR ITEM ──────────────────────────────────────────── */}
      <ModalEditarItemB4
        item={itemParaEditar}
        isOpen={!!itemParaEditar}
        onClose={() => setItemParaEditar(null)}
        onSaved={() => { setItemParaEditar(null); carregarDados(); }}
      />

      {/* ── MODAL QR CODE ──────────────────────────────────────────────── */}
      {qrModalComp && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-center border border-rustic-border shadow-2xl">
            <h3 className="text-base font-bold text-rustic-brown">QR Code do Compartimento</h3>
            <p className="text-xs text-stone-600 font-semibold">{qrModalComp.nome} — {viatura.name}</p>
            <div className="flex justify-center py-4 bg-stone-50 rounded-xl border border-stone-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/extrato/compartimento/${qrModalComp.id}`)}`}
                alt="QR Code"
                className="w-44 h-44 rounded-lg shadow-sm"
              />
            </div>
            <p className="text-[11px] font-mono text-stone-400 break-all bg-stone-100 p-2 rounded">
              {`${window.location.origin}/extrato/compartimento/${qrModalComp.id}`}
            </p>
            <div className="flex gap-2">
              <a href={`/extrato/compartimento/${qrModalComp.id}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl text-center transition-colors">
                Abrir Extrato
              </a>
              <button onClick={() => setQrModalComp(null)} className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizacaoViatura;
