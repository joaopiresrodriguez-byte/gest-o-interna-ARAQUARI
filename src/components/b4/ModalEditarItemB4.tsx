import React, { useState, useEffect } from 'react';
import { Vehicle, CompartimentoViatura, LocalEquipamento } from '../../services/types';
import { supabase } from '../../services/supabase';
import { SupabaseService } from '../../services/SupabaseService';
import { toast } from 'sonner';

interface ModalEditarItemB4Props {
  item: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ModalEditarItemB4: React.FC<ModalEditarItemB4Props> = ({
  item,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [nome, setNome] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<Vehicle['status']>('active');
  const [quantidadeAtual, setQuantidadeAtual] = useState(1);
  const [modoQuantidade, setModoQuantidade] = useState<'substituir' | 'adicionar'>('substituir');
  const [valorQuantidade, setValorQuantidade] = useState<number>(1);
  
  // Destino / Compartimento / Local
  const [tipoDestino, setTipoDestino] = useState<'ambiente' | 'viatura'>('ambiente');
  const [localId, setLocalId] = useState<string>('');
  const [viaturaId, setViaturaId] = useState<string>('');
  const [compartimentoId, setCompartimentoId] = useState<string>('');
  
  // Listas de opções
  const [locais, setLocais] = useState<LocalEquipamento[]>([]);
  const [viaturas, setViaturas] = useState<Vehicle[]>([]);
  const [compartimentos, setCompartimentos] = useState<CompartimentoViatura[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setNome(item.name || '');
      setDetails(item.details || '');
      setStatus(item.status || 'active');
      const qtdInitial = item.quantidade || 1;
      setQuantidadeAtual(qtdInitial);
      setValorQuantidade(qtdInitial);
      setModoQuantidade('substituir');

      // Definir destino inicial
      if (item.compartimento_id) {
        setTipoDestino('viatura');
        setCompartimentoId(item.compartimento_id);
      } else if (item.local_id) {
        setTipoDestino('ambiente');
        setLocalId(item.local_id);
      } else {
        setTipoDestino('ambiente');
      }

      // Carregar listas
      carregarListas(item);
    }
  }, [isOpen, item]);

