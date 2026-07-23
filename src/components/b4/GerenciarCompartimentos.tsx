import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { CompartimentoViatura, Vehicle } from '../../services/types';
import { toast } from 'sonner';

interface GerenciarCompartimentosProps {
  viatura: Vehicle;
  onClose?: () => void;
  onUpdated?: () => void;
}

export const POSICOES_COMPARTIMENTO = [
  'Lateral Esquerdo',
  'Lateral Direito',
  'Traseiro',
  'Painel Frontal',
  'Frontal',
  'Teto',
  'Cabine',
  'Externo',
  'Outro'
];

export const GerenciarCompartimentos: React.FC<GerenciarCompartimentosProps> = ({ viatura, onClose, onUpdated }) => {
  const [compartimentos, setCompartimentos] = useState<CompartimentoViatura[]>([]);
  const [loading, setLoading] = useState(false);
  const [exibirForm, setExibirForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [posicao, setPosicao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ordem, setOrdem] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  const recarregarCompartimentos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('compartimentos_viatura')
        .select('*')
        .eq('viatura_id', viatura.id)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setCompartimentos(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar compartimentos:', err);
      if (err?.message?.includes('schema cache') || err?.code === 'PGRST204' || err?.code === '42P01') {
        toast.error('Tabela compartimentos_viatura não encontrada no banco. Execute a migração no Supabase SQL Editor.');
      } else {
        toast.error(`Erro ao carregar compartimentos: ${err.message || 'Erro de conexão'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viatura?.id) {
      recarregarCompartimentos();
    }
  }, [viatura?.id]);

  const resetForm = () => {
    setNome('');
    setPosicao('');
    setDescricao('');
    setOrdem(compartimentos.length + 1);
    setEditingId(null);
    setExibirForm(false);
  };

  const abrirEdicao = (c: CompartimentoViatura) => {
    setEditingId(c.id);
    setNome(c.nome);
    setPosicao(c.posicao || '');
    setDescricao(c.descricao || '');
    setOrdem(c.ordem || 0);
    setExibirForm(true);
  };

  const criarCompartimento = async (dados: {
    viatura_id: string;
    nome: string;
    posicao: string;
    descricao: string;
    ordem: number;
  }) => {
    const { error } = await supabase
      .from('compartimentos_viatura')
      .insert(dados);

    if (error) throw error;
    await recarregarCompartimentos();
  };

  const editarCompartimento = async (id: string, dados: Partial<CompartimentoViatura>) => {
    const { error } = await supabase
      .from('compartimentos_viatura')
      .update(dados)
      .eq('id', id);

    if (error) throw error;
    await recarregarCompartimentos();
  };

  const removerCompartimento = async (id: string) => {
    // Verificar se tem equipamentos/materiais em 'equipamentos', 'fleet' ou 'materiais_consumo' antes de remover:
    const { count: countEq } = await supabase
      .from('equipamentos')
      .select('id', { count: 'exact', head: true })
      .eq('compartimento_id', id);

    const { count: countFleet } = await supabase
      .from('fleet')
      .select('id', { count: 'exact', head: true })
      .eq('compartimento_id', id);

    const { count: countConsumo } = await supabase
      .from('materiais_consumo')
      .select('id', { count: 'exact', head: true })
      .eq('compartimento_id', id);

    const totalCount = (countEq || 0) + (countFleet || 0) + (countConsumo || 0);

    if (totalCount > 0) {
      throw new Error(
        `Este compartimento possui ${totalCount} item(ns) (equipamentos/materiais). Mova-os antes de remover.`
      );
    }

    const { error } = await supabase
      .from('compartimentos_viatura')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await recarregarCompartimentos();
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      return toast.error('O nome do compartimento é obrigatório!');
    }

    try {
      setSalvando(true);
      if (editingId) {
        await editarCompartimento(editingId, {
          nome,
          posicao,
          descricao,
          ordem: Number(ordem) || 0,
        });
        toast.success('Compartimento atualizado!');
        resetForm();
      } else {
        await criarCompartimento({
          viatura_id: viatura.id,
          nome,
          posicao,
          descricao,
          ordem: Number(ordem) || 0,
        });
        toast.success('Compartimento criado! Você pode adicionar mais compartimentos.');
        // Mantém formulário aberto para adição ilimitada contínua:
        setNome('');
        setPosicao('');
        setDescricao('');
        setOrdem(prev => Number(prev) + 1);
        setEditingId(null);
        setExibirForm(true);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error('Erro ao salvar compartimento:', err);
      if (err?.message?.includes('schema cache') || err?.code === 'PGRST204' || err?.code === '42P01') {
        toast.error('Tabela "compartimentos_viatura" ainda não existe no Supabase. Por favor, execute a migração SQL no Supabase.');
      } else {
        toast.error(`Erro ao salvar compartimento: ${err.message || 'Falha de conexão'}`);
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente remover este compartimento?')) return;
    try {
      await removerCompartimento(id);
      toast.success('Compartimento removido com sucesso!');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover compartimento');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-rustic-border shadow-lg p-6 max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-rustic-brown flex items-center gap-2">
            <span>🚒</span> {viatura.name} {viatura.plate ? `— ${viatura.plate}` : ''}
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Compartimentos cadastrados: <strong className="text-primary">{compartimentos.length}</strong>
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {/* Lista de Compartimentos */}
      {loading ? (
        <div className="text-center py-6 text-stone-400 text-sm">Carregando compartimentos...</div>
      ) : compartimentos.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-800 text-sm">
          Nenhum compartimento cadastrado para esta viatura.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {compartimentos.map((comp, index) => (
            <div
              key={comp.id}
              className="flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold bg-stone-200 text-stone-700 px-2 py-1 rounded-md">
                  Nº {comp.ordem || index + 1}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-stone-800">{comp.nome}</h4>
                  {comp.posicao && (
                    <span className="text-[11px] font-semibold text-stone-500 block">
                      Posição: {comp.posicao}
                    </span>
                  )}
                  {comp.descricao && (
                    <p className="text-xs text-stone-400 mt-0.5 italic">{comp.descricao}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => abrirEdicao(comp)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar compartimento"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleExcluir(comp.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir compartimento"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão Adicionar ou Formulário */}
      {!exibirForm ? (
        <button
          onClick={() => {
            setEditingId(null);
            setNome('');
            setPosicao('');
            setDescricao('');
            setOrdem(compartimentos.length + 1);
            setExibirForm(true);
          }}
          className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl border border-dashed border-stone-300 flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <span>➕</span> Adicionar Compartimento
        </button>
      ) : (
        <form onSubmit={handleSalvar} className="bg-stone-50 border border-rustic-border p-4 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-stone-700 border-b border-stone-200 pb-2">
            {editingId ? '✏️ Editar Compartimento' : '➕ Novo Compartimento'}
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-600">Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Lateral Esquerdo / Nº 1"
              className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-600">Posição</label>
              <select
                value={posicao}
                onChange={e => setPosicao(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {POSICOES_COMPARTIMENTO.map(pos => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-600">Ordem</label>
              <input
                type="number"
                value={ordem}
                onChange={e => setOrdem(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-600">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Prateleira de mangueiras e esguichos"
              className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-stone-200 text-stone-700 text-xs font-bold rounded-lg hover:bg-stone-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all shadow"
            >
              {salvando ? 'Salvando...' : 'Salvar Compartimento'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default GerenciarCompartimentos;
