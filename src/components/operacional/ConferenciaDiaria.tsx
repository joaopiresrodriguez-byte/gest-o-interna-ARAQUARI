import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
  buscarConferenciaDia,
  salvarConferencia,
  formatarMensagemWhatsAppConferencia,
  enviarConferenciaWhatsApp,
  NUMERO_CHEFE_SOCORRO
} from '../../services/conferenciaService';
import { toast } from 'sonner';

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
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <button
                onClick={async e => {
                  e.stopPropagation();
                  await salvarConferencia({
                    viatura_id: id,
                    fleet_item_id: id,
                    status: 'ok',
                    item_nome: viaturaCtx ? `${viaturaCtx.nome}${viaturaCtx.placa ? ` — ${viaturaCtx.placa}` : ''}` : titulo,
                    viatura_nome: viaturaCtx?.nome || titulo,
                  });
                  onAtualizar();
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: confViatura?.status === 'ok' ? '2px solid #166534' : '1px solid #cbd5e1',
                  background: confViatura?.status === 'ok' ? '#dcfce7' : '#f8fafc',
                  color: confViatura?.status === 'ok' ? '#166534' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}
              >
                ✅ OK
              </button>
              <button
                onClick={async e => {
                  e.stopPropagation();
                  await salvarConferencia({
                    viatura_id: id,
                    fleet_item_id: id,
                    status: 'avariado',
                    item_nome: viaturaCtx ? `${viaturaCtx.nome}${viaturaCtx.placa ? ` — ${viaturaCtx.placa}` : ''}` : titulo,
                    viatura_nome: viaturaCtx?.nome || titulo,
                  });
                  onAtualizar();
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: confViatura?.status && confViatura.status !== 'ok' ? '2px solid #991b1b' : '1px solid #cbd5e1',
                  background: confViatura?.status && confViatura.status !== 'ok' ? '#fee2e2' : '#f8fafc',
                  color: confViatura?.status && confViatura.status !== 'ok' ? '#991b1b' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}
              >
                ⚠️ Ocorrência
              </button>
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

// Nível 3 — Item Individual com 2 escolhas nítidas (OK vs OCORRÊNCIA)
interface N3Props {
  item: ItemFleet;
  tipo?: string;
  conferenciaMap: Record<string, any>;
  onAtualizar: () => void;
  viaturaCtx?: { id: string; nome: string; placa?: string };
  compartimentoCtx?: { id: string; nome: string; posicao?: string };
  localCtx?: { id: string; nome: string };
}

function NivelTres({ item, tipo, conferenciaMap, onAtualizar, viaturaCtx, compartimentoCtx, localCtx }: N3Props) {
  const conf = conferenciaMap[item.id];
  const isOk = conf?.status === 'ok';
  const isOcorrencia = conf?.status && conf.status !== 'ok';

  const [observacao, setObservacao] = useState(conf?.observacao || '');
  const [expandidoObs, setExpandidoObs] = useState(Boolean(isOcorrencia));

  useEffect(() => {
    if (conf?.observacao !== undefined) {
      setObservacao(conf.observacao || '');
    }
    if (isOcorrencia) {
      setExpandidoObs(true);
    }
  }, [conf?.status, conf?.observacao]);

  async function marcarOk() {
    setObservacao('');
    setExpandidoObs(false);
    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'ok',
      observacao: '',
      item_nome: item.name,
      viatura_nome: viaturaCtx?.nome || undefined,
      compartimento_nome: compartimentoCtx?.nome || undefined,
      local_nome: localCtx?.nome || undefined,
    });
    onAtualizar();
  }

  async function marcarOcorrencia() {
    setExpandidoObs(true);
    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'avariado',
      observacao: observacao,
      item_nome: item.name,
      viatura_nome: viaturaCtx?.nome || undefined,
      compartimento_nome: compartimentoCtx?.nome || undefined,
      local_nome: localCtx?.nome || undefined,
    });
    onAtualizar();
  }

  async function salvarTextoObs() {
    if (!observacao.trim()) {
      toast.error(`A observação é obrigatória para o item ${item.name}`);
      return;
    }
    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'avariado',
      observacao: observacao,
      item_nome: item.name,
      viatura_nome: viaturaCtx?.nome || undefined,
      compartimento_nome: compartimentoCtx?.nome || undefined,
      local_nome: localCtx?.nome || undefined,
    });
    toast.success('Observação registrada com sucesso!');
    onAtualizar();
  }

  const containerBg = isOk
    ? '#f0fdf4'
    : isOcorrencia
    ? '#fef2f2'
    : 'white';

  const containerBorder = isOk
    ? '1px solid #bbf7d0'
    : isOcorrencia
    ? '1px solid #fca5a5'
    : '1px solid #f1f5f9';

  return (
    <div style={{ padding: '10px 12px', marginBottom: '6px', background: containerBg, borderRadius: '8px', border: containerBorder, marginLeft: '12px', transition: 'all 0.2s' }}>
      {/* LINHA PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* NOME E TIPO */}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600' }}>
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

        {/* OPÇÕES OK vs OCORRÊNCIA */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* BOTÃO OK */}
          <button
            onClick={marcarOk}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: isOk ? '2px solid #166534' : '1px solid #cbd5e1',
              background: isOk ? '#dcfce7' : 'white',
              color: isOk ? '#166534' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isOk ? 'bold' : '500',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>✅</span> OK
          </button>

          {/* BOTÃO OCORRÊNCIA */}
          <button
            onClick={marcarOcorrencia}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: isOcorrencia ? '2px solid #991b1b' : '1px solid #cbd5e1',
              background: isOcorrencia ? '#fee2e2' : 'white',
              color: isOcorrencia ? '#991b1b' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isOcorrencia ? 'bold' : '500',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⚠️</span> Ocorrência
          </button>
        </div>
      </div>

      {/* CAMPO EXPANSÍVEL DE OBSERVAÇÃO (OBRIGATÓRIO QUANDO OCORRÊNCIA) */}
      {(expandidoObs || isOcorrencia) && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #fca5a5' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>
            Observação da Ocorrência * (ausente, avariado, incompleto, etc.)
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Descreva o problema encontrado (obrigatório)..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: !observacao.trim() && isOcorrencia ? '2px solid #ef4444' : '1px solid #cbd5e1',
                fontSize: '12px',
                background: '#fff',
                outline: 'none',
              }}
            />
            <button
              onClick={salvarTextoObs}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#dc2626',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Salvar
            </button>
          </div>
          {!observacao.trim() && isOcorrencia && (
            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600', marginTop: '2px', display: 'block' }}>
              ⚠️ Campo de observação é obrigatório para registrar ocorrência.
            </span>
          )}
        </div>
      )}

      {/* RODAPÉ DE AUDITORIA */}
      {conf?.conferido_por_nome && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
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

  // Estados do Modal de Resumo (Blocos 3, 4 & 5)
  const [modalResumoAberto, setModalResumoAberto] = useState(false);
  const [nomeConferente, setNomeConferente] = useState('');
  const [horaFinalizacao, setHoraFinalizacao] = useState('');
  const [salvandoEEnviando, setSalvandoEEnviando] = useState(false);
  const [falhaEnvio, setFalhaEnvio] = useState(false);
  const [mensagemFormatadaCache, setMensagemFormatadaCache] = useState('');
  const [obsGuarnicao, setObsGuarnicao] = useState('');

  const confGuarnicao = conferenciaMap['guarnicao_servico'];
  useEffect(() => {
    if (confGuarnicao?.observacao !== undefined) {
      setObsGuarnicao(confGuarnicao.observacao || '');
    }
  }, [confGuarnicao?.observacao]);

  // Estados de Efetivo Escalado (Militares vs BCs)
  const [efetivoMilitares, setEfetivoMilitares] = useState<any[]>([]);
  const [efetivoBCs, setEfetivoBCs] = useState<any[]>([]);
  const [statusEfetivoMap, setStatusEfetivoMap] = useState<Record<string, { status: 'presente' | 'ausente' | 'alteracao'; obs: string }>>({});
  const [modalNotifEfetivo, setModalNotifEfetivo] = useState<{ aberto: boolean; efetivo: any | null; obs: string }>({ aberto: false, efetivo: null, obs: '' });

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
    const hojeStr = new Date().toISOString().split('T')[0];
    const mesRef = hojeStr.substring(0, 7);

    Promise.all([
      buscarDados(),
      buscarConferenciaDia(),
      supabase.from('escalas').select('*').eq('data', hojeStr).maybeSingle(),
      supabase.from('personnel').select('*'),
      supabase.from('bc_selecionados').select('*').eq('dia', hojeStr)
    ])
      .then(([d, mapa, escalaRes, personnelRes, bcSelRes]) => {
        setDados(d);
        setConferenciaMap(mapa);

        const allPersonnel = (personnelRes.data || []) as any[];
        
        // 1. Separar Militares da Escala do dia
        const idsMilitares: number[] = escalaRes.data?.militares || [];
        const mils = allPersonnel.filter(p => idsMilitares.includes(p.id) || (p.type === 'Militar' && idsMilitares.includes(Number(p.id))));
        setEfetivoMilitares(mils.length > 0 ? mils : allPersonnel.filter(p => p.type === 'Militar').slice(0, 4));

        // 2. Separar Bombeiros Comunitários (BCs) escalados no dia
        const idsBCs = (bcSelRes.data || []).map((b: any) => Number(b.bombeiro_id));
        const bcs = allPersonnel.filter(p => idsBCs.includes(p.id) || (p.type === 'BC' && idsBCs.includes(Number(p.id))));
        setEfetivoBCs(bcs.length > 0 ? bcs : allPersonnel.filter(p => p.type === 'BC' || p.role?.includes('BC')).slice(0, 4));

        setLoading(false);
      })
      .catch(e => {
        setErro(e.message || 'Erro ao carregar.');
        setLoading(false);
      });
  }, []);

  // Obter nome de quem está realizando
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setNomeConferente(user.email.split('@')[0].toUpperCase());
      }
    });
  }, []);

  // Abrir Modal de Resumo com validação estrita
  const handleAbrirResumo = () => {
    // 1. Validar ocorrências sem observação
    const ocorrenciasSemObs: string[] = [];
    dados.itens.forEach(i => {
      const conf = conferenciaMap[i.id];
      if (conf?.status && conf.status !== 'ok' && !conf.observacao?.trim()) {
        ocorrenciasSemObs.push(i.name);
      }
    });

    if (ocorrenciasSemObs.length > 0) {
      toast.error(
        `Existem ${ocorrenciasSemObs.length} ocorrência(s) sem observação descrita. Preencha a observação do item "${ocorrenciasSemObs[0]}" antes de finalizar.`,
        { duration: 5000 }
      );
      return;
    }

    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setHoraFinalizacao(hora);
    setFalhaEnvio(false);
    setModalResumoAberto(true);
  };

  // Calcular itens para o resumo
  const totalConferidos = Object.keys(conferenciaMap).length;
  const itensOk = Object.values(conferenciaMap).filter((c: any) => c.status === 'ok');
  const ocorrenciasList = Object.values(conferenciaMap).filter((c: any) => c.status && c.status !== 'ok');

  // Confirmar e Enviar para WhatsApp (Chefe de Socorro)
  const handleConfirmarEEnviar = async () => {
    try {
      setSalvandoEEnviando(true);
      const hojeStr = new Date().toISOString().split('T')[0];

      // Formatar lista de ocorrências com contexto
      const ocorrenciasDetalhadas = ocorrenciasList.map((c: any) => {
        const itemObj = dados.itens.find(i => i.id === c.id);
        const compObj = dados.compartimentos.find(comp => comp.id === itemObj?.compartimento_id);
        const vtrObj = dados.viaturas.find(v => v.id === compObj?.viatura_id);
        return {
          item_nome: itemObj?.name || c.item_nome || `Item #${c.id}`,
          observacao: c.observacao || 'Sem detalhes',
          viatura_nome: vtrObj?.name,
          compartimento_nome: compObj?.nome,
        };
      });

      const mensagem = formatarMensagemWhatsAppConferencia({
        dataConferencia: hojeStr,
        conferidoPor: nomeConferente || 'Militar de Serviço',
        horario: horaFinalizacao || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        totalConferidos,
        totalOk: itensOk.length,
        totalOcorrencias: ocorrenciasList.length,
        ocorrencias: ocorrenciasDetalhadas,
      });

      setMensagemFormatadaCache(mensagem);

      // Disparar WhatsApp
      const disparado = enviarConferenciaWhatsApp(mensagem);

      if (disparado) {
        toast.success(`✅ Conferência finalizada e relatório enviado ao Chefe de Socorro (${NUMERO_CHEFE_SOCORRO})!`);
        setModalResumoAberto(false);
      } else {
        setFalhaEnvio(true);
        toast.warning('⚠️ Conferência salva! Falha ao abrir o WhatsApp automaticamente.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao finalizar conferência: ' + err.message);
    } finally {
      setSalvandoEEnviando(false);
    }
  };

  const handleReenviarWhatsApp = () => {
    if (!mensagemFormatadaCache) return;
    const disparado = enviarConferenciaWhatsApp(mensagemFormatadaCache);
    if (disparado) {
      toast.success('Relatório enviado com sucesso!');
      setModalResumoAberto(false);
    } else {
      toast.error('Não foi possível abrir o aplicativo do WhatsApp. Tente novamente.');
    }
  };

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
    <div style={{ paddingBottom: '80px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b', margin: 0 }}>
            🚒 Conferência Diária — Viaturas, Locais e Guarnição
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
            Guarnição · {dados.viaturas.length} viaturas · {dados.locais.length} locais · {dados.itens.length} itens
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={expandirTudo}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '12px', padding: '6px 14px' }}
          >
            Expandir tudo
          </button>
          <button
            onClick={handleAbrirResumo}
            style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            📋 Finalizar Conferência
          </button>
        </div>
      </div>

      {/* BLOCO DEDICADO: CARDS DE CONFERÊNCIA INDIVIDUAL POR EFETIVO (MILITARES E BCs) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 shadow-md text-white">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
            </div>
            <div>
              <h4 className="text-base font-black text-white">Conferência da Guarnição de Serviço</h4>
              <p className="text-xs text-slate-400">Marque a presença ou alteração individual de cada efetivo escalado no plantão.</p>
            </div>
          </div>
        </div>

        {/* GRUPO 1 — MILITARES */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-xs font-black text-red-400 uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">local_fire_department</span>
            <span>GRUPO 1 — MILITARES ({efetivoMilitares.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {efetivoMilitares.map((efetivo) => {
              const chave = `efetivo-${efetivo.id}`;
              const state = statusEfetivoMap[chave] || { status: 'presente', obs: '' };

              return (
                <div
                  key={efetivo.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    state.status === 'presente'
                      ? 'bg-emerald-950/30 border-emerald-800/60'
                      : state.status === 'ausente'
                      ? 'bg-red-950/30 border-red-800/60'
                      : 'bg-amber-950/30 border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full bg-cover bg-center border border-slate-700 shrink-0"
                      style={{ backgroundImage: `url(${efetivo.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black text-red-400 uppercase block">{efetivo.rank || 'Militar'}</span>
                      <h5 className="text-xs font-bold text-white truncate">{efetivo.war_name || efetivo.name}</h5>
                      <p className="text-[10px] text-slate-400 font-mono truncate">Matrícula: {efetivo.matricula || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'presente', obs: '' } }));
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'presente'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => {
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'ausente', obs: '' } }));
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'ausente'
                          ? 'bg-red-600 text-white border-red-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Ausente
                    </button>
                    <button
                      onClick={() => {
                        const obs = prompt(`Descreva a alteração para ${efetivo.war_name || efetivo.name}:`) || '';
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'alteracao', obs } }));
                        if (obs.trim()) {
                          setModalNotifEfetivo({ aberto: true, efetivo, obs });
                        }
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'alteracao'
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Alteração
                    </button>
                  </div>

                  {state.obs && (
                    <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/60 p-1.5 rounded border border-amber-800/50">
                      💬 {state.obs}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DIVISOR VISUAL */}
        <div className="border-t border-slate-800 my-4" />

        {/* GRUPO 2 — BOMBEIROS COMUNITÁRIOS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">groups</span>
            <span>GRUPO 2 — BOMBEIROS COMUNITÁRIOS ({efetivoBCs.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {efetivoBCs.map((efetivo) => {
              const chave = `efetivo-${efetivo.id}`;
              const state = statusEfetivoMap[chave] || { status: 'presente', obs: '' };

              return (
                <div
                  key={efetivo.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    state.status === 'presente'
                      ? 'bg-emerald-950/30 border-emerald-800/60'
                      : state.status === 'ausente'
                      ? 'bg-red-950/30 border-red-800/60'
                      : 'bg-amber-950/30 border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full bg-cover bg-center border border-slate-700 shrink-0"
                      style={{ backgroundImage: `url(${efetivo.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black text-cyan-400 uppercase block">{efetivo.rank || 'BC'}</span>
                      <h5 className="text-xs font-bold text-white truncate">{efetivo.name}</h5>
                      <p className="text-[10px] text-slate-400 font-mono truncate">Matrícula: {efetivo.matricula || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'presente', obs: '' } }));
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'presente'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => {
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'ausente', obs: '' } }));
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'ausente'
                          ? 'bg-red-600 text-white border-red-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Ausente
                    </button>
                    <button
                      onClick={() => {
                        const obs = prompt(`Descreva a alteração para ${efetivo.name}:`) || '';
                        setStatusEfetivoMap(prev => ({ ...prev, [chave]: { status: 'alteracao', obs } }));
                        if (obs.trim()) {
                          setModalNotifEfetivo({ aberto: true, efetivo, obs });
                        }
                      }}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        state.status === 'alteracao'
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Alteração
                    </button>
                  </div>

                  {state.obs && (
                    <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/60 p-1.5 rounded border border-amber-800/50">
                      💬 {state.obs}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

      {/* BARRA FIXA INFERIOR DE FINALIZAÇÃO */}
      <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, background: '#1e293b', color: 'white', padding: '10px 20px', borderRadius: '999px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', items: 'center', gap: '16px' }}>
        <div style={{ fontSize: '12px' }}>
          <span>Conferidos: <strong>{totalConferidos}</strong></span> ·{' '}
          <span style={{ color: '#4ade80' }}>OK: <strong>{itensOk.length}</strong></span> ·{' '}
          <span style={{ color: '#f87171' }}>Ocorrências: <strong>{ocorrenciasList.length}</strong></span>
        </div>
        <button
          onClick={handleAbrirResumo}
          style={{ background: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '999px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📋 Finalizar & Enviar WhatsApp
        </button>
      </div>

      {/* MODAL DE RESUMO (BLOCOS 3, 4 E 5) */}
      {modalResumoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            {/* CABEÇALHO DO RESUMO */}
            <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                  📋 Resumo da Conferência Diária
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Data: <strong style={{ color: '#e2e8f0' }}>{new Date().toLocaleDateString('pt-BR')}</strong> · 
                  Realizada por: <strong style={{ color: '#e2e8f0' }}>{nomeConferente || 'Militar'}</strong> · 
                  Horário: <strong style={{ color: '#e2e8f0' }}>{horaFinalizacao}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalResumoAberto(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* CORPO DO RESUMO */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* TOTAIS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#1e293b', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>CONFERIDOS</span>
                  <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '900', color: 'white' }}>{totalConferidos}</p>
                </div>
                <div style={{ background: '#064e3b', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #047857' }}>
                  <span style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: 'bold' }}>ITENS OK</span>
                  <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '900', color: '#34d399' }}>{itensOk.length}</p>
                </div>
                <div style={{ background: '#7f1d1d', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #b91c1c' }}>
                  <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 'bold' }}>OCORRÊNCIAS</span>
                  <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '900', color: '#f87171' }}>{ocorrenciasList.length}</p>
                </div>
              </div>

              {/* SEÇÃO OCORRÊNCIAS */}
              <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '12px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 'bold', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span> SEÇÃO DE OCORRÊNCIAS ENCONTRADAS ({ocorrenciasList.length})
                </h4>

                {ocorrenciasList.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#f87171', fontStyle: 'italic' }}>
                    Nenhuma ocorrência registrada. Todos os itens em conformidade!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ocorrenciasList.map((item: any, idx: number) => {
                      const fleetObj = dados.itens.find(i => i.id === item.id);
                      const compObj = dados.compartimentos.find(c => c.id === fleetObj?.compartimento_id);
                      const vtrObj = dados.viaturas.find(v => v.id === compObj?.viatura_id);

                      return (
                        <div key={idx} style={{ background: '#7f1d1d', padding: '10px 12px', borderRadius: '8px', border: '1px solid #b91c1c' }}>
                          <strong style={{ fontSize: '13px', color: 'white', display: 'block' }}>
                            • {fleetObj?.name || item.item_nome || `Item #${item.id}`}
                          </strong>
                          {vtrObj && (
                            <span style={{ fontSize: '10px', color: '#fca5a5', display: 'block', marginTop: '2px' }}>
                              Viatura: {vtrObj.name} {compObj ? `(${compObj.nome})` : ''}
                            </span>
                          )}
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fecaca', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px' }}>
                            💬 {item.observacao || 'Sem observação'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SEÇÃO ITENS OK */}
              <div style={{ background: '#022c22', border: '1px solid #065f46', borderRadius: '12px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 'bold', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✅</span> SEÇÃO ITENS OK ({itensOk.length})
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: '#a7f3d0' }}>
                  {itensOk.length} itens foram validados em estado operacional e sem pendências.
                </p>
              </div>

              {/* AVISO DE TRATAMENTO DE FALHA */}
              {falhaEnvio && (
                <div style={{ background: '#78350f', border: '1px solid #d97706', padding: '12px', borderRadius: '10px', color: '#fef3c7', fontSize: '12px' }}>
                  ⚠️ <strong>Conferência salva com sucesso no banco de dados!</strong> O envio automático pelo WhatsApp não abriu. Clique no botão abaixo para tentar o envio direto.
                </div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO DO RESUMO */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyBetween: 'space-between', gap: '12px' }}>
              <button
                onClick={() => setModalResumoAberto(false)}
                disabled={salvandoEEnviando}
                style={{ flex: 1, padding: '12px', background: '#334155', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                Voltar e Corrigir
              </button>

              {falhaEnvio ? (
                <button
                  onClick={handleReenviarWhatsApp}
                  style={{ flex: 1.5, padding: '12px', background: '#d97706', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', items: 'center', justifyCenter: 'center', gap: '6px' }}
                >
                  📲 Tentar Enviar Novamente
                </button>
              ) : (
                <button
                  onClick={handleConfirmarEEnviar}
                  disabled={salvandoEEnviando}
                  style={{ flex: 1.5, padding: '12px', background: '#166534', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', items: 'center', justifyCenter: 'center', gap: '6px' }}
                >
                  {salvandoEEnviando ? '⏳ Finalizando...' : '📲 Confirmar e Enviar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOTIFICAÇÃO VIA WHATSAPP PARA ALTERAÇÃO NO EFETIVO */}
      {modalNotifEfetivo.aberto && modalNotifEfetivo.efetivo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-800/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white">
            <div className="text-center">
              <span className="material-symbols-outlined text-4xl text-amber-500 mb-1">warning</span>
              <h3 className="text-lg font-black text-white">Notificar Alteração na Guarnição</h3>
              <p className="text-xs text-slate-400 mt-1">
                Efetivo: <strong className="text-amber-400">{modalNotifEfetivo.efetivo.rank || 'Efetivo'} {modalNotifEfetivo.efetivo.war_name || modalNotifEfetivo.efetivo.name}</strong>
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-2 text-xs text-slate-300 text-left">
                💬 <strong>Alteração:</strong> {modalNotifEfetivo.obs}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {/* Botão 1 — Comandante */}
              <button
                onClick={() => {
                  const dataFmt = new Date().toLocaleDateString('pt-BR');
                  const msg = encodeURIComponent(
                    `⚠️ ALTERAÇÃO NA CONFERÊNCIA DA GUARNIÇÃO — ${dataFmt}\n\n` +
                    `Efetivo: ${modalNotifEfetivo.efetivo.name} (${modalNotifEfetivo.efetivo.rank || 'Efetivo'})\n` +
                    `Alteração registrada: ${modalNotifEfetivo.obs}\n` +
                    `Registrado por: ${nomeConferente || 'Usuário do Sistema'}`
                  );
                  window.open(`https://wa.me/5547988899591?text=${msg}`, '_blank');
                }}
                className="w-full flex items-center gap-3 p-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 rounded-xl transition-all text-left"
              >
                <span className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  👨‍✈️
                </span>
                <div>
                  <p className="text-xs font-bold text-white">Botão 1 — Enviar para Comandante</p>
                  <p className="text-[10px] text-red-300">Número: (47) 98889-9591</p>
                </div>
              </button>

              {/* Botão 2 — Coordenador BC */}
              <button
                onClick={() => {
                  const dataFmt = new Date().toLocaleDateString('pt-BR');
                  const msg = encodeURIComponent(
                    `⚠️ ALTERAÇÃO NA CONFERÊNCIA DA GUARNIÇÃO — ${dataFmt}\n\n` +
                    `Efetivo: ${modalNotifEfetivo.efetivo.name} (${modalNotifEfetivo.efetivo.rank || 'Efetivo'})\n` +
                    `Alteração registrada: ${modalNotifEfetivo.obs}\n` +
                    `Registrado por: ${nomeConferente || 'Usuário do Sistema'}`
                  );
                  window.open(`https://wa.me/5547996121663?text=${msg}`, '_blank');
                }}
                className="w-full flex items-center gap-3 p-3 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 rounded-xl transition-all text-left"
              >
                <span className="w-9 h-9 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  🤝
                </span>
                <div>
                  <p className="text-xs font-bold text-white">Botão 2 — Enviar para Coordenador BC</p>
                  <p className="text-[10px] text-cyan-300">Número: (47) 99612-1663</p>
                </div>
              </button>

              {/* Enviar para Ambos */}
              <button
                onClick={() => {
                  const dataFmt = new Date().toLocaleDateString('pt-BR');
                  const msg = encodeURIComponent(
                    `⚠️ ALTERAÇÃO NA CONFERÊNCIA DA GUARNIÇÃO — ${dataFmt}\n\n` +
                    `Efetivo: ${modalNotifEfetivo.efetivo.name} (${modalNotifEfetivo.efetivo.rank || 'Efetivo'})\n` +
                    `Alteração registrada: ${modalNotifEfetivo.obs}\n` +
                    `Registrado por: ${nomeConferente || 'Usuário do Sistema'}`
                  );
                  window.open(`https://wa.me/5547988899591?text=${msg}`, '_blank');
                  setTimeout(() => {
                    window.open(`https://wa.me/5547996121663?text=${msg}`, '_blank');
                  }, 800);
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all text-xs font-bold text-white shadow-sm"
              >
                📲 Enviar para Ambos (Comandante + Coordenador)
              </button>
            </div>

            <button
              onClick={() => setModalNotifEfetivo({ aberto: false, efetivo: null, obs: '' })}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Fechar sem enviar WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferenciaDiaria;
