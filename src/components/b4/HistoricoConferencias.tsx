import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { toast } from 'sonner';

interface RegistroHistorico {
  id: string;
  data_conferencia: string;
  tipo_item: string;
  item_id: string;
  item_nome: string;
  viatura_nome: string | null;
  compartimento_nome: string | null;
  local_nome: string | null;
  status_conferencia: 'avariado' | 'nao_encontrado';
  observacao: string | null;
  conferido_por_nome: string | null;
  conferido_em: string;
  notificacao_enviada: boolean;
  notificacao_enviada_em: string | null;
  resolvido?: boolean;
  resolvido_em?: string | null;
  resolvido_por?: string | null;
}

interface FiltrosHistorico {
  dataInicio: string;
  dataFim: string;
  status: string;
}

async function buscarPendenciasAbertas(): Promise<RegistroHistorico[]> {
  const { data, error } = await supabase
    .from('historico_conferencias_b4')
    .select('*')
    .eq('resolvido', false)
    .order('conferido_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function buscarHistoricoFiltrado(filtros: FiltrosHistorico): Promise<RegistroHistorico[]> {
  let query = supabase
    .from('historico_conferencias_b4')
    .select('*')
    .order('conferido_em', { ascending: false });

  if (filtros.dataInicio) query = query.gte('data_conferencia', filtros.dataInicio);
  if (filtros.dataFim)    query = query.lte('data_conferencia', filtros.dataFim);
  if (filtros.status)     query = query.eq('status_conferencia', filtros.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function formataData(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formataHora(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CFG = {
  avariado: {
    label: '⚠️ AVARIADO',
    cor: '#92400e',
    fundo: '#fef3c7',
    borda: '#d97706',
  },
  nao_encontrado: {
    label: '❌ NÃO TEM',
    cor: '#991b1b',
    fundo: '#fee2e2',
    borda: '#dc2626',
  },
} as const;

function calcularPermanencia(dataConf: string) {
  if (!dataConf || typeof dataConf !== 'string') {
    return { dias: 0, nivel: 'normal', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Recente' };
  }
  const dateStr = dataConf.includes('T') ? dataConf : `${dataConf}T12:00:00`;
  const confDate = new Date(dateStr);
  if (isNaN(confDate.getTime())) {
    return { dias: 0, nivel: 'normal', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Recente' };
  }
  const dias = Math.floor((Date.now() - confDate.getTime()) / (1000 * 60 * 60 * 24));

  if (dias >= 180) {
    return { dias, nivel: 'preto', badgeClass: 'bg-black text-white border-black shadow-md', label: `🚨 ALERTA PRETO (+6 Meses - ${dias} dias)` };
  }
  if (dias >= 90) {
    return { dias, nivel: 'vermelho', badgeClass: 'bg-red-600 text-white border-red-700 shadow-sm', label: `🔴 ALERTA VERMELHO (+3 Meses - ${dias} dias)` };
  }
  if (dias >= 30) {
    return { dias, nivel: 'laranja', badgeClass: 'bg-orange-500 text-white border-orange-600', label: `🟠 ALERTA LARANJA (+1 Mês - ${dias} dias)` };
  }
  return { dias, nivel: 'normal', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', label: `${dias} dia(s)` };
}

export const HistoricoConferencias: React.FC = () => {
  // ── Estado das pendências em aberto (carregadas no mount) ──
  const [pendencias, setPendencias] = useState<RegistroHistorico[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState(true);

  // ── Estado do histórico filtrado ──
  const [registros, setRegistros] = useState<RegistroHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [mostrarHistoricoFiltrado, setMostrarHistoricoFiltrado] = useState(false);

  // ── Filtros do histórico ──
  const [filtros, setFiltros] = useState<FiltrosHistorico>({
    dataInicio: '',
    dataFim: '',
    status: '',
  });

  // ── Permissões e resolução ──
  const [isGestor, setIsGestor] = useState<boolean>(false);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);

  // ── Checar permissões do usuário logado ──
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
      } catch {
        setIsGestor(true);
      }
    }
    checarPermissao();
  }, []);

  // ── Carregar pendências em aberto (ao montar o componente) ──
  const carregarPendencias = useCallback(async () => {
    try {
      setLoadingPendencias(true);
      const dados = await buscarPendenciasAbertas();
      setPendencias(dados);
    } catch (e: any) {
      console.error('Erro ao buscar pendências:', e);
    } finally {
      setLoadingPendencias(false);
    }
  }, []);

  useEffect(() => {
    carregarPendencias();
  }, [carregarPendencias]);

  // ── Carregar histórico filtrado (somente ao clicar no botão) ──
  const aplicarFiltroHistorico = async () => {
    try {
      setLoadingHistorico(true);
      setErroHistorico(null);
      setMostrarHistoricoFiltrado(true);
      const dados = await buscarHistoricoFiltrado(filtros);
      setRegistros(dados);
    } catch (e: any) {
      console.error('Erro ao buscar histórico filtrado:', e);
      setErroHistorico(e.message || 'Não foi possível carregar o histórico de conferências.');
    } finally {
      setLoadingHistorico(false);
    }
  };

  // ── Resolver pendência ──
  const resolverPendencia = async (reg: RegistroHistorico) => {
    if (!isGestor) {
      toast.error('Apenas gestores do B4 têm permissão para resolver pendências.');
      return;
    }

    try {
      setResolvendoId(reg.id);
      const { data: { user } } = await supabase.auth.getUser();
      let nomeUsuario = user?.email?.split('@')[0] || 'Gestor';

      if (user?.id) {
        const { data: perfil } = await supabase
          .from('militares')
          .select('nome_guerra')
          .eq('user_id', user.id)
          .maybeSingle();
        if (perfil?.nome_guerra) nomeUsuario = perfil.nome_guerra;
      }

      const { error } = await supabase
        .from('historico_conferencias_b4')
        .update({
          resolvido: true,
          resolvido_em: new Date().toISOString(),
          resolvido_por: nomeUsuario,
        })
        .eq('id', reg.id);

      if (error) throw error;

      // Cancela baixa pendente associada ao item, se existir
      if (reg.item_id) {
        try {
          await supabase
            .from('baixa_patrimonio')
            .update({
              status: 'rejeitado',
              processado_em: new Date().toISOString(),
              processado_por_nome: nomeUsuario,
              observacao_gestor: `Solicitação cancelada automaticamente: Item regularizado na conferência B4 por ${nomeUsuario}.`,
            })
            .eq('item_id', reg.item_id)
            .eq('status', 'pendente_baixa');
        } catch (errBaixa) {
          console.warn('Erro ao cancelar baixa_patrimonio:', errBaixa);
        }
      }

      toast.success(`Pendência de "${reg.item_nome}" resolvida! Item regularizado.`);
      // Recarrega pendências em aberto para remover o item da lista
      carregarPendencias();
      // Se o histórico filtrado estiver visível, atualiza também
      if (mostrarHistoricoFiltrado) {
        const dados = await buscarHistoricoFiltrado(filtros);
        setRegistros(dados);
      }
    } catch (err: any) {
      console.error('Erro ao resolver pendência:', err);
      toast.error('Erro ao marcar pendência como resolvida');
    } finally {
      setResolvendoId(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: '#1e293b',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '950px', margin: '0 auto' }} className="space-y-6">

      {/* ── Pendências em Aberto ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#991b1b', margin: 0 }}>
              Pendências em Aberto ({pendencias.length})
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>
              {isGestor ? '🔑 Acesso Gestor: Você pode regularizar pendências' : '👁️ Visualização de Leitura'}
            </span>
            <button onClick={carregarPendencias} style={btnStyle}>🔄 Atualizar</button>
          </div>
        </div>

        {loadingPendencias ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
            ⏳ Carregando pendências em aberto...
          </div>
        ) : pendencias.length === 0 ? (
          <div style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '13px',
          }}>
            ✅ Nenhuma pendência em aberto no momento. Todos os itens estão regularizados!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendencias.map(item => {
              const cfg = STATUS_CFG[item.status_conferencia] ?? STATUS_CFG.avariado;
              const local = item.viatura_nome
                ? `${item.viatura_nome}${item.compartimento_nome ? ` › ${item.compartimento_nome}` : ''}`
                : item.local_nome || 'Local não informado';
              const perm = calcularPermanencia(item.data_conferencia);

              return (
                <div
                  key={item.id}
                  style={{
                    background: perm.nivel === 'preto' ? '#18181b' : perm.nivel === 'vermelho' ? '#fef2f2' : perm.nivel === 'laranja' ? '#fff7ed' : cfg.fundo,
                    border: perm.nivel === 'preto' ? '2px solid #000' : perm.nivel === 'vermelho' ? '2px solid #dc2626' : perm.nivel === 'laranja' ? '2px solid #ea580c' : `1px solid ${cfg.borda}`,
                    borderLeft: perm.nivel === 'preto' ? '8px solid #000' : perm.nivel === 'vermelho' ? '8px solid #dc2626' : perm.nivel === 'laranja' ? '8px solid #ea580c' : `5px solid ${cfg.borda}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    color: perm.nivel === 'preto' ? '#fff' : '#1e293b',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: cfg.cor, background: '#fff', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${cfg.borda}` }}>
                        {cfg.label}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${perm.badgeClass}`}>
                        {perm.label}
                      </span>
                      <span style={{ fontSize: '12px', color: perm.nivel === 'preto' ? '#a1a1aa' : '#64748b', fontWeight: '600' }}>
                        📅 Abertura: {formataData(item.data_conferencia)}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: perm.nivel === 'preto' ? '#fff' : '#1e293b', margin: '4px 0' }}>
                      {item.item_nome}
                    </h4>

                    <div style={{ fontSize: '12px', color: perm.nivel === 'preto' ? '#e4e4e7' : '#475569' }}>
                      📍 <strong>Local:</strong> {local}
                    </div>

                    {item.observacao && (
                      <div style={{ fontSize: '12px', color: perm.nivel === 'preto' ? '#d4d4d8' : '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                        💬 {item.observacao}
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: perm.nivel === 'preto' ? '#a1a1aa' : '#64748b', marginTop: '4px' }}>
                      👤 Registrado por <strong>{item.conferido_por_nome || 'Militar'}</strong> às {formataHora(item.conferido_em)}
                    </div>
                  </div>

                  <div>
                    {isGestor ? (
                      <button
                        onClick={() => resolverPendencia(item)}
                        disabled={resolvendoId === item.id}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: perm.nivel === 'preto' ? '#22c55e' : '#166534',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: resolvendoId === item.id ? 0.6 : 1,
                        }}
                      >
                        {resolvendoId === item.id ? '⏳ Resolvendo...' : '✅ Marcar como Regularizado'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#991b1b', fontStyle: 'italic', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                        Aguardando Gestor
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Histórico Filtrado ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px' }}>
            📋 Histórico Geral de Pendências (Filtro B4)
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            Utilize o filtro abaixo para visualizar o histórico completo de pendências anteriores e resolvidas.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#f8fafc',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>De</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Até</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Status</label>
            <select
              value={filtros.status}
              onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Todos</option>
              <option value="avariado">⚠️ Avariado</option>
              <option value="nao_encontrado">❌ Não tem</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-end' }}>
            <label style={{ fontSize: '11px', color: 'transparent' }}>-</label>
            <button onClick={aplicarFiltroHistorico} style={btnStyle}>🔍 Aplicar Filtro de Histórico</button>
          </div>
        </div>

        {erroHistorico && (
          <div style={{ padding: '14px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '12px', borderLeft: '4px solid #dc2626' }}>
            ❌ <strong>Atenção:</strong> {erroHistorico}
          </div>
        )}

        {!mostrarHistoricoFiltrado ? (
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            🔍 Defina os filtros acima e clique em <strong>"Aplicar Filtro de Histórico"</strong> para carregar o histórico completo de pendências anteriores e regularizadas.
          </div>
        ) : (
          <>
            {loadingHistorico && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                ⏳ Carregando histórico...
              </div>
            )}

            {!loadingHistorico && !erroHistorico && (
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                {registros.length === 0
                  ? 'Nenhum registro encontrado para o período.'
                  : `${registros.length} registro${registros.length !== 1 ? 's' : ''} encontrado${registros.length !== 1 ? 's' : ''}.`
                }
              </div>
            )}

            {!loadingHistorico && registros.map(reg => {
              const cfg = STATUS_CFG[reg.status_conferencia] ?? STATUS_CFG.avariado;
              const localInfo = reg.viatura_nome
                ? `${reg.viatura_nome}${reg.compartimento_nome ? ` › ${reg.compartimento_nome}` : ''}`
                : reg.local_nome || '—';
              const perm = calcularPermanencia(reg.data_conferencia);

              return (
                <div
                  key={reg.id}
                  style={{
                    border: `1px solid ${reg.resolvido ? '#cbd5e1' : cfg.borda}`,
                    borderLeft: `4px solid ${reg.resolvido ? '#166534' : cfg.borda}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                    marginBottom: '10px',
                    background: reg.resolvido ? '#f8fafc' : cfg.fundo,
                    opacity: reg.resolvido ? 0.85 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                        📅 {formataData(reg.data_conferencia)}
                      </span>
                      {!reg.resolvido && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${perm.badgeClass}`}>
                          {perm.label}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: reg.resolvido ? '#166534' : cfg.cor }}>
                      {reg.resolvido ? '✅ REGULARIZADO / EM USO' : cfg.label}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
                    {reg.tipo_item === 'viatura' ? '🚒' : reg.tipo_item === 'consumo' ? '📋' : '🔧'}{' '}
                    {reg.item_nome || '(sem nome)'}
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    📍 {localInfo}
                  </div>

                  {reg.observacao && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontStyle: 'italic' }}>
                      💬 {reg.observacao}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      🔏 Registrado por <strong>{reg.conferido_por_nome || '—'}</strong> às {formataHora(reg.conferido_em)}
                    </span>

                    {!reg.resolvido && isGestor && (
                      <button
                        onClick={() => resolverPendencia(reg)}
                        disabled={resolvendoId === reg.id}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#166534',
                          color: 'white',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          opacity: resolvendoId === reg.id ? 0.6 : 1,
                        }}
                      >
                        ✅ Marcar como Regularizado
                      </button>
                    )}

                    {reg.resolvido && (
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>
                        ✅ Regularizado por <strong>{reg.resolvido_por || 'Gestor'}</strong> em {reg.resolvido_em ? new Date(reg.resolvido_em).toLocaleString('pt-BR') : '—'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default HistoricoConferencias;
