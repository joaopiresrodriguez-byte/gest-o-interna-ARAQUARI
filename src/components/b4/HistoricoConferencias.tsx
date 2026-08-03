import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

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
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formataHora(iso: string) {
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
} as const;

const HistoricoConferencias: React.FC = () => {
  const hoje = new Date().toISOString().split('T')[0];
  const [filtros, setFiltros] = useState({ dataInicio: hoje, dataFim: hoje, status: '' });
  const [registros, setRegistros] = useState<RegistroHistorico[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const dados = await buscarHistorico({
        dataInicio: filtros.dataInicio || undefined,
        dataFim: filtros.dataFim || undefined,
        status: filtros.status || undefined,
      });
      setRegistros(dados);
    } catch (e: any) {
      if (e.code === '42P01' || e.message?.includes('does not exist')) {
        setErro('A tabela "historico_conferencias_b4" ainda não foi criada no banco de dados Supabase. Por favor, execute o SQL do BLOCO A no Editor SQL do Supabase.');
      } else {
        setErro(e.message || 'Erro ao carregar histórico.');
      }
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  // Carrega ao montar
  useEffect(() => { carregar(); }, []);

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#334155',
    background: 'white',
    outline: 'none',
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px' }}>
          📋 Histórico de Conferências B4
        </h3>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
          Registros de itens avariados ou não encontrados nas conferências diárias.
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Data início</label>
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Data fim</label>
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
              border: `1px solid ${cfg.borda}`,
              borderLeft: `4px solid ${cfg.borda}`,
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '10px',
              background: cfg.fundo,
            }}
          >
            {/* Linha 1: data + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                {formataData(reg.data_conferencia)}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: cfg.cor }}>
                {cfg.label}
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

            {/* Rodapé: conferido por + notificação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                🔏 Por <strong>{reg.conferido_por_nome || '—'}</strong> às {formataHora(reg.conferido_em)}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: reg.notificacao_enviada ? '#166534' : '#92400e',
                background: reg.notificacao_enviada ? '#dcfce7' : '#fef9c3',
                padding: '2px 8px',
                borderRadius: '999px',
              }}>
                {reg.notificacao_enviada ? '✅ Notificação enviada' : '⏳ Aguardando notificação'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HistoricoConferencias;
