import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

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
}

interface DadosConferencia {
  viaturas: Viatura[];
  locais: LocalEquipamento[];
  compartimentos: Compartimento[];
  itens: ItemFleet[];
}

async function buscarConferencia(): Promise<DadosConferencia> {
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

// Nível 1
interface N1Props { id: string; titulo: string; icone: string; totalItens: number; abertos: Record<string,boolean>; toggle: (id: string) => void; children: React.ReactNode; }
function NivelUm({ id, titulo, icone, totalItens, abertos, toggle, children }: N1Props) {
  const aberto = abertos[id];
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
      <button onClick={() => toggle(id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: aberto ? '#f1f5f9' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: '4px solid #1d4ed8' }}>
        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>{icone} {titulo}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 10px', borderRadius: '999px' }}>{totalItens} itens</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{aberto ? '▲' : '▼'}</span>
        </div>
      </button>
      {aberto && <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #e2e8f0' }}>{children}</div>}
    </div>
  );
}

// Nível 2
interface N2Props { id: string; titulo: string; posicao?: string; totalItens: number; abertos: Record<string,boolean>; toggle: (id: string) => void; children: React.ReactNode; }
function NivelDois({ id, titulo, posicao, totalItens, abertos, toggle, children }: N2Props) {
  const key = `comp-${id}`;
  const aberto = abertos[key];
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '6px', marginLeft: '8px' }}>
      <button onClick={() => toggle(key)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: aberto ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: '3px solid #0ea5e9', borderRadius: '7px' }}>
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

// Nível 3
interface N3Props { item: ItemFleet; }
function NivelTres({ item }: N3Props) {
  const ok = item.status === 'active' || item.status === 'ok';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', marginBottom: '4px', background: 'white', borderRadius: '6px', border: '1px solid #f1f5f9', marginLeft: '12px' }}>
      <div>
        <span style={{ fontSize: '13px', color: '#334155' }}>🔧 {item.name}</span>
        {item.type && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>{item.type}</span>}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>
        {ok ? '✅ Ok' : '⚠️ Manutenção'}
      </span>
    </div>
  );
}

// Componente principal
const ConferenciaDiaria: React.FC = () => {
  const [dados, setDados] = useState<DadosConferencia>({ viaturas: [], locais: [], compartimentos: [], itens: [] });
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

  useEffect(() => {
    buscarConferencia()
      .then(d => { setDados(d); setLoading(false); })
      .catch(e => { setErro(e.message || 'Erro ao carregar.'); setLoading(false); });
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
          <NivelUm key={v.id} id={v.id} titulo={`${v.name}${v.plate ? ` — ${v.plate}` : ''}`} icone="🚒" totalItens={totalVtr} abertos={abertos} toggle={toggle}>
            {comps.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 12px' }}>Nenhum compartimento cadastrado.</p>
            )}
            {comps.map(comp => {
              const itensComp = dados.itens.filter(i => i.compartimento_id === comp.id);
              return (
                <NivelDois key={comp.id} id={comp.id} titulo={comp.nome} posicao={comp.posicao} totalItens={itensComp.length} abertos={abertos} toggle={toggle}>
                  {itensComp.length === 0
                    ? <p style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '12px' }}>Sem itens.</p>
                    : itensComp.map(item => <NivelTres key={item.id} item={item} />)
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
          <NivelUm key={local.id} id={`local-${local.id}`} titulo={local.nome} icone="🏠" totalItens={itensLocal.length} abertos={abertos} toggle={toggle}>
            <NivelDois id={`local-itens-${local.id}`} titulo="Itens do local" posicao="" totalItens={itensLocal.length} abertos={abertos} toggle={toggle}>
              {itensLocal.map(item => <NivelTres key={item.id} item={item} />)}
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
