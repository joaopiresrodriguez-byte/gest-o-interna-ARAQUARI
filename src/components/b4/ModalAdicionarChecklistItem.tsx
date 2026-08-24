import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { CompartimentoViatura } from '../../services/types';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalAdicionarChecklistItemProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  viaturaId: string;
  compartimento: CompartimentoViatura | null;
}

type Categoria = 'equipamentos' | 'materiais' | 'viaturas';

const CATEGORIAS: { value: Categoria; label: string; emoji: string }[] = [
  { value: 'equipamentos', label: 'Equipamento', emoji: '🔧' },
  { value: 'materiais', label: 'Material de Consumo', emoji: '📦' },
  { value: 'viaturas', label: 'Viatura / Veículo', emoji: '🚒' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ModalAdicionarChecklistItem: React.FC<ModalAdicionarChecklistItemProps> = ({
  isOpen,
  onClose,
  onSaved,
  viaturaId,
  compartimento,
}) => {
  const [itemName, setItemName] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('equipamentos');
  const [quantidade, setQuantidade] = useState(1);
  const [description, setDescription] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItemName('');
      setCategoria('equipamentos');
      setQuantidade(1);
      setDescription('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName.trim()) {
      toast.error('O nome do item é obrigatório!');
      return;
    }

    if (quantidade < 1) {
      toast.error('A quantidade deve ser pelo menos 1.');
      return;
    }

    try {
      setSalvando(true);

      const payload: Record<string, unknown> = {
        item_name: itemName.trim(),
        category: categoria,
        quantidade,
        description: description.trim() || null,
        viatura_id: viaturaId,
        is_active: true,
        sort_order: 0,
      };

      if (compartimento?.id) {
        payload.compartimento_id = compartimento.id;
      }

      const { error } = await supabase
        .from('checklist_items')
        .insert([payload]);

      if (error) throw error;

      toast.success(`"${itemName.trim()}" adicionado com sucesso!`);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao adicionar item:', err);
      toast.error('Erro ao salvar item: ' + (err?.message || 'Falha de conexão'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-stone-800 to-stone-700 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-white">Adicionar Item</h2>
            {compartimento && (
              <p className="text-[11px] text-white/60 mt-0.5 font-semibold">
                📦 {compartimento.nome}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSalvar} className="p-5 space-y-4">

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">
              Nome do Item <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="Ex: Mangueira 38mm, Esguicho regulável..."
              className="w-full h-10 px-3 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 transition-all"
              autoFocus
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategoria(cat.value)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all flex flex-col items-center gap-1 ${
                    categoria === cat.value
                      ? 'bg-stone-800 text-white border-stone-800 shadow-sm'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">Quantidade</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 flex items-center justify-center text-stone-700 font-bold transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={9999}
                value={quantidade}
                onChange={e => setQuantidade(Math.max(1, Number(e.target.value)))}
                className="flex-1 h-9 px-3 rounded-xl border border-stone-300 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setQuantidade(q => q + 1)}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 flex items-center justify-center text-stone-700 font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">Descrição <span className="text-stone-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Número de série, especificação..."
              className="w-full h-10 px-3 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="flex-1 py-2.5 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !itemName.trim()}
              className="flex-1 py-2.5 bg-stone-800 text-white text-xs font-bold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
            >
              {salvando ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Adicionar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAdicionarChecklistItem;
