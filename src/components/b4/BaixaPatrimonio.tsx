import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { toast } from 'sonner';

export interface ItemBaixaPatrimonio {
  id: string;
  item_id: string;
  item_nome: string;
  tipo_item?: string;
  viatura_nome?: string | null;
  compartimento_nome?: string | null;
  local_nome?: string | null;
  motivo_baixa: string;
  status: 'pendente_baixa' | 'concluido_baixado' | 'rejeitado';
  cadastrado_por_nome?: string;
  cadastrado_em: string;
  processado_por_nome?: string | null;
  processado_em?: string | null;
  observacao_gestor?: string | null;
}

export const BaixaPatrimonio: React.FC = () => {
  const [itens, setItens] = useState<ItemBaixaPatrimonio[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGestor, setIsGestor] = useState<boolean>(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [observacaoModal, setObservacaoModal] = useState<string>('');
  const [itemSelecionado, setItemSelecionado] = useState<ItemBaixaPatrimonio | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente_baixa');

  // Checar permissões do usuário logado
  useEffect(() => {
    async function checarPermissao() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_manager, p_logistica')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setIsGestor(Boolean(profile.is_manager || profile.p_logistica === 'editor'));
        } else {
          setIsGestor(true);
        }
      } catch (e) {
        setIsGestor(true);
      }
    }
    checarPermissao();
  }, []);

  const carregarItensBaixa = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('baixa_patrimonio')
        .select('*')
        .order('cadastrado_em', { ascending: false });

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      let listaItens = data || [];

      // Filtro de consistência: Se o item já foi reativado (status = 'active' no fleet) ou a pendência foi regularizada no histórico, não exibir como 'pendente_baixa'
      if (filtroStatus === 'pendente_baixa' && listaItens.length > 0) {
        const itemIds = listaItens.map(i => i.item_id).filter(Boolean);
        if (itemIds.length > 0) {
          const [fleetRes, histRes] = await Promise.all([
            supabase.from('fleet').select('id, status').in('id', itemIds),
            supabase.from('historico_conferencias_b4').select('item_id, resolvido').in('item_id', itemIds).eq('resolvido', true),
          ]);

          const fleetAtivos = new Set((fleetRes.data || []).filter(f => f.status === 'active').map(f => f.id));
          const histResolvidos = new Set((histRes.data || []).map(h => h.item_id));

          listaItens = listaItens.filter(item => {
            if (fleetAtivos.has(item.item_id) || histResolvidos.has(item.item_id)) {
              return false; // Item já foi ativado/regularizado, não mostrar em pendente_baixa
            }
            return true;
          });
        }
      }

      setItens(listaItens);
    } catch (err: any) {
      console.error('Erro ao carregar itens para Baixa Patrimônio:', err);
      toast.error('Erro ao carregar lista de baixas patrimoniais.');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    carregarItensBaixa();
  }, [carregarItensBaixa]);

  // Função para dar baixa definitiva no item
  const processarBaixaDefinitiva = async (item: ItemBaixaPatrimonio) => {
    if (!isGestor) {
      toast.error('Apenas gestores do B4 têm permissão para processar baixa patrimonial.');
      return;
    }

    try {
      setProcessandoId(item.id);
      const { data: { user } } = await supabase.auth.getUser();
      let nomeUsuario = user?.email?.split('@')[0] || 'Gestor B4';

      if (user?.id) {
        const { data: perfil } = await supabase
          .from('militares')
          .select('nome_guerra')
          .eq('user_id', user.id)
          .maybeSingle();
        if (perfil?.nome_guerra) nomeUsuario = perfil.nome_guerra;
      }

      const agora = new Date().toISOString();

      // 1. Atualizar registro em baixa_patrimonio
      const { error: errBaixa } = await supabase
        .from('baixa_patrimonio')
        .update({
          status: 'concluido_baixado',
          processado_em: agora,
          processado_por_nome: nomeUsuario,
          observacao_gestor: observacaoModal || 'Baixa definitiva confirmada pelo gestor B4.',
        })
        .eq('id', item.id);

      if (errBaixa) throw errBaixa;

      // 2. Desativar item automaticamente na tabela fleet (status = 'inactive' / 'down')
      if (item.item_id) {
        try {
          await supabase
            .from('fleet')
            .update({ status: 'inactive' })
            .eq('id', item.item_id);

          // Também atualiza na tabela equipamentos se existir
          await supabase
            .from('equipamentos')
            .update({ status: 'Baixado / Inativo' })
            .eq('id', item.item_id);
        } catch (errFleet) {
          console.warn('Atualização de status na fleet/equipamentos:', errFleet);
        }
      }

      // 3. Resolver pendência correspondente no historico_conferencias_b4
      try {
        await supabase
          .from('historico_conferencias_b4')
          .update({
            resolvido: true,
            resolvido_em: agora,
            resolvido_por: `${nomeUsuario} (Baixa Patrimonial)`,
          })
          .eq('item_id', item.item_id)
          .eq('resolvido', false);
      } catch (errHist) {
        console.warn('Resolução no histórico B4:', errHist);
      }

      toast.success(`Baixa patrimonial do item "${item.item_nome}" concluída! Item desativado.`);
      setItemSelecionado(null);
      setObservacaoModal('');
      carregarItensBaixa();
    } catch (err: any) {
      console.error('Erro ao processar baixa:', err);
      toast.error(`Erro ao processar baixa: ${err.message || 'Falha na operação'}`);
    } finally {
      setProcessandoId(null);
    }
  };

  const rejeitarBaixa = async (item: ItemBaixaPatrimonio) => {
    if (!isGestor) return toast.error('Permissão negada.');

    try {
      setProcessandoId(item.id);
      const { data: { user } } = await supabase.auth.getUser();
      const nomeUsuario = user?.email?.split('@')[0] || 'Gestor B4';

      await supabase
        .from('baixa_patrimonio')
        .update({
          status: 'rejeitado',
          processado_em: new Date().toISOString(),
          processado_por_nome: nomeUsuario,
          observacao_gestor: observacaoModal || 'Solicitação de baixa rejeitada/cancelada pelo gestor B4.',
        })
        .eq('id', item.id);

      toast.info(`Solicitação de baixa para "${item.item_nome}" foi rejeitada.`);
      setItemSelecionado(null);
      setObservacaoModal('');
      carregarItensBaixa();
    } catch (err: any) {
      toast.error('Erro ao rejeitar solicitação de baixa.');
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto font-sans">
      {/* Header do Submódulo */}
      <div className="bg-white border border-rustic-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-700 text-2xl">delete_forever</span>
            <h2 className="text-xl font-bold text-rustic-brown">Baixa de Patrimônio</h2>
          </div>
          <p className="text-xs text-rustic-brown/70 mt-1">
            Gestão de descarte, alienação e baixa definitiva de itens avariados sem conserto provenientes das conferências diárias.
          </p>
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-2">
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-xs font-bold text-rustic-brown"
          >
            <option value="pendente_baixa">⏳ Pendentes de Baixa</option>
            <option value="concluido_baixado">✅ Baixas Concluídas</option>
            <option value="rejeitado">❌ Rejeitadas</option>
            <option value="todos">📋 Todos os Registros</option>
          </select>
          <button
            onClick={carregarItensBaixa}
            className="h-10 px-4 bg-stone-100 hover:bg-stone-200 text-rustic-brown text-xs font-bold rounded-lg transition-all border border-rustic-border flex items-center gap-1"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Atualizar
          </button>
        </div>
      </div>

      {/* Lista de Registros para Baixa */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm font-bold">
          ⏳ Carregando registros de baixa patrimonial...
        </div>
      ) : itens.length === 0 ? (
        <div className="bg-stone-50 border border-dashed border-rustic-border/60 rounded-xl p-12 text-center text-rustic-brown/60">
          <span className="material-symbols-outlined text-4xl mb-2 text-stone-400">check_circle</span>
          <p className="text-sm font-bold">Nenhum item pendente no submódulo Baixa Patrimônio.</p>
          <p className="text-xs mt-1">Quando um item for marcado como "Sem Conserto / Deverá Baixar" no operacional, ele aparecerá aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {itens.map(item => {
            const isPendente = item.status === 'pendente_baixa';
            const isBaixado = item.status === 'concluido_baixado';
            const localDesc = item.viatura_nome
              ? `${item.viatura_nome}${item.compartimento_nome ? ` › ${item.compartimento_nome}` : ''}`
              : item.local_nome || 'Local não especificado';

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isPendente
                    ? 'border-red-300 border-l-4 border-l-red-600 bg-red-50/20'
                    : isBaixado
                    ? 'border-stone-200 border-l-4 border-l-stone-400 bg-stone-50/50 opacity-85'
                    : 'border-amber-200 border-l-4 border-l-amber-500'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                        isPendente
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : isBaixado
                          ? 'bg-stone-200 text-stone-800 border border-stone-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isPendente ? '⚠️ PENDENTE DE BAIXA' : isBaixado ? '✅ BAIXADO / INATIVO' : '❌ REJEITADO'}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">
                      📅 Encaminhado em {new Date(item.cadastrado_em).toLocaleDateString('pt-BR')} às {new Date(item.cadastrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-rustic-brown">{item.item_nome}</h3>

                  <div className="text-xs text-rustic-brown/80 font-medium">
                    📍 <strong>Local de Origem:</strong> {localDesc}
                  </div>

                  <div className="text-xs text-red-900 bg-red-100/60 p-2.5 rounded-lg border border-red-200/50">
                    💬 <strong>Motivo da Solicitacão:</strong> {item.motivo_baixa}
                  </div>

                  {item.cadastrado_por_nome && (
                    <p className="text-[11px] text-gray-500">
                      👤 Reportado por: <strong>{item.cadastrado_por_nome}</strong>
                    </p>
                  )}

                  {item.processado_em && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 mt-2">
                      ✅ <strong>Processado por {item.processado_por_nome}</strong> em {new Date(item.processado_em).toLocaleString('pt-BR')}
                      {item.observacao_gestor && <p className="italic mt-0.5">"{item.observacao_gestor}"</p>}
                    </div>
                  )}
                </div>

                {/* Botões de Ação do Gestor */}
                {isPendente && isGestor && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={() => setItemSelecionado(item)}
                      disabled={processandoId === item.id}
                      className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                      Confirmar Baixa Definitiva
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Baixa pelo Gestor */}
      {itemSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(30,15,10,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setItemSelecionado(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-700 pb-2 border-b border-rustic-border">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-lg font-bold">Processar Baixa Patrimonial</h3>
            </div>

            <p className="text-sm text-rustic-brown">
              Você está confirmando a baixa definitiva do item <strong>"{itemSelecionado.item_nome}"</strong>.
            </p>

            <div className="bg-stone-50 p-3 rounded-lg border border-rustic-border text-xs space-y-1 text-rustic-brown/80">
              <p>• O status do item no acervo patrimonial será alterado para <strong>Inativo / Baixado</strong>.</p>
              <p>• As pendências relacionadas na conferência diária serão marcadas como regularizadas.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-rustic-brown block mb-1">
                Observações / Despacho do Gestor (Opcional):
              </label>
              <textarea
                value={observacaoModal}
                onChange={e => setObservacaoModal(e.target.value)}
                placeholder="Ex: Laudo técnico nº 12/2026 emitido. Item inservível enviado para descarte."
                className="w-full h-24 p-3 rounded-lg border border-rustic-border text-xs focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rustic-border">
              <button
                onClick={() => rejeitarBaixa(itemSelecionado)}
                disabled={!!processandoId}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all"
              >
                Rejeitar Solicitação
              </button>
              <button
                onClick={() => processarBaixaDefinitiva(itemSelecionado)}
                disabled={!!processandoId}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {processandoId === itemSelecionado.id ? '⏳ Processando...' : '🔥 Confirmar Baixa Definitiva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaixaPatrimonio;
