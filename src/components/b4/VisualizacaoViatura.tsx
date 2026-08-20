import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Vehicle, CompartimentoViatura } from '../../services/types';
import { toast } from 'sonner';

interface VisualizacaoViaturaProps {
  viatura: Vehicle;
  onBack?: () => void;
  onAddItem?: (viaturaId: string, compartimentoId?: string) => void;
}

interface EquipamentoItem {
  id: string;
  nome: string;
  tipo?: string;
  numero_serie?: string;
  quantidade?: number;
  status?: string;
  compartimento_id?: string;
}

export const VisualizacaoViatura: React.FC<VisualizacaoViaturaProps> = ({
  viatura,
  onBack,
  onAddItem,
}) => {
  const [compartimentos, setCompartimentos] = useState<CompartimentoViatura[]>([]);
  const [itens, setItens] = useState<EquipamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModalComp, setQrModalComp] = useState<CompartimentoViatura | null>(null);
  const [itemParaEditar, setItemParaEditar] = useState<Vehicle | null>(null);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // 1. Buscar compartimentos desta viatura
      const { data: dataComp, error: errComp } = await supabase
        .from('compartimentos_viatura')
        .select('*')
        .eq('viatura_id', viatura.id)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (errComp) throw errComp;
      const compsCarregados = dataComp || [];
      setCompartimentos(compsCarregados);

      // 2. Buscar itens da tabela fleet desta viatura (ou de seus compartimentos)
      const { data: dataFleet } = await supabase
        .from('fleet')
        .select('*')
        .neq('type', 'Viatura');

      const compIds = new Set(compsCarregados.map(c => c.id));
      const fleetFormatado: EquipamentoItem[] = (dataFleet || [])
        .filter(f => f.compartimento_id && compIds.has(f.compartimento_id))
        .map(f => ({
          id: f.id,
          nome: f.name,
          tipo: `🔧 ${f.type}`,
          status: f.status === 'active' || !f.status ? 'Ok' : f.status,
          quantidade: f.quantidade || 1,
          compartimento_id: f.compartimento_id,
          rawItem: f,
        }));

      // 3. Buscar na tabela equipamentos
      const { data: dataEq } = await supabase
        .from('equipamentos')
        .select('id, nome, tipo, numero_serie, quantidade, status, compartimento_id')
        .eq('viatura_id', viatura.id);

      const equipFormatado: EquipamentoItem[] = (dataEq || []).map(e => ({
        id: e.id,
        nome: e.nome,
        tipo: `🔧 ${e.tipo || 'Equipamento'}`,
        numero_serie: e.numero_serie,
        quantidade: e.quantidade || 1,
        status: e.status || 'Ok',
        compartimento_id: e.compartimento_id,
        rawItem: {
          id: e.id,
          name: e.nome,
          type: (e.tipo as any) || 'Equipamento',
          status: e.status === 'Ok' ? 'active' : 'maintenance',
          details: e.numero_serie ? `Série: ${e.numero_serie}` : '',
          quantidade: e.quantidade || 1,
          compartimento_id: e.compartimento_id,
        },
      }));

      // Combinar sem duplicatas
      const fleetIds = new Set(fleetFormatado.map(f => f.id));
      const equipNovos = equipFormatado.filter(e => !fleetIds.has(e.id));

      setItens([...fleetFormatado, ...equipNovos]);
    } catch (err: any) {
      console.error('Erro ao carregar visualização da viatura:', err);
      toast.error('Erro ao carregar itens da viatura');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viatura?.id) {
      carregarDados();
    }
  }, [viatura?.id]);

  // Itens não associados a nenhum compartimento específico
  const itensSemCompartimento = itens.filter(item => !item.compartimento_id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Botão voltar se fornecido */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Voltar
        </button>
      )}

      {/* CABEÇALHO DA VIATURA */}
      <div className="bg-white border border-rustic-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚒</span>
            <div>
              <h1 className="text-2xl font-black text-rustic-brown">{viatura.name}</h1>
              {viatura.plate && (
                <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Placa: {viatura.plate}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-stone-600">
          <div className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Tipo</span>
            <span className="font-bold text-stone-800">{viatura.type || 'ABS'}</span>
          </div>
          <div className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Status</span>
            <span className="font-bold text-green-700 flex items-center gap-1">
              ✅ {viatura.status === 'active' || !viatura.status ? 'Ativa' : viatura.status}
            </span>
          </div>
          <div className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Total de itens</span>
            <span className="font-bold text-primary">{itens.length}</span>
          </div>
        </div>
      </div>

      {/* COMPARTIMENTOS */}
      {loading ? (
        <div className="text-center py-12 text-stone-500">Carregando compartimentos e materiais...</div>
      ) : compartimentos.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-2xl text-center">
          <p className="font-bold">Nenhum compartimento cadastrado nesta viatura.</p>
          <p className="text-xs mt-1">Cadastre os compartimentos no Painel do Gestor para organizar os materiais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {compartimentos.map(comp => {
            const itensComp = itens.filter(i => i.compartimento_id === comp.id);

            return (
              <div
                key={comp.id}
                className="bg-white border border-rustic-border rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden"
              >
                {/* Header do Card */}
                <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <div>
                      <h3 className="font-bold text-stone-800">{comp.nome}</h3>
                      {comp.posicao && (
                        <span className="text-[10px] text-stone-500 font-semibold">
                          {comp.posicao}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {itensComp.length} {itensComp.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* Lista de itens do compartimento */}
                <div className="p-4 space-y-2 min-h-[120px]">
                  {itensComp.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-4 text-center">
                      Nenhum equipamento neste compartimento.
                    </p>
                  ) : (
                    itensComp.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0 hover:bg-stone-50 px-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-800">
                            • {item.nome}
                          </span>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            (x{item.quantidade || 1})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            ✅ {item.status || 'Ok'}
                          </span>
                          <button
                            onClick={() => setItemParaEditar((item as any).rawItem || { id: item.id, name: item.nome, details: '', status: 'active', type: 'Equipamento', quantidade: item.quantidade || 1, compartimento_id: item.compartimento_id })}
                            className="p-1 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Editar item e quantidade/compartimento"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rodapé do Card */}
                <div className="bg-stone-50 p-3 border-t border-stone-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onAddItem && onAddItem(viatura.id, comp.id)}
                    className="text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span>➕</span> Adicionar item aqui
                  </button>
                  <button
                    onClick={() => setQrModalComp(comp)}
                    className="text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span>🖨️</span> QR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Itens Sem Compartimento Definido */}
      {itensSemCompartimento.length > 0 && (
        <div className="bg-stone-50 border border-rustic-border rounded-2xl p-6 space-y-3">
          <h3 className="font-bold text-stone-700 flex items-center gap-2">
            <span>⚠️</span> Equipamentos sem compartimento atribuído ({itensSemCompartimento.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {itensSemCompartimento.map(item => (
              <div key={item.id} className="bg-white p-2.5 rounded-xl border border-stone-200 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-stone-800">{item.nome}</span>
                  <span className="text-amber-700 font-bold ml-1"> (x{item.quantidade || 1})</span>
                </div>
                <button
                  onClick={() => setItemParaEditar((item as any).rawItem || { id: item.id, name: item.nome, details: '', status: 'active', type: 'Equipamento', quantidade: item.quantidade || 1, compartimento_id: item.compartimento_id })}
                  className="p-1 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                  title="Editar item"
                >
                  ✏️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL EDITAR ITEM */}
      <ModalEditarItemB4
        item={itemParaEditar}
        isOpen={!!itemParaEditar}
        onClose={() => setItemParaEditar(null)}
        onSaved={carregarDados}
      />

      {/* MODAL QR CODE DO COMPARTIMENTO */}
      {qrModalComp && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-center border border-rustic-border shadow-2xl">
            <h3 className="text-lg font-bold text-rustic-brown">
              QR Code do Compartimento
            </h3>
            <p className="text-xs text-stone-600 font-semibold">
              {qrModalComp.nome} — {viatura.name}
            </p>

            <div className="flex justify-center py-4 bg-stone-50 rounded-xl border border-stone-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `${window.location.origin}/extrato/compartimento/${qrModalComp.id}`
                )}`}
                alt="QR Code"
                className="w-44 h-44 rounded-lg shadow-sm"
              />
            </div>

            <p className="text-[11px] font-mono text-stone-400 break-all bg-stone-100 p-2 rounded">
              {`${window.location.origin}/extrato/compartimento/${qrModalComp.id}`}
            </p>

            <div className="flex gap-2">
              <a
                href={`/extrato/compartimento/${qrModalComp.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl text-center"
              >
                Abrir Extrato
              </a>
              <button
                onClick={() => setQrModalComp(null)}
                className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-xl"
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

export default VisualizacaoViatura;
