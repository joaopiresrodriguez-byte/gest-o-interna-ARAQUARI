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

async function buscarHistorico(filtros: {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
} = {}): Promise<RegistroHistorico[]> {
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
    label: '❌ NÃO ENCONTRADO',
    cor: '#991b1b',
    fundo: '#fee2e2',
    borda: '#dc2626',
  },
};

export const HistoricoConferencias: React.FC = () => {
  const [registros, setRegistros] = useState<RegistroHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const hoje = new Date().toISOString().slice(0, 10);
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [filtros, setFiltros] = useState({
    dataInicio: trintaDiasAtras,
    dataFim: hoje,
    status: '',
  });

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      const dados = await buscarHistorico(filtros);
      setRegistros(dados);
    } catch (e: any) {
      console.error('Erro ao buscar histórico:', e);
      setErro(e.message || 'Não foi possível carregar o histórico de conferências.');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resolverPendencia = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let nomeUsuario = user?.email || 'Usuário';

      if (user?.id) {
        const { data: perfil } = await supabase
          .from('militares')
          .select('nome_guerra')
          .eq('user_id', user.id)
          .maybeSingle();

        if (perfil?.nome_guerra) {
          nomeUsuario = perfil.nome_guerra;
        }
      }

      const { error } = await supabase
        .from('historico_conferencias_b4')
        .update({
          resolvido: true,
          resolvido_em: new Date().toISOString(),
          resolvido_por: nomeUsuario,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Pendência marcada como resolvida!');
      carregar();
    } catch (err: any) {
      console.error('Erro ao resolver pendência:', err);
      toast.error('Erro ao marcar pendência como resolvida');
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
    <div style={{ fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            📋 Histórico de Pendências (B4)
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
            Itens avariados ou não encontrados registrados durante as conferências diárias
          </p>
        </div>
        <button onClick={carregar} style={btnStyle}>🔄 Atualizar</button>
      </div>

      {/* Filtros */}
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
            <option value="nao_encontrado">❌ Não encontrado</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-end' }}>
          <label style={{ fontSize: '11px', color: 'transparent' }}>-</label>
          <button onClick={carregar} style={btnStyle}>🔍 Filtrar</button>
        </div>
      </div>

      {/* Estado de carregamento / erro */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '14px' }}>
          ⏳ Carregando...
        </div>
      )}
      {erro && (
        <div style={{ padding: '14px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '12px', borderLeft: '4px solid #dc2626' }}>
          ❌ <strong>Atenção:</strong> {erro}
        </div>
      )}

      {/* Contador */}
      {!loading && !erro && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
          {registros.length === 0
            ? 'Nenhum registro encontrado para o período.'
            : `${registros.length} registro${registros.length !== 1 ? 's' : ''} encontrado${registros.length !== 1 ? 's' : ''}.`
          }
        </div>
      )}

      {/* Listagem */}
      {!loading && registros.map(reg => {
        const cfg = STATUS_CFG[reg.status_conferencia] || STATUS_CFG.avariado;
        const localInfo = reg.viatura_nome
          ? `${reg.viatura_nome}${reg.compartimento_nome ? ` › ${reg.compartimento_nome}` : ''}`
          : reg.local_nome || '—';

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
            {/* Linha 1: data + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                📅 {formataData(reg.data_conferencia)}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: reg.resolvido ? '#166534' : cfg.cor }}>
                {reg.resolvido ? '✅ RESOLVIDO' : cfg.label}
              </span>
            </div>

            {/* Nome do item */}
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
              {reg.tipo_item === 'viatura' ? '🚒' : reg.tipo_item === 'consumo' ? '📋' : '🔧'}{' '}
              {reg.item_nome || '(sem nome)'}
            </div>

            {/* Localização */}
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
              📍 {localInfo}
            </div>

            {/* Observação */}
            {reg.observacao && (
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontStyle: 'italic' }}>
                💬 {reg.observacao}
              </div>
            )}

            {/* Rodapé: conferido por + botão de resolução */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                🔏 Registrado por <strong>{reg.conferido_por_nome || '—'}</strong> às {formataHora(reg.conferido_em)}
              </span>

              {!reg.resolvido && (
                <button
                  onClick={() => resolverPendencia(reg.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#166534',
                    color: 'white',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  ✅ Marcar como Resolvido
                </button>
              )}

              {reg.resolvido && (
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: '500' }}>
                  ✅ Resolvido por <strong>{reg.resolvido_por || 'Usuário'}</strong> em {new Date(reg.resolvido_em!).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HistoricoConferencias;
