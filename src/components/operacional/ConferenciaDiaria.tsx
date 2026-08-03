import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { STATUS_CONFERENCIA, buscarConferenciaDia, salvarConferencia, StatusConferencia } from '../../services/conferenciaService';

interface Viatura {
  id: string;
  name: string;
  plate?: string;
  status?: string;
}

interface LocalEquipamento {
  id: string;
  nome: string;
  tipo?: string;
}

interface Compartimento {
  id: string;
  nome: string;
  posicao?: string;
  viatura_id?: string;
}

interface ItemFleet {
  id: string;
  name: string;
  type?: string;
  status?: string;
  details?: string;
  local_id?: string;
  compartimento_id?: string;
  numero_serie?: string;
  quantidade?: number;
  unidade?: string;
}

interface DadosConferencia {
  viaturas: Viatura[];
  locais: LocalEquipamento[];
  compartimentos: Compartimento[];
  itens: ItemFleet[];
}

async function buscarDados(): Promise<DadosConferencia> {
  const [r1, r2, r3, r4] = await Promise.all([
    supabase.from('fleet').select('id, name, plate, status').eq('type', 'Viatura').order('name'),
    supabase.from('locais_equipamento').select('id, nome, tipo').eq('ativo', true).order('nome'),
    supabase.from('compartimentos_viatura').select('id, nome, posicao, viatura_id, ordem').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('fleet').select('id, name, type, status, details, local_id, compartimento_id').neq('type', 'Viatura').order('name'),
  ]);
  return {
    viaturas: r1.data || [],
    locais: r2.data || [],
    compartimentos: r3.data || [],
    itens: r4.data || [],
  };
}

// Nível 1 — Viatura ou Local
interface N1Props {
  id: string;
  titulo: string;
  icone: string;
  totalItens: number;
  abertos: Record<string, boolean>;
  toggle: (id: string) => void;
  conferenciaMap: Record<string, any>;
  onAtualizar: () => void;
  isViatura?: boolean;
  // Contexto para histórico B4:
  viaturaCtx?: { id: string; nome: string; placa?: string };
  children: React.ReactNode;
}

function NivelUm({ id, titulo, icone, totalItens, abertos, toggle, conferenciaMap, onAtualizar, isViatura, viaturaCtx, children }: N1Props) {
  const aberto = abertos[id];
  const confViatura = conferenciaMap[id];

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
      <div
        onClick={() => toggle(id)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          background: aberto ? '#f1f5f9' : 'white',
          cursor: 'pointer',
          borderLeft: '4px solid #1d4ed8',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
          {icone} {titulo}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isViatura && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              {Object.entries(STATUS_CONFERENCIA).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={async e => {
                    e.stopPropagation();
                    await salvarConferencia({
                      viatura_id: id,
                      fleet_item_id: id,
                      status: key as StatusConferencia,
                      // Contexto para histórico B4:
                      item_nome: viaturaCtx ? `${viaturaCtx.nome}${viaturaCtx.placa ? ` — ${viaturaCtx.placa}` : ''}` : titulo,
                      viatura_nome: viaturaCtx?.nome || titulo,
                    });
                    onAtualizar();
                  }}
                  title={cfg.label}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: confViatura?.status === key ? `2px solid ${cfg.cor}` : '2px solid transparent',
                    background: confViatura?.status === key ? cfg.fundo : '#f8fafc',
                    color: confViatura?.status === key ? cfg.cor : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: confViatura?.status === key ? 'bold' : 'normal',
                  }}
                >
                  {cfg.icone}
                </button>
              ))}
            </div>
          )}
          <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 10px', borderRadius: '999px' }}>
            {totalItens} itens
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{aberto ? '▲' : '▼'}</span>
        </div>
      </div>
      {aberto && <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #e2e8f0' }}>{children}</div>}
    </div>
  );
}

// Nível 2 — Compartimento
interface N2Props {
  id: string;
  titulo: string;
  posicao?: string;
  totalItens: number;
  abertos: Record<string, boolean>;
  toggle: (id: string) => void;
  children: React.ReactNode;
}

