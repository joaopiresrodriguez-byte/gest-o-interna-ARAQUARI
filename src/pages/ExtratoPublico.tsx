import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  salvarConferencia,
  buscarConferenciaDia,
  formatarMensagemWhatsAppConferencia,
  enviarConferenciaWhatsApp,
  NUMERO_CHEFE_SOCORRO
} from '../services/conferenciaService';
import { toast } from 'sonner';

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
  sort_order?: number;
}

interface CompartimentoGroup {
  id: string;
  nome: string;
  posicao?: string;
  itens: ItemExtrato[];
}

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

  // Estado dos registros de conferência (status e observação) por item
  const [conferenciaMap, setConferenciaMap] = useState<Record<string, { status: 'ok' | 'ocorrencia'; observacao?: string; conferido_por_nome?: string; conferido_em?: string }>>({});
  const [observacoesLocal, setObservacoesLocal] = useState<Record<string, string>>({});

  // Modal e controle de envio
  const [modalResumoAberto, setModalResumoAberto] = useState(false);
  const [nomeConferente, setNomeConferente] = useState('');
  const [horaFinalizacao, setHoraFinalizacao] = useState('');
  const [salvandoEEnviando, setSalvandoEEnviando] = useState(false);
  const [falhaEnvio, setFalhaEnvio] = useState(false);
  const [mensagemCache, setMensagemCache] = useState('');

  // Carregar dados de conferência existente do dia
  const recarregarConferencias = async () => {
    try {
      const mapa = await buscarConferenciaDia();
      const novoMapa: Record<string, { status: 'ok' | 'ocorrencia'; observacao?: string; conferido_por_nome?: string; conferido_em?: string }> = {};
      const novasObs: Record<string, string> = {};

      Object.entries(mapa).forEach(([itemId, record]: [string, any]) => {
        const st = record.status === 'ok' ? 'ok' : 'ocorrencia';
        novoMapa[itemId] = {
          status: st,
          observacao: record.observacao || '',
          conferido_por_nome: record.conferido_por_nome,
          conferido_em: record.conferido_em,
        };
        if (record.observacao) {
          novasObs[itemId] = record.observacao;
        }
      });

      setConferenciaMap(novoMapa);
      setObservacoesLocal(prev => ({ ...novasObs, ...prev }));
    } catch (e) {
      console.error('Erro ao buscar conferências do dia:', e);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setNomeConferente(user.email.split('@')[0].toUpperCase());
      }
    });
  }, []);

  useEffect(() => {
    async function buscar() {
      try {
        if (!id) {
          setErro('Identificador do local não fornecido.');
          setCarregando(false);
          return;
        }

        await recarregarConferencias();

        // 1. COMPARTIMENTO INDIVIDUAL
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

          const { data: equip } = await supabase
            .from('equipamentos')
            .select('id, nome, tipo, numero_serie, quantidade, status, sort_order')
            .eq('compartimento_id', id)
            .limit(1000);

          const equipItens: ItemExtrato[] = (equip && equip.length > 0)
            ? equip.map(e => ({
                id: e.id,
                name: `${e.nome}${e.quantidade && e.quantidade > 1 ? ` (x${e.quantidade})` : ''}`,
                type: `🔧 ${e.tipo || 'Equipamento'}`,
                patrimonio_number: e.numero_serie,
                status: e.status || 'Ok',
                sort_order: Number(e.sort_order) || 0,
              }))
            : await (async () => {
                const { data: fleetData } = await supabase
                  .from('fleet')
                  .select('id, name, type, patrimonio_number, status, brand, plate, sort_order')
                  .eq('compartimento_id', id)
                  .limit(1000);
                return (fleetData || []).map(f => ({
                  ...f,
                  type: `🔧 ${f.type || 'Equipamento'}`,
                  sort_order: Number(f.sort_order) || 0,
                }));
              })();

          const { data: consumo } = await supabase
            .from('materiais_consumo')
            .select('id, nome, unidade, quantidade, estoque_minimo, categoria, sort_order')
            .eq('compartimento_id', id)
            .limit(1000);

          const consumoItens: ItemExtrato[] = (consumo || []).map(c => ({
            id: c.id,
            name: c.nome,
            type: `📦 Consumo (${c.categoria || 'Geral'})`,
            patrimonio_number: `${c.quantidade} ${c.unidade || 'un'}`,
            status: c.quantidade > (c.estoque_minimo || 0) ? 'Ok' : 'Baixo Estoque',
            sort_order: Number(c.sort_order) || 0,
          }));

          const { data: checkData } = await supabase
            .from('checklist_items')
            .select('id, item_name, category, quantidade, is_active, sort_order')
            .eq('compartimento_id', id)
            .eq('is_active', true)
            .limit(1000);

          const checkItens: ItemExtrato[] = (checkData || []).map(ci => ({
            id: ci.id,
            name: `${ci.item_name}${ci.quantidade && ci.quantidade > 1 ? ` (x${ci.quantidade})` : ''}`,
            type: `✅ ${ci.category || 'Equipamento'}`,
            status: ci.is_active === false ? 'down' : 'Ok',
            sort_order: Number(ci.sort_order) || 0,
          }));

          const todosItensMap = new Map<string, ItemExtrato>();
          [...equipItens, ...consumoItens, ...checkItens].forEach(it => {
            if (!todosItensMap.has(it.id)) todosItensMap.set(it.id, it);
          });
          const todosItens = Array.from(todosItensMap.values()).sort((a, b) => {
            if ((a.sort_order || 0) !== (b.sort_order || 0)) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            }
            return a.name.localeCompare(b.name);
          });

          setItens(todosItens);
          setGrupos([{
            id: id,
            nome: 'Itens do Compartimento',
            itens: todosItens,
          }]);
          setCarregando(false);
          return;
        }

        // 2. VIATURA COMPLETA
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

          let itensFleet: ItemExtrato[] = [];
          if (compIds.length > 0) {
            const { data: fleetItems } = await supabase
              .from('fleet')
              .select('id, name, type, patrimonio_number, status, brand, plate, compartimento_id, sort_order')
              .in('compartimento_id', compIds)
              .neq('type', 'Viatura')
              .limit(1000);

            itensFleet = (fleetItems || []).map(f => ({
              ...f,
              type: `🔧 ${f.type}`,
              compartimento_id: f.compartimento_id,
              compartimento_nome: f.compartimento_id ? mapaComps[f.compartimento_id] : undefined,
              sort_order: Number(f.sort_order) || 0,
            }));
          }

          const { data: equipItems } = await supabase
            .from('equipamentos')
            .select('id, nome, tipo, numero_serie, quantidade, status, compartimento_id, sort_order')
            .eq('viatura_id', id)
            .limit(1000);

          const itensEquip: ItemExtrato[] = (equipItems || []).map(e => ({
            id: e.id,
            name: `${e.nome}${e.quantidade && e.quantidade > 1 ? ` (x${e.quantidade})` : ''}`,
            type: `🔧 ${e.tipo || 'Equipamento'}`,
            patrimonio_number: e.numero_serie,
            status: e.status || 'Ok',
            compartimento_id: e.compartimento_id,
            compartimento_nome: e.compartimento_id ? mapaComps[e.compartimento_id] : undefined,
            sort_order: Number(e.sort_order) || 0,
          }));

          const { data: consumoData } = await supabase
            .from('materiais_consumo')
            .select('id, nome, unidade, quantidade, estoque_minimo, categoria, compartimento_id, sort_order')
            .eq('viatura_id', id)
            .limit(1000);

          const itensConsumo: ItemExtrato[] = (consumoData || []).map(c => ({
            id: c.id,
            name: c.nome,
            type: `📦 Consumo (${c.categoria || 'Geral'})`,
            patrimonio_number: `${c.quantidade} ${c.unidade || 'un'}`,
            status: c.quantidade > (c.estoque_minimo || 0) ? 'Ok' : 'Baixo Estoque',
            compartimento_id: c.compartimento_id,
            compartimento_nome: c.compartimento_id ? mapaComps[c.compartimento_id] : undefined,
            sort_order: Number(c.sort_order) || 0,
          }));

          let itensChecklist: ItemExtrato[] = [];
          const { data: checkData } = await supabase
            .from('checklist_items')
            .select('id, item_name, category, quantidade, is_active, compartimento_id, sort_order')
            .or(
              compIds.length > 0
                ? `viatura_id.eq.${id},compartimento_id.in.(${compIds.join(',')})`
                : `viatura_id.eq.${id}`
            )
            .eq('is_active', true)
            .limit(1000);

          itensChecklist = (checkData || []).map(ci => ({
            id: ci.id,
            name: `${ci.item_name}${ci.quantidade && ci.quantidade > 1 ? ` (x${ci.quantidade})` : ''}`,
            type: `✅ ${ci.category || 'Equipamento'}`,
            status: ci.is_active === false ? 'down' : 'Ok',
            compartimento_id: ci.compartimento_id || undefined,
            compartimento_nome: ci.compartimento_id ? mapaComps[ci.compartimento_id] : undefined,
            sort_order: Number(ci.sort_order) || 0,
          }));

          const todosItensMap = new Map<string, ItemExtrato>();
          [...itensFleet, ...itensEquip, ...itensConsumo, ...itensChecklist].forEach(it => {
            if (!todosItensMap.has(it.id)) todosItensMap.set(it.id, it);
          });
          const todosItens = Array.from(todosItensMap.values());

          setItens(todosItens);

          const gruposMontados: CompartimentoGroup[] = [];
          (comps || []).forEach(comp => {
            const itensDoComp = todosItens
              .filter(i => i.compartimento_id === comp.id)
              .sort((a, b) => {
                if ((a.sort_order || 0) !== (b.sort_order || 0)) {
                  return (a.sort_order || 0) - (b.sort_order || 0);
                }
                return a.name.localeCompare(b.name);
              });

            gruposMontados.push({
              id: comp.id,
              nome: comp.nome,
              posicao: comp.posicao || undefined,
              itens: itensDoComp,
            });
          });

          const semComp = todosItens
            .filter(i => !i.compartimento_id || !mapaComps[i.compartimento_id])
            .sort((a, b) => {
              if ((a.sort_order || 0) !== (b.sort_order || 0)) {
                return (a.sort_order || 0) - (b.sort_order || 0);
              }
              return a.name.localeCompare(b.name);
            });

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

        // 3. AMBIENTE / LOCAL GERAL
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

  // Ações de Marcação (OK e OCORRÊNCIA) por item
  const marcarOk = async (item: ItemExtrato) => {
    setConferenciaMap(prev => ({
      ...prev,
      [item.id]: { status: 'ok', observacao: '' }
    }));
    setObservacoesLocal(prev => ({ ...prev, [item.id]: '' }));

    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'ok',
      observacao: '',
      item_nome: item.name,
      viatura_nome: titulo,
      compartimento_nome: item.compartimento_nome,
    });
  };

  const marcarOcorrencia = async (item: ItemExtrato) => {
    const obsAtual = observacoesLocal[item.id] || '';
    setConferenciaMap(prev => ({
      ...prev,
      [item.id]: { status: 'ocorrencia', observacao: obsAtual }
    }));

    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'avariado',
      observacao: obsAtual,
      item_nome: item.name,
      viatura_nome: titulo,
      compartimento_nome: item.compartimento_nome,
    });
  };

  const salvarObservacao = async (item: ItemExtrato, texto: string) => {
    setObservacoesLocal(prev => ({ ...prev, [item.id]: texto }));
    setConferenciaMap(prev => ({
      ...prev,
      [item.id]: { status: 'ocorrencia', observacao: texto }
    }));

    await salvarConferencia({
      fleet_item_id: item.id,
      equipamento_id: item.id,
      status: 'avariado',
      observacao: texto,
      item_nome: item.name,
      viatura_nome: titulo,
      compartimento_nome: item.compartimento_nome,
    });
  };

  // Cálculo dos totais
  const totalItens = itens.length;
  const totalConferidos = Object.keys(conferenciaMap).length;
  const itensOkCount = Object.values(conferenciaMap).filter(c => c.status === 'ok').length;
  const ocorrenciasCount = Object.values(conferenciaMap).filter(c => c.status === 'ocorrencia').length;
  const porcentagemConferido = totalItens > 0 ? Math.round((totalConferidos / totalItens) * 100) : 0;

  // Abrir Modal de Resumo
  const handleAbrirResumo = () => {
    // Validar se há alguma ocorrência sem observação
    const pendentesSemObs: string[] = [];
    Object.entries(conferenciaMap).forEach(([itemId, conf]) => {
      if (conf.status === 'ocorrencia' && !conf.observacao?.trim()) {
        const itemObj = itens.find(i => i.id === itemId);
        if (itemObj) pendentesSemObs.push(itemObj.name);
      }
    });

    if (pendentesSemObs.length > 0) {
      toast.error(
        `Preencha a observação obrigatória do item "${pendentesSemObs[0]}" antes de finalizar o resumo.`,
        { duration: 5000 }
      );
      return;
    }

    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setHoraFinalizacao(hora);
    setFalhaEnvio(false);
    setModalResumoAberto(true);
  };

  // Disparar Envio para Chefe de Socorro
  const handleConfirmarEEnviar = async () => {
    try {
      setSalvandoEEnviando(true);
      const hojeStr = new Date().toISOString().split('T')[0];

      const ocorrenciasDetalhadas = Object.entries(conferenciaMap)
        .filter(([_, conf]) => conf.status === 'ocorrencia')
        .map(([itemId, conf]) => {
          const itemObj = itens.find(i => i.id === itemId);
          return {
            item_nome: itemObj?.name || `Item #${itemId}`,
            observacao: conf.observacao || 'Sem observação',
            viatura_nome: titulo,
            compartimento_nome: itemObj?.compartimento_nome,
          };
        });

      const mensagem = formatarMensagemWhatsAppConferencia({
        dataConferencia: hojeStr,
        conferidoPor: nomeConferente || 'Militar de Serviço',
        horario: horaFinalizacao || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        totalConferidos,
        totalOk: itensOkCount,
        totalOcorrencias: ocorrenciasCount,
        ocorrencias: ocorrenciasDetalhadas,
      });

      setMensagemCache(mensagem);

      const disparado = enviarConferenciaWhatsApp(mensagem);

      if (disparado) {
        toast.success(`✅ Relatório enviado ao Chefe de Socorro (${NUMERO_CHEFE_SOCORRO}) via WhatsApp!`);
        setModalResumoAberto(false);
      } else {
        setFalhaEnvio(true);
        toast.warning('⚠️ Conferência salva! Não foi possível abrir o WhatsApp automaticamente.');
      }
    } catch (e: any) {
      toast.error('Erro ao enviar relatório: ' + e.message);
    } finally {
      setSalvandoEEnviando(false);
    }
  };

  const handleReenviarWhatsApp = () => {
    if (!mensagemCache) return;
    const disparado = enviarConferenciaWhatsApp(mensagemCache);
    if (disparado) {
      toast.success('Relatório enviado com sucesso!');
      setModalResumoAberto(false);
    } else {
      toast.error('Falha ao abrir WhatsApp. Verifique as permissões de pop-up.');
    }
  };

  if (carregando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#475569', fontFamily: 'system-ui' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Carregando extrato público...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', padding: '32px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #fee2e2', fontFamily: 'system-ui' }}>
        <span style={{ fontSize: '48px', color: '#dc2626', marginBottom: '16px', display: 'block' }}>⚠️</span>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px' }}>Consulta Inválida</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>{erro}</p>
        <a href="/" style={{ padding: '10px 20px', background: '#dc2626', color: '#ffffff', fontWeight: 'bold', borderRadius: '8px', textDecoration: 'none', fontSize: '13px' }}>Ir para o Sistema</a>
      </div>
    );
  }

  let contadorGeralIndex = 0;

  return (
    <div style={{
      maxWidth: '680px',
      width: '100%',
      margin: '0 auto',
      padding: '20px 14px 100px 14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1e293b',
      background: '#f8fafc',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: '100vh',
      maxHeight: '100vh',
      overflowY: 'scroll',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
      zIndex: 9999
    }}>
      {/* CABEÇALHO DA INSTITUIÇÃO */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '16px' }}>
        <div style={{ borderBottom: '3px solid #dc2626', paddingBottom: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#dc2626', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              CBMSC — Araquari/SC
            </p>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '900', color: '#1e293b', letterSpacing: '-0.5px' }}>
              Extrato de Carga e Material
            </h2>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: '800' }}>
                {localTipo}
              </span>
              {titulo}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#991b1b' }}>B4 LOGÍSTICA</p>
            <p style={{ margin: 0 }}>Carga Oficial</p>
          </div>
        </div>

        {/* DATA E PAINEL DE PROGRESSO DA CONFERÊNCIA */}
        <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#334155', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            <span>📅 Consultado em: <strong>{new Date().toLocaleString('pt-BR')}</strong></span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: totalConferidos === totalItens && totalItens > 0 ? '#15803d' : '#0f172a' }}>
              Conferidos: {totalConferidos} de {totalItens} ({porcentagemConferido}%)
            </span>
          </div>

          {/* Barra de Progresso Visual */}
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${porcentagemConferido}%`, height: '100%', background: porcentagemConferido === 100 ? '#166534' : '#dc2626', transition: 'width 0.3s ease' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              💡 Marque cada item como <strong>OK</strong> ou <strong>Ocorrência</strong>
            </span>
            <button
              onClick={handleAbrirResumo}
              style={{ background: '#166534', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
            >
              📋 Finalizar Conferência
            </button>
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS ITENS AGRUPADOS POR COMPARTIMENTO */}
      {itens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b', background: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📦</span>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Nenhum item cadastrado neste local.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grupos.map((grupo, gIndex) => {
            if (grupo.itens.length === 0) return null;
            const corCfg = COMPARTIMENTO_CORES[gIndex % COMPARTIMENTO_CORES.length];

            return (
              <div key={grupo.id} style={{ background: '#ffffff', borderRadius: '16px', border: `1px solid ${corCfg.border}`, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                {/* CABEÇALHO DO COMPARTIMENTO */}
                <div style={{ background: corCfg.bg, borderBottom: `2px solid ${corCfg.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <span style={{ fontSize: '11px', fontWeight: '800', background: corCfg.badgeBg, color: corCfg.text, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${corCfg.border}` }}>
                    {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* LISTAGEM DE ITENS COM AS DUAS OPÇÕES */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {grupo.itens.map((item) => {
                    contadorGeralIndex++;
                    const currentIndex = contadorGeralIndex;

                    const conf = conferenciaMap[item.id];
                    const isOk = conf?.status === 'ok';
                    const isOcorrencia = conf?.status === 'ocorrencia';
                    const obsTexto = observacoesLocal[item.id] || conf?.observacao || '';

                    const itemBg = isOk
                      ? '#f0fdf4'
                      : isOcorrencia
                      ? '#fef2f2'
                      : '#ffffff';

                    const itemBorder = isOk
                      ? '1px solid #bbf7d0'
                      : isOcorrencia
                      ? '1px solid #fca5a5'
                      : '1px solid #f1f5f9';

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '14px 16px',
                          background: itemBg,
                          borderBottom: itemBorder,
                          transition: 'background 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                          {/* INFORMAÇÃO DO ITEM */}
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#0f172a', lineHeight: '1.4' }}>
                              {currentIndex}. {item.name}
                            </p>
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600' }}>{item.type}</span>
                              {item.brand && <span>• {item.brand}</span>}
                              {item.patrimonio_number && (
                                <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', color: '#475569', border: '1px solid #e2e8f0' }}>
                                  Pat: {item.patrimonio_number}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* BOTÕES DE MARCAÇÃO NÍTIDOS (OK vs OCORRÊNCIA) */}
                          <div style={{ display: 'flex', gap: '6px', shrink: 0 }}>
                            <button
                              onClick={() => marcarOk(item)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: isOk ? '2px solid #166534' : '1px solid #cbd5e1',
                                background: isOk ? '#dcfce7' : 'white',
                                color: isOk ? '#166534' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: isOk ? 'bold' : '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>✅</span> OK
                            </button>

                            <button
                              onClick={() => marcarOcorrencia(item)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: isOcorrencia ? '2px solid #991b1b' : '1px solid #cbd5e1',
                                background: isOcorrencia ? '#fee2e2' : 'white',
                                color: isOcorrencia ? '#991b1b' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: isOcorrencia ? 'bold' : '500',
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
                        {isOcorrencia && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #fca5a5' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>
                              Observação da Ocorrência * (ausente, avariado, etc.)
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                value={obsTexto}
                                onChange={e => setObservacoesLocal(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Descreva o problema encontrado (obrigatório)..."
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: !obsTexto.trim() ? '2px solid #ef4444' : '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  background: '#ffffff',
                                  outline: 'none',
                                }}
                              />
                              <button
                                onClick={() => salvarObservacao(item, obsTexto)}
                                style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#dc2626', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Salvar
                              </button>
                            </div>
                            {!obsTexto.trim() && (
                              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600', marginTop: '2px', display: 'block' }}>
                                ⚠️ Campo de observação é obrigatório para registrar ocorrência.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BARRA FIXA INFERIOR DE FINALIZAÇÃO */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        background: '#0f172a',
        color: 'white',
        padding: '10px 18px',
        borderRadius: '999px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '90%',
        maxWidth: '560px',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '11px' }}>
          <span>OK: <strong style={{ color: '#4ade80' }}>{itensOkCount}</strong></span> ·{' '}
          <span>Ocorrências: <strong style={{ color: '#f87171' }}>{ocorrenciasCount}</strong></span>
        </div>
        <button
          onClick={handleAbrirResumo}
          style={{ background: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '999px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📋 Finalizar & Enviar
        </button>
      </div>

      {/* MODAL DE RESUMO (BLOCOS 3, 4 E 5) */}
      {modalResumoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', margin: 'auto' }}>
            
            {/* CABEÇALHO DO RESUMO */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: 'white' }}>
                  📋 Resumo da Conferência — {titulo}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Data: <strong style={{ color: '#e2e8f0' }}>{new Date().toLocaleDateString('pt-BR')}</strong> · 
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* CAMPO DE NOME DO CONFERENTE */}
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}>
                  Nome do Militar Conferente *
                </label>
                <input
                  value={nomeConferente}
                  onChange={e => setNomeConferente(e.target.value.toUpperCase())}
                  placeholder="DIGITE SEU NOME / GUERRA..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '13px', fontWeight: 'bold', boxSizing: 'border-box' }}
                />
              </div>

              {/* TOTAIS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#1e293b', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>CONFERIDOS</span>
                  <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '900', color: 'white' }}>{totalConferidos}</p>
                </div>
                <div style={{ background: '#064e3b', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid #047857' }}>
                  <span style={{ fontSize: '10px', color: '#a7f3d0', fontWeight: 'bold' }}>ITENS OK</span>
                  <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '900', color: '#34d399' }}>{itensOkCount}</p>
                </div>
                <div style={{ background: '#7f1d1d', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid #b91c1c' }}>
                  <span style={{ fontSize: '10px', color: '#fca5a5', fontWeight: 'bold' }}>OCORRÊNCIAS</span>
                  <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '900', color: '#f87171' }}>{ocorrenciasCount}</p>
                </div>
              </div>

              {/* SEÇÃO OCORRÊNCIAS */}
              <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '12px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 'bold', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span> OCORRÊNCIAS ENCONTRADAS ({ocorrenciasCount})
                </h4>

                {ocorrenciasCount === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#f87171', fontStyle: 'italic' }}>
                    Nenhuma ocorrência registrada. Todos os itens conferidos estão em conformidade!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(conferenciaMap)
                      .filter(([_, c]) => c.status === 'ocorrencia')
                      .map(([itemId, c], idx) => {
                        const itemObj = itens.find(i => i.id === itemId);
                        const obsText = observacoesLocal[itemId] || c.observacao || 'Sem observação';

                        return (
                          <div key={idx} style={{ background: '#7f1d1d', padding: '10px 12px', borderRadius: '8px', border: '1px solid #b91c1c' }}>
                            <strong style={{ fontSize: '13px', color: 'white', display: 'block' }}>
                              • {itemObj?.name || `Item #${itemId}`}
                            </strong>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fecaca', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px' }}>
                              💬 {obsText}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* SEÇÃO ITENS OK */}
              <div style={{ background: '#022c22', border: '1px solid #065f46', borderRadius: '12px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 'bold', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✅</span> ITENS OK ({itensOkCount})
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: '#a7f3d0' }}>
                  {itensOkCount} itens validados em conformidade operacional.
                </p>
              </div>

              {/* TRATAMENTO DE FALHA NO ENVIO */}
              {falhaEnvio && (
                <div style={{ background: '#78350f', border: '1px solid #d97706', padding: '12px', borderRadius: '10px', color: '#fef3c7', fontSize: '12px' }}>
                  ⚠️ <strong>Conferência salva no banco de dados!</strong> Caso a janela do WhatsApp não tenha aberto, clique abaixo para tentar o envio direto ao Chefe de Socorro.
                </div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO DO RESUMO */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
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
                  style={{ flex: 1.5, padding: '12px', background: '#d97706', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  📲 Tentar Enviar Novamente
                </button>
              ) : (
                <button
                  onClick={handleConfirmarEEnviar}
                  disabled={salvandoEEnviando}
                  style={{ flex: 1.5, padding: '12px', background: '#166534', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {salvandoEEnviando ? '⏳ Finalizando...' : '📲 Confirmar e Enviar'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default ExtratoPublico;
