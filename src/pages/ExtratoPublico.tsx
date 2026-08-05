import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

interface ItemExtrato {
  id: string;
  name: string;
  type: string;
  patrimonio_number?: string;
  status: string;
  brand?: string;
  plate?: string;
  compartimento_id?: string;
  compartimento_nome?: string;
}

interface CompartimentoGroup {
  id: string;
  nome: string;
  posicao?: string;
  itens: ItemExtrato[];
}

// Cores temáticas para os compartimentos (paleta militar/operacional elegante)
const COMPARTIMENTO_CORES = [
  { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', badgeBg: '#fee2e2', icon: '📦' },
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', badgeBg: '#dbeafe', icon: '🚒' },
  { bg: '#f0fdf4', border: '#86efac', text: '#166534', badgeBg: '#dcfce7', icon: '🔧' },
  { bg: '#fffbeb', border: '#fde047', text: '#854d0e', badgeBg: '#fef9c3', icon: '⚡' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8', badgeBg: '#f3e8ff', icon: '🛡️' },
  { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', badgeBg: '#ccfbf1', icon: '🩺' },
];

export function ExtratoPublico() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const [itens, setItens] = useState<ItemExtrato[]>([]);
  const [grupos, setGrupos] = useState<CompartimentoGroup[]>([]);
  const [titulo, setTitulo] = useState('');
  const [localTipo, setLocalTipo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estado dos itens conferidos (riscados) com armazenamento no localStorage
  const storageKey = `extrato_conferido_${tipo}_${id}`;
  const [conferidos, setConferidos] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Salvar no localStorage sempre que conferidos mudar
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(conferidos));
    } catch (e) {
      console.error('Erro ao salvar estado de conferência local:', e);
    }
  }, [conferidos, storageKey]);

  const toggleConferido = (itemId: string) => {
    setConferidos(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const limparConferidos = () => {
    setConferidos({});
  };

  useEffect(() => {
    async function buscar() {
      try {
        if (!id) {
          setErro('Identificador do local não fornecido.');
          setCarregando(false);
          return;
        }

        // ── 1. CASO COMPARTIMENTO INDIVIDUAL ─────────────────────────────────
        if (tipo === 'compartimento') {
          const { data: comp } = await supabase
            .from('compartimentos_viatura')
            .select('id, nome, posicao, viatura_id')
            .eq('id', id)
            .single();

          if (comp) {
            let viaturaNome = '';
            let viaturaPlaca = '';

            if (comp.viatura_id) {
              const { data: viat } = await supabase
                .from('viaturas')
                .select('nome, placa')
                .eq('id', comp.viatura_id)
                .single();

              if (!viat) {
                const { data: fleetViat } = await supabase
                  .from('fleet')
                  .select('name, plate')
                  .eq('id', comp.viatura_id)
                  .single();

                if (fleetViat) {
                  viaturaNome = fleetViat.name;
                  viaturaPlaca = fleetViat.plate || '';
                }
              } else {
                viaturaNome = viat.nome;
                viaturaPlaca = viat.placa || '';
              }
            }

            const headerInfo = viaturaNome ? `${viaturaNome} ${viaturaPlaca ? `(${viaturaPlaca})` : ''}` : '';
            setTitulo(`${comp.nome} ${headerInfo ? `— ${headerInfo}` : ''}`);
            setLocalTipo('Compartimento');
          } else {
            setErro('Compartimento não encontrado.');
            setCarregando(false);
            return;
          }

          // Buscar equipamentos
          const { data: equip } = await supabase
            .from('equipamentos')
            .select('id, nome, tipo, numero_serie, quantidade, status')
            .eq('compartimento_id', id)
            .order('nome')
            .limit(1000);

          const equipItens: ItemExtrato[] = (equip && equip.length > 0)
            ? equip.map(e => ({
                id: e.id,
                name: `${e.nome}${e.quantidade && e.quantidade > 1 ? ` (x${e.quantidade})` : ''}`,
                type: `🔧 ${e.tipo || 'Equipamento'}`,
                patrimonio_number: e.numero_serie,
                status: e.status || 'Ok',
              }))
            : await (async () => {
                const { data: fleetData } = await supabase
                  .from('fleet')
                  .select('id, name, type, patrimonio_number, status, brand, plate')
                  .eq('compartimento_id', id)
                  .order('name')
                  .limit(1000);
                return (fleetData || []).map(f => ({
                  ...f,
                  type: `🔧 ${f.type || 'Equipamento'}`,
                }));
              })();

          // Buscar materiais de consumo
          const { data: consumo } = await supabase
            .from('materiais_consumo')
            .select('id, nome, unidade, quantidade, estoque_minimo, categoria')
            .eq('compartimento_id', id)
            .order('nome')
            .limit(1000);

          const consumoItens: ItemExtrato[] = (consumo || []).map(c => ({
            id: c.id,
            name: c.nome,
            type: `📦 Consumo (${c.categoria || 'Geral'})`,
            patrimonio_number: `${c.quantidade} ${c.unidade || 'un'}`,
            status: c.quantidade > (c.estoque_minimo || 0) ? 'Ok' : 'Baixo Estoque',
          }));

          const todosItens = [...equipItens, ...consumoItens];
          setItens(todosItens);
          setGrupos([{
            id: id,
            nome: 'Itens do Compartimento',
            itens: todosItens,
          }]);
          setCarregando(false);
          return;
        }

        // ── 2. CASO VIATURA COMPLETA ──────────────────────────────────────────
        if (tipo === 'viatura') {
          const { data: vtrFleet, error: vtrErr } = await supabase
            .from('fleet')
            .select('id, name, plate, type, status')
            .eq('id', id)
            .single();

          if (vtrErr || !vtrFleet) {
            setErro('Viatura não encontrada no sistema.');
            setCarregando(false);
            return;
          }

          const nomeTitulo = `${vtrFleet.name}${vtrFleet.plate ? ` (${vtrFleet.plate})` : ''}`;
          setTitulo(nomeTitulo);
          setLocalTipo('Viatura');

          // Buscar compartimentos desta viatura cadastrados no banco
          const { data: comps } = await supabase
            .from('compartimentos_viatura')
            .select('id, nome, posicao, ordem')
            .eq('viatura_id', id)
            .eq('ativo', true)
            .order('ordem', { ascending: true })
            .limit(1000);

          const mapaComps: Record<string, string> = {};
          (comps || []).forEach(c => {
            mapaComps[c.id] = c.nome;
          });

          const compIds = (comps || []).map(c => c.id);

          // Buscar itens em fleet vinculados à viatura (por compartimento_id)
          let itensFleet: ItemExtrato[] = [];
          if (compIds.length > 0) {
            const { data: fleetItems } = await supabase
              .from('fleet')
              .select('id, name, type, patrimonio_number, status, brand, plate, compartimento_id')
              .in('compartimento_id', compIds)
              .neq('type', 'Viatura')
              .order('name')
              .limit(1000);

            itensFleet = (fleetItems || []).map(f => ({
              ...f,
              type: `🔧 ${f.type}`,
              compartimento_id: f.compartimento_id,
              compartimento_nome: f.compartimento_id ? mapaComps[f.compartimento_id] : undefined,
            }));
          }

          // Buscar itens na tabela equipamentos
          const { data: equipItems } = await supabase
            .from('equipamentos')
            .select('id, nome, tipo, numero_serie, quantidade, status, compartimento_id')
            .eq('viatura_id', id)
            .order('nome')
            .limit(1000);

          const itensEquip: ItemExtrato[] = (equipItems || []).map(e => ({
            id: e.id,
            name: `${e.nome}${e.quantidade && e.quantidade > 1 ? ` (x${e.quantidade})` : ''}`,
            type: `🔧 ${e.tipo || 'Equipamento'}`,
            patrimonio_number: e.numero_serie,
            status: e.status || 'Ok',
            compartimento_id: e.compartimento_id,
            compartimento_nome: e.compartimento_id ? mapaComps[e.compartimento_id] : undefined,
          }));

          // Buscar materiais de consumo
          const { data: consumoData } = await supabase
            .from('materiais_consumo')
            .select('id, nome, unidade, quantidade, estoque_minimo, categoria, compartimento_id')
            .eq('viatura_id', id)
            .order('nome')
            .limit(1000);

          const itensConsumo: ItemExtrato[] = (consumoData || []).map(c => ({
            id: c.id,
            name: c.nome,
            type: `📦 Consumo (${c.categoria || 'Geral'})`,
            patrimonio_number: `${c.quantidade} ${c.unidade || 'un'}`,
            status: c.quantidade > (c.estoque_minimo || 0) ? 'Ok' : 'Baixo Estoque',
            compartimento_id: c.compartimento_id,
            compartimento_nome: c.compartimento_id ? mapaComps[c.compartimento_id] : undefined,
          }));

          // Combinar todos os itens sem duplicatas
          const fleetIds = new Set(itensFleet.map(f => f.id));
          const equipNovos = itensEquip.filter(e => !fleetIds.has(e.id));
          const idsJaIncluidos = new Set([...itensFleet.map(f => f.id), ...equipNovos.map(e => e.id)]);
          const consumoNovos = itensConsumo.filter(c => !idsJaIncluidos.has(c.id));
          const todosItens = [...itensFleet, ...equipNovos, ...consumoNovos];

          setItens(todosItens);

          // Montar agrupamento por Compartimento
          const gruposMontados: CompartimentoGroup[] = [];

          // Adicionar compartimentos estruturados em ordem
          (comps || []).forEach(comp => {
            const itensDoComp = todosItens.filter(i => i.compartimento_id === comp.id);
            gruposMontados.push({
              id: comp.id,
              nome: comp.nome,
              posicao: comp.posicao || undefined,
              itens: itensDoComp,
            });
          });

          // Adicionar itens sem compartimento definido no final
          const semComp = todosItens.filter(i => !i.compartimento_id || !mapaComps[i.compartimento_id]);
          if (semComp.length > 0) {
            gruposMontados.push({
              id: 'sem-compartimento',
              nome: 'Geral / Sem compartimento atribuído',
              itens: semComp,
            });
          }

          setGrupos(gruposMontados);
          setCarregando(false);
          return;
        }

        // ── 3. CASO AMBIENTE / LOCAL GERAL ────────────────────────────────────
        const { data: local, error: errorLocal } = await supabase
          .from('locais_equipamento')
          .select('*')
          .eq('id', id)
          .single();

        if (errorLocal || !local) {
          console.error('Erro ao buscar local:', errorLocal);
          setErro('Localização não encontrada ou não cadastrada.');
          setCarregando(false);
          return;
        }

        setTitulo(local.nome);
        setLocalTipo(local.tipo === 'viatura' ? 'Viatura' : 'Ambiente');

        const { data: fleetData } = await supabase
          .from('fleet')
          .select('id, name, type, patrimonio_number, status, brand, plate, location, local_id')
          .or(`local_id.eq.${id},location.ilike.${local.nome}`)
          .order('name')
          .limit(1000);

        const { data: consumoData } = await supabase
          .from('materiais_consumo')
          .select('id, nome, unidade, quantidade, estoque_minimo, categoria, local_id, viatura_id')
          .or(local.tipo === 'viatura' ? `viatura_id.eq.${id}` : `local_id.eq.${id}`)
          .order('nome')
          .limit(1000);

        const itensFleet = (fleetData || [])
          .filter(item => item.id !== id)
          .map(item => ({
            ...item,
            type: `🔧 ${item.type}`,
          }));

        const itensConsumo = (consumoData || []).map(c => ({
          id: c.id,
          name: c.nome,
          type: `📦 Consumo (${c.categoria || 'Geral'})`,
          patrimonio_number: `${c.quantidade} ${c.unidade || 'un'}`,
          status: c.quantidade > (c.estoque_minimo || 0) ? 'Ok' : 'Baixo Estoque',
        }));

        const todosItens = [...itensFleet, ...itensConsumo];
        setItens(todosItens);
        setGrupos([{
          id: 'ambiente-geral',
          nome: `Itens do Local (${local.nome})`,
          itens: todosItens,
        }]);

      } catch (err: any) {
        console.error('Erro geral na consulta pública:', err);
        setErro('Ocorreu um erro ao carregar as informações do extrato.');
      } finally {
        setCarregando(false);
      }
    }

    buscar();
  }, [tipo, id]);

  const totalItens = itens.length;
  const totalConferidos = Object.values(conferidos).filter(Boolean).length;
  const porcentagemConferido = totalItens > 0 ? Math.round((totalConferidos / totalItens) * 100) : 0;

  if (carregando) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f8fafc',
        color: '#475569'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #cbd5e1',
          borderTopColor: '#dc2626',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Carregando extrato público...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '80px auto',
        padding: '32px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        border: '1px solid #fee2e2'
      }}>
        <span style={{ fontSize: '48px', color: '#dc2626', marginBottom: '16px', display: 'block' }}>⚠️</span>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px' }}>Consulta Inválida</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: '1.5' }}>{erro}</p>
        <a href="/" style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 'bold',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '13px'
        }}>Ir para o Sistema</a>
      </div>
    );
  }

  let contadorGeralIndex = 0;

  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: '20px 14px 60px 14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1e293b',
      background: '#f8fafc',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* CABEÇALHO DA INSTITUIÇÃO */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        marginBottom: '16px'
      }}>
        <div style={{
          borderBottom: '3px solid #dc2626',
          paddingBottom: '14px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <p style={{
              margin: '0 0 2px',
              fontSize: '11px',
              color: '#dc2626',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
            }}>
              CBMSC — Araquari/SC
            </p>
            <h2 style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: '900',
              color: '#1e293b',
              letterSpacing: '-0.5px'
            }}>
              Extrato de Carga e Material
            </h2>
            <p style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: '700',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: '800' }}>
                {localTipo}
              </span>
              {titulo}
            </p>
          </div>
          <div style={{
            textAlign: 'right',
            fontSize: '11px',
            color: '#64748b',
            lineHeight: '1.4'
          }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#991b1b' }}>B4 LOGÍSTICA</p>
            <p style={{ margin: 0 }}>Carga Oficial</p>
          </div>
        </div>

        {/* DATA E PAINEL DE PROGRESSO DA CONFERÊNCIA */}
        <div style={{
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '12px 14px',
          fontSize: '12px',
          color: '#334155',
          border: '1px solid #cbd5e1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            <span>📅 Consultado em: <strong>{new Date().toLocaleString('pt-BR')}</strong></span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: totalConferidos === totalItens && totalItens > 0 ? '#15803d' : '#0f172a' }}>
              Conferidos: {totalConferidos} de {totalItens} ({porcentagemConferido}%)
            </span>
          </div>

          {/* Barra de Progresso Visual */}
          <div style={{
            width: '100%',
            height: '8px',
            background: '#e2e8f0',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <div style={{
              width: `${porcentagemConferido}%`,
              height: '100%',
              background: porcentagemConferido === 100 ? '#166534' : '#dc2626',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              💡 Clique nos itens para marcar como conferido / riscar
            </span>
            {totalConferidos > 0 && (
              <button
                onClick={limparConferidos}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  textDecoration: 'underline'
                }}
              >
                Desmarcar todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS ITENS AGRUPADOS POR COMPARTIMENTO */}
      {itens.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: '#64748b',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px dashed #cbd5e1'
        }}>
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📦</span>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Nenhum item cadastrado neste local.</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Os itens vinculados aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grupos.map((grupo, gIndex) => {
            if (grupo.itens.length === 0) return null;

            const corCfg = COMPARTIMENTO_CORES[gIndex % COMPARTIMENTO_CORES.length];

            return (
              <div
                key={grupo.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: `1px solid ${corCfg.border}`,
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                }}
              >
                {/* CABEÇALHO DO COMPARTIMENTO COM DESTAQUE DE COR */}
                <div style={{
                  background: corCfg.bg,
                  borderBottom: `2px solid ${corCfg.border}`,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{corCfg.icon}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: corCfg.text }}>
                        {grupo.nome}
                      </h3>
                      {grupo.posicao && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          Posição: {grupo.posicao}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    background: corCfg.badgeBg,
                    color: corCfg.text,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: `1px solid ${corCfg.border}`
                  }}>
                    {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* LISTAGEM DE ITENS DO COMPARTIMENTO */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {grupo.itens.map((item) => {
                    contadorGeralIndex++;
                    const currentIndex = contadorGeralIndex;
                    const isConferido = Boolean(conferidos[item.id]);
                    const isAtivo = item.status === 'active' || item.status === 'Ok';

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleConferido(item.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '14px 16px',
                          background: isConferido ? '#f8fafc' : '#ffffff',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.2s ease',
                          opacity: isConferido ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, paddingRight: '12px' }}>
                          {/* CHECKBOX DE CONFERÊNCIA (CHECKLIST) */}
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            border: isConferido ? '2px solid #166534' : '2px solid #cbd5e1',
                            background: isConferido ? '#166534' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            marginTop: '2px',
                            flexShrink: 0,
                            transition: 'all 0.2s ease'
                          }}>
                            {isConferido ? '✓' : ''}
                          </div>

                          {/* DADOS DO ITEM (COM RISCADO QUANDO CONFERIDO) */}
                          <div>
                            <p style={{
                              margin: 0,
                              fontWeight: '700',
                              fontSize: '14px',
                              color: isConferido ? '#64748b' : '#0f172a',
                              textDecoration: isConferido ? 'line-through' : 'none',
                              lineHeight: '1.4'
                            }}>
                              {currentIndex}. {item.name}
                            </p>
                            <p style={{
                              margin: '3px 0 0',
                              fontSize: '11px',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{ fontWeight: '600' }}>{item.type}</span>
                              {item.brand && <span>• {item.brand}</span>}
                              {item.patrimonio_number && (
                                <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', color: '#475569', border: '1px solid #e2e8f0' }}>
                                  Pat: {item.patrimonio_number}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* BADGE DE STATUS OU CHECADO */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isConferido ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '800',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac'
                            }}>
                              ✅ CHECADO
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: isAtivo ? '#dcfce7' : '#fee2e2',
                              color: isAtivo ? '#15803d' : '#b91c1c',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {isAtivo ? 'ATIVO' : 'INOPERANTE'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RODAPÉ INFORMATIVO */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: '#ffffff',
        borderRadius: '16px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#64748b',
        border: '1px solid #e2e8f0',
        lineHeight: '1.6'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#1e293b' }}>
          Sistema de Gestão Interna CBMSC Araquari
        </p>
        <p style={{ margin: 0 }}>
          Ficha pública de consulta para fins de conferência patrimonial e auditoria de carga.
        </p>
        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
          Qualquer divergência deve ser informada ao B4 da Unidade.
        </p>
      </div>
    </div>
  );
}

export default ExtratoPublico;