function NivelDois({ id, titulo, posicao, totalItens, abertos, toggle, children }: N2Props) {
  const key = `comp-${id}`;
  const aberto = abertos[key];
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '6px', marginLeft: '8px' }}>
      <button
        onClick={() => toggle(key)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: aberto ? '#f8fafc' : 'white',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          borderLeft: '3px solid #0ea5e9',
          borderRadius: '7px',
        }}
      >
        <div>
          <span style={{ fontWeight: '600', fontSize: '13px', color: '#334155' }}>📦 {titulo}</span>
          {posicao && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>{posicao}</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{totalItens} itens</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{aberto ? '▲' : '▼'}</span>
        </div>
      </button>
      {aberto && <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>{children}</div>}
    </div>
  );
}

// Nível 3 — Item Individual
interface N3Props {
  item: ItemFleet;
  tipo?: string;
  conferenciaMap: Record<string, any>;
  onAtualizar: () => void;
  // Contexto para histórico B4 e notificação:
  viaturaCtx?: { id: string; nome: string; placa?: string };
  compartimentoCtx?: { id: string; nome: string; posicao?: string };
  localCtx?: { id: string; nome: string };
}

function NivelTres({ item, tipo, conferenciaMap, onAtualizar, viaturaCtx, compartimentoCtx, localCtx }: N3Props) {
  const conf = conferenciaMap[item.id];
  const statusAtual: StatusConferencia | null = conf?.status || null;

  const [mostrarObs, setMostrarObs] = useState(false);
  const [observacao, setObservacao] = useState(conf?.observacao || '');

  async function conferir(novoStatus: string) {
    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: novoStatus as StatusConferencia,
      observacao,
      // Contexto para histórico B4 e notificação:
      item_nome: item.name,
      viatura_nome: viaturaCtx?.nome || undefined,
      compartimento_nome: compartimentoCtx?.nome || undefined,
      local_nome: localCtx?.nome || undefined,
    });
    onAtualizar();
  }

  return (
    <div style={{ padding: '8px 10px', marginBottom: '4px', background: 'white', borderRadius: '8px', border: '1px solid #f1f5f9', marginLeft: '12px' }}>
      {/* LINHA PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {/* NOME E TIPO */}
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
            {tipo === 'consumo' ? '📋' : '🔧'} {item.name}
          </span>
          {item.numero_serie && (
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>Nº {item.numero_serie}</span>
          )}
          {tipo === 'consumo' && item.quantidade && (
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
              {item.quantidade} {item.unidade || 'un'}
            </span>
          )}
        </div>

        {/* BOTÕES DE STATUS */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {Object.entries(STATUS_CONFERENCIA).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => conferir(key)}
              title={cfg.label}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: statusAtual === key ? `2px solid ${cfg.cor}` : '2px solid #e2e8f0',
                background: statusAtual === key ? cfg.fundo : 'white',
                color: statusAtual === key ? cfg.cor : '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: statusAtual === key ? 'bold' : 'normal',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cfg.icone} {cfg.label}
            </button>
          ))}

          {/* BOTÃO OBSERVAÇÃO */}
          <button
            onClick={() => setMostrarObs(!mostrarObs)}
            title="Adicionar observação"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#94a3b8', padding: '4px' }}
          >
            📝
          </button>
        </div>
      </div>

      {/* CAMPO OBSERVAÇÃO */}
      {mostrarObs && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
          <input
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Observação..."
            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
          />
          <button
            onClick={() => statusAtual && conferir(statusAtual)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#1d4ed8', color: 'white', fontSize: '12px', cursor: 'pointer' }}
          >
            Salvar
          </button>
        </div>
      )}

      {/* RODAPÉ DE AUDITORIA */}
      {conf?.conferido_por_nome && (
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
          🔏 Conferido por <strong>{conf.conferido_por_nome}</strong> às{' '}
          {new Date(conf.conferido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

// Componente principal
const ConferenciaDiaria: React.FC = () => {
  const [dados, setDados] = useState<DadosConferencia>({ viaturas: [], locais: [], compartimentos: [], itens: [] });
  const [conferenciaMap, setConferenciaMap] = useState<Record<string, any>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function toggle(id: string) {
    setAbertos(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function expandirTudo() {
    const allIds: Record<string, boolean> = {};
    dados.viaturas.forEach(v => { allIds[v.id] = true; });
    dados.locais.forEach(l => { allIds[`local-${l.id}`] = true; });
    dados.compartimentos.forEach(c => { allIds[`comp-${c.id}`] = true; });
    setAbertos(allIds);
  }

  async function recarregarConferencia() {
    const mapa = await buscarConferenciaDia();
    setConferenciaMap(mapa);
  }

  useEffect(() => {
    Promise.all([buscarDados(), buscarConferenciaDia()])
      .then(([d, mapa]) => {
        setDados(d);
        setConferenciaMap(mapa);
        setLoading(false);
      })
      .catch(e => {
        setErro(e.message || 'Erro ao carregar.');
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
      <p style={{ fontSize: '14px' }}>⏳ Carregando conferência...</p>
    </div>
  );

  if (erro) return (
    <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '10px', color: '#991b1b', fontSize: '14px' }}>
      ❌ {erro}
    </div>
  );

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b', margin: 0 }}>
            🚒 Conferência Diária — Viaturas e Locais
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
            {dados.viaturas.length} viaturas · {dados.locais.length} locais · {dados.itens.length} itens
          </p>
        </div>
        <button
          onClick={expandirTudo}
          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '12px', padding: '6px 14px' }}
        >
          Expandir tudo
        </button>
      </div>

      {/* Viaturas */}
      {dados.viaturas.map(v => {
        const comps = dados.compartimentos.filter(c => c.viatura_id === v.id);
        const itensVtr = dados.itens.filter(i => comps.some(c => c.id === i.compartimento_id));
        const totalVtr = itensVtr.length;

        return (
          <NivelUm
            key={v.id}
            id={v.id}
            titulo={`${v.name}${v.plate ? ` — ${v.plate}` : ''}`}
            icone="🚒"
            totalItens={totalVtr}
            abertos={abertos}
            toggle={toggle}
            conferenciaMap={conferenciaMap}
            onAtualizar={recarregarConferencia}
            isViatura={true}
            viaturaCtx={{ id: v.id, nome: v.name, placa: v.plate }}
          >
            {comps.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 12px' }}>Nenhum compartimento cadastrado.</p>
            )}
            {comps.map(comp => {
              const itensComp = dados.itens.filter(i => i.compartimento_id === comp.id);
              return (
                <NivelDois key={comp.id} id={comp.id} titulo={comp.nome} posicao={comp.posicao} totalItens={itensComp.length} abertos={abertos} toggle={toggle}>
                  {itensComp.length === 0
                    ? <p style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '12px' }}>Sem itens.</p>
                    : itensComp.map(item => (
                        <NivelTres
                          key={item.id}
                          item={item}
                          conferenciaMap={conferenciaMap}
                          onAtualizar={recarregarConferencia}
                          viaturaCtx={{ id: v.id, nome: v.name, placa: v.plate }}
                          compartimentoCtx={{ id: comp.id, nome: comp.nome, posicao: comp.posicao }}
                        />
                      ))
                  }
                </NivelDois>
              );
            })}
          </NivelUm>
        );
      })}

      {/* Locais */}
      {dados.locais.map(local => {
        const itensLocal = dados.itens.filter(i => i.local_id === local.id);
        if (itensLocal.length === 0) return null;
        return (
          <NivelUm
            key={local.id}
            id={`local-${local.id}`}
            titulo={local.nome}
            icone="🏠"
            totalItens={itensLocal.length}
            abertos={abertos}
            toggle={toggle}
            conferenciaMap={conferenciaMap}
            onAtualizar={recarregarConferencia}
            isViatura={false}
          >
            <NivelDois id={`local-itens-${local.id}`} titulo="Itens do local" posicao="" totalItens={itensLocal.length} abertos={abertos} toggle={toggle}>
              {itensLocal.map(item => (
                <NivelTres
                  key={item.id}
                  item={item}
                  conferenciaMap={conferenciaMap}
                  onAtualizar={recarregarConferencia}
                  localCtx={{ id: local.id, nome: local.nome }}
                />
              ))}
            </NivelDois>
          </NivelUm>
        );
      })}

      {dados.viaturas.length === 0 && dados.locais.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
          <p>Nenhuma viatura ou local cadastrado.</p>
        </div>
      )}
    </div>
  );
};

export default ConferenciaDiaria;