  const carregarListas = async (current: Vehicle) => {
    try {
      const [locaisData, fleetData] = await Promise.all([
        SupabaseService.getLocaisEquipamento(),
        SupabaseService.getFleet(),
      ]);
      setLocais(locaisData || []);
      const viatList = (fleetData || []).filter(f => f.type === 'Viatura');
      setViaturas(viatList);

      // Se item está vinculado a compartimento, buscar a qual viatura pertence esse compartimento
      if (current.compartimento_id) {
        const { data: compData } = await supabase
          .from('compartimentos_viatura')
          .select('id, viatura_id')
          .eq('id', current.compartimento_id)
          .single();

        if (compData?.viatura_id) {
          setViaturaId(compData.viatura_id);
          carregarCompartimentosDaViatura(compData.viatura_id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar opções para edição:', err);
    }
  };

  const carregarCompartimentosDaViatura = async (vId: string) => {
    if (!vId) {
      setCompartimentos([]);
      return;
    }
    const { data } = await supabase
      .from('compartimentos_viatura')
      .select('*')
      .eq('viatura_id', vId)
      .eq('ativo', true)
      .order('ordem');
    setCompartimentos(data || []);
  };

  const handleViaturaChange = (vId: string) => {
    setViaturaId(vId);
    setCompartimentoId('');
    carregarCompartimentosDaViatura(vId);
  };

  const novaQuantidadeCalculada =
    modoQuantidade === 'substituir'
      ? Math.max(1, Number(valorQuantidade) || 1)
      : Math.max(1, quantidadeAtual + (Number(valorQuantidade) || 0));

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item?.id) return;
    if (!nome.trim()) return toast.error('Nome do item é obrigatório!');

    setSalvando(true);
    try {
      const finalLocalId = tipoDestino === 'ambiente' ? localId || null : null;
      const finalCompartimentoId = tipoDestino === 'viatura' ? compartimentoId || null : null;

      const isChecklistItem = (item as any)._source === 'checklist';

      if (isChecklistItem) {
        // ── Atualizar tabela checklist_items ──────────────────────────
        const { error } = await supabase
          .from('checklist_items')
          .update({
            item_name: nome.trim(),
            description: details.trim() || null,
            quantidade: novaQuantidadeCalculada,
            compartimento_id: finalCompartimentoId,
            viatura_id: tipoDestino === 'viatura' ? viaturaId || null : (item as any).viatura_id || null,
          })
          .eq('id', item.id);

        if (error) throw error;
      } else {
        // ── Atualizar tabela fleet (padrão) ───────────────────────────
        let locationName: string | undefined = undefined;
        if (tipoDestino === 'ambiente' && finalLocalId) {
          const loc = locais.find(l => l.id === finalLocalId);
          if (loc) locationName = loc.nome;
        } else if (tipoDestino === 'viatura' && viaturaId) {
          const v = viaturas.find(v => v.id === viaturaId);
          if (v) locationName = v.name;
        }

        const updates: Partial<Vehicle> & { quantidade?: number } = {
          name: nome.trim(),
          details: details.trim(),
          status,
          quantidade: novaQuantidadeCalculada,
          local_id: finalLocalId as any,
          compartimento_id: finalCompartimentoId as any,
          ...(locationName ? { location: locationName } : {}),
        };

        const { error: errFleet } = await supabase
          .from('fleet')
          .update(updates)
          .eq('id', item.id);

        if (errFleet) throw errFleet;

        // Atualização complementar em equipamentos
        try {
          await supabase
            .from('equipamentos')
            .update({
              nome: nome.trim(),
              quantidade: novaQuantidadeCalculada,
              local_id: finalLocalId,
              compartimento_id: finalCompartimentoId,
              viatura_id: tipoDestino === 'viatura' ? viaturaId || null : null,
            })
            .eq('nome', item.name);
        } catch (e) {
          console.warn('Atualização complementar em equipamentos ignorada:', e);
        }
      }

      toast.success('Item atualizado com sucesso!');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar item:', err);
      toast.error('Erro ao atualizar item: ' + (err.message || 'Falha de conexão'));
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-rustic-border my-6">
        {/* Cabeçalho */}
        <div className="bg-stone-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">edit_square</span>
            <h3 className="font-bold text-base">Editar Item B4</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSalvar} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Nome */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase">
              Nome do Item <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase">Descrição / Observações</label>
            <textarea
              rows={2}
              value={details}
              onChange={e => setDetails(e.target.value)}
              className="w-full p-3 rounded-lg border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Quantidade com opções */}
          <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1">
                <span>📦</span> Quantidade
              </label>
              <span className="text-xs font-bold bg-white text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                Atual: {quantidadeAtual}
              </span>
            </div>

            {/* Alternador de Modo */}
            <div className="flex bg-white p-1 rounded-lg border border-amber-200 gap-1">
              <button
                type="button"
                onClick={() => {
                  setModoQuantidade('substituir');
                  setValorQuantidade(quantidadeAtual);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  modoQuantidade === 'substituir'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                Substituir Total
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoQuantidade('adicionar');
                  setValorQuantidade(1);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  modoQuantidade === 'adicionar'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                ➕ Somar ao Estoque
              </button>
            </div>

            {/* Campo de Entrada de Quantidade */}
            <div className="flex items-center gap-3">
              {modoQuantidade === 'substituir' ? (
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Nova quantidade total:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={valorQuantidade}
                    onChange={e => setValorQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm font-bold"
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Unidades a adicionar (+):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={valorQuantidade}
                    onChange={e => setValorQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm font-bold text-green-700"
                  />
                </div>
              )}
            </div>

            {/* Preview em Tempo Real */}
            <div className="text-center bg-white py-2 rounded-lg border border-amber-200 text-xs font-bold text-amber-900">
              Preview: Quantidade atual: <strong>{quantidadeAtual}</strong> → Nova quantidade:{' '}
              <strong className="text-primary text-sm">{novaQuantidadeCalculada}</strong>
            </div>
          </div>

          {/* Troca de Compartimento / Local */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
            <label className="text-xs font-bold text-stone-700 uppercase flex items-center gap-1">
              <span>📍</span> Localização / Compartimento
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipoDestino('ambiente');
                  setCompartimentoId('');
                  setViaturaId('');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  tipoDestino === 'ambiente'
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                }`}
              >
                🏠 Ambiente
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoDestino('viatura');
                  setLocalId('');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  tipoDestino === 'viatura'
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                }`}
              >
                🚒 Viatura
              </button>
            </div>

            {tipoDestino === 'ambiente' && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-600">Ambiente de Destino</label>
                <select
                  value={localId}
                  onChange={e => setLocalId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm"
                >
                  <option value="">Selecione o ambiente...</option>
                  {locais.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tipoDestino === 'viatura' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-stone-600">Viatura de Destino</label>
                  <select
                    value={viaturaId}
                    onChange={e => handleViaturaChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm"
                  >
                    <option value="">Selecione a viatura...</option>
                    {viaturas.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.plate ? `— ${v.plate}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {viaturaId && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-stone-600">
                      Compartimento <span className="text-stone-400 font-normal">(Opcional)</span>
                    </label>
                    <select
                      value={compartimentoId}
                      onChange={e => setCompartimentoId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm"
                    >
                      <option value="">Nenhum (Sem compartimento)</option>
                      {compartimentos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.posicao ? `(${c.posicao})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
