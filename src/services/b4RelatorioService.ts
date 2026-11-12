import { supabase } from './supabase';

export interface RelatorioMensal {
  mes: number;
  ano: number;
  titulo: string;
  totalPatrimonio: number;
  totalViaturas: number;
  viaturasOperacionais: number;
  viaturasManutencao: number;
  totalManutencoes: number;
  custoManutencoes: number;
  totalCombustivel: number;
  custoCombustivel: number;
  ocorrenciasAtendidas: number;
  kmRodados: number;
  patrimonioNovo: number;
  patrimonioDescartado: number;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export async function gerarRelatorioMensal(
  mes: number,
  ano: number
): Promise<RelatorioMensal> {
  // Build date range for the given month
  const dataInicio = new Date(ano, mes - 1, 1).toISOString();
  const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

  // Use allSettled so a single failing query does not crash the entire report
  const [fleetAllResult, fleetNewResult, occurrencesResult, purchasesResult] =
    await Promise.allSettled([
      supabase
        .from('fleet')
        .select('id, type, status, current_km'),

      supabase
        .from('fleet')
        .select('id, type, status')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim),

      supabase
        .from('occurrences')
        .select('id, occurrence_type, units_involved')
        .gte('occurrence_date', dataInicio)
        .lte('occurrence_date', dataFim),

      supabase
        .from('purchases')
        .select('id, item, quantity, unit_price, status')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim),
    ]);

  // Resolve each result individually — fall back to empty array on failure
  const resolveQuery = <T>(
    result: PromiseSettledResult<{ data: T[] | null; error: unknown }>,
    label: string
  ): T[] => {
    if (result.status === 'rejected') {
      console.warn(`[B4 Relatório] Falha na query "${label}":`, result.reason);
      return [];
    }
    if (result.value.error) {
      console.warn(`[B4 Relatório] Erro na query "${label}":`, result.value.error);
      return [];
    }
    return result.value.data || [];
  };

  const allFleet = resolveQuery(fleetAllResult, 'fleet-all');
  const newFleet = resolveQuery(fleetNewResult, 'fleet-new');
  const allOccurrences = resolveQuery(occurrencesResult, 'occurrences');
  const allPurchases = resolveQuery(purchasesResult, 'purchases');

  const viaturas = allFleet.filter((f: any) => f.type === 'Viatura');
  const viaturasOp = viaturas.filter((v: any) => v.status === 'active');
  const viaturasMan = viaturas.filter((v: any) => v.status === 'maintenance');

  const custoCompras = allPurchases.reduce((acc: number, p: any) => {
    const unitPrice = typeof p.unit_price === 'number' ? p.unit_price : parseFloat(p.unit_price) || 0;
    const quantity = typeof p.quantity === 'number' ? p.quantity : parseInt(p.quantity, 10) || 1;
    return acc + (unitPrice * quantity);
  }, 0);

  const totalKm = viaturas.reduce(
    (acc: number, v: any) => acc + (v.current_km || 0), 0
  );

  return {
    mes,
    ano,
    titulo: `Relatório B4 — ${MESES[mes - 1]}/${ano}`,
    totalPatrimonio: allFleet.length,
    totalViaturas: viaturas.length,
    viaturasOperacionais: viaturasOp.length,
    viaturasManutencao: viaturasMan.length,
    totalManutencoes: allPurchases.filter((p: any) => p.status === 'Aprovado').length,
    custoManutencoes: custoCompras,
    totalCombustivel: 0,
    custoCombustivel: 0,
    ocorrenciasAtendidas: allOccurrences.length,
    kmRodados: totalKm,
    patrimonioNovo: newFleet.length,
    patrimonioDescartado: allFleet.filter((f: any) => f.status === 'down').length,
  };
}

export async function salvarRelatorio(
  relatorio: RelatorioMensal
): Promise<any> {
  const { data, error } = await supabase
    .from('b4_relatorios')
    .upsert({
      mes: relatorio.mes,
      ano: relatorio.ano,
      tipo: 'mensal',
      titulo: relatorio.titulo,
      dados: relatorio,
      gerado_por: 'Administrador B4',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mes,ano,tipo' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface RelatorioSalvo {
  id: string;
  mes: number;
  ano: number;
  tipo: string;
  titulo: string;
  dados: RelatorioMensal;
  gerado_por: string;
  created_at: string;
  updated_at: string;
}

export async function listarRelatorios(): Promise<RelatorioSalvo[]> {
  const { data, error } = await supabase
    .from('b4_relatorios')
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false });

  if (error) throw error;
  return (data as RelatorioSalvo[]) || [];
}

export interface InventarioItem {
  id: string;
  nome: string;
  tomboPatrimonio: string; // placa ou patrimonio_number
  tipo: 'Viatura' | 'Equipamento' | 'Material';
  localViatura: string; // Nome da viatura (se alocado) ou local físico
  compartimento?: string; // Nome do compartimento (se alocado)
  viaturaNome?: string; // Nome da viatura que abriga o compartimento
  quantidade: number;
  estadoConservacao: string; // 'Ativo', 'Emprestado (Cautela)', 'Em Manutenção', 'Inativo/Baixado'
  isEmprestado: boolean;
  statusAlerta: 'normal' | 'manutencao' | 'vencido' | 'baixado' | 'emprestado';
  atividades: string[]; // Atividades operacionais de atuação (ex: Combate a Incêndio, APH, etc)
  detalhes?: string;
  cautelaInfo?: {
    solicitante?: string;
    numeroCautela?: string;
    dataRetirada?: string;
    previsaoDevolucao?: string;
  };
}

export async function buscarInventarioConsolidado(
  localFiltro: string = 'todos',
  atividadeFiltro: string = 'todos'
): Promise<InventarioItem[]> {
  const [fleetRes, cautelasRes, compartimentosRes, locaisRes] = await Promise.allSettled([
    supabase.from('fleet').select('*'),
    supabase.from('cautelas').select('*').eq('status', 'ativo'),
    supabase.from('compartimentos_viatura').select('*'),
    supabase.from('locais_equipamento').select('*')
  ]);

  const fleetData: any[] = fleetRes.status === 'fulfilled' && fleetRes.value.data ? fleetRes.value.data : [];
  const cautelasAtivas: any[] = cautelasRes.status === 'fulfilled' && cautelasRes.value.data ? cautelasRes.value.data : [];
  const compartimentos: any[] = compartimentosRes.status === 'fulfilled' && compartimentosRes.value.data ? compartimentosRes.value.data : [];
  const locais: any[] = locaisRes.status === 'fulfilled' && locaisRes.value.data ? locaisRes.value.data : [];

  // Mapeamentos rápidos para O(1)
  const mapCompartimentos = new Map<string, any>();
  compartimentos.forEach(c => {
    if (c.id) mapCompartimentos.set(c.id, c);
  });

  const mapLocais = new Map<string, any>();
  locais.forEach(l => {
    if (l.id) mapLocais.set(l.id, l);
  });

  // Mapeamento de viaturas da frota por ID e por nome
  const mapViaturas = new Map<string, any>();
  fleetData.forEach(item => {
    if (item.type === 'Viatura' || item.type === 'viatura') {
      if (item.id) mapViaturas.set(item.id, item);
      if (item.name) mapViaturas.set(item.name.toLowerCase().trim(), item);
    }
  });

  // Mapa de cautelas ativas por item_id e por item_nome
  const mapCautelasPorItemId = new Map<string, any>();
  const mapCautelasPorItemNome = new Map<string, any>();
  cautelasAtivas.forEach(c => {
    if (c.item_id) mapCautelasPorItemId.set(c.item_id, c);
    if (c.item_nome) mapCautelasPorItemNome.set(c.item_nome.toLowerCase().trim(), c);
  });

  const inventario: InventarioItem[] = fleetData.map((item: any) => {
    // Tipo canônico
    let tipo: 'Viatura' | 'Equipamento' | 'Material' = 'Material';
    const rawType = (item.type || '').toLowerCase();
    if (rawType.includes('viatura')) {
      tipo = 'Viatura';
    } else if (rawType.includes('equipamento')) {
      tipo = 'Equipamento';
    } else {
      tipo = 'Material';
    }

    // Identificação de Placa ou Patrimônio
    const tomboPatrimonio = (item.plate || item.patrimonio_number || item.patrimonio || '').trim() || 'N/A';

    // Resolver Compartimento e Viatura se estiver alocado em compartimento
    let nomeCompartimento = '';
    let nomeViatura = '';
    let localFinal = '';

    if (item.compartimento_id && mapCompartimentos.has(item.compartimento_id)) {
      const comp = mapCompartimentos.get(item.compartimento_id);
      nomeCompartimento = comp.nome || comp.name || '';
      if (comp.viatura_id && mapViaturas.has(comp.viatura_id)) {
        nomeViatura = mapViaturas.get(comp.viatura_id).name || '';
      }
    }

    // Se tiver viatura_id direta
    if (!nomeViatura && item.viatura_id && mapViaturas.has(item.viatura_id)) {
      nomeViatura = mapViaturas.get(item.viatura_id).name || '';
    }

    // Resolver local físico se não estiver em compartimento ou viatura
    if (nomeViatura) {
      localFinal = nomeViatura;
    } else if (item.local_id && mapLocais.has(item.local_id)) {
      localFinal = mapLocais.get(item.local_id).nome || '';
    } else if (item.location) {
      localFinal = item.location;
    } else if (tipo === 'Viatura') {
      localFinal = 'Garagem / Pátio';
    } else {
      localFinal = 'Almoxarifado / Reserva';
    }

    // Verificar se o item está emprestado/cautelado
    const cautelaAtiva =
      mapCautelasPorItemId.get(item.id) ||
      (item.name ? mapCautelasPorItemNome.get(item.name.toLowerCase().trim()) : null);

    const isEmprestado = Boolean(
      item.status === 'cautelado' ||
      item.is_cautelado === true ||
      cautelaAtiva
    );

    // Estado de conservação e alertas
    const isManutencao = item.status === 'maintenance' || item.status === 'manutencao';
    const isBaixado = item.status === 'down' || item.status === 'inativo';

    let estadoConservacao = 'Ativo';
    let statusAlerta: InventarioItem['statusAlerta'] = 'normal';

    if (isEmprestado) {
      estadoConservacao = 'Emprestado';
      statusAlerta = 'emprestado';
    } else if (isManutencao) {
      estadoConservacao = 'Em Manutenção';
      statusAlerta = 'manutencao';
    } else if (isBaixado) {
      estadoConservacao = 'Inativo/Baixado';
      statusAlerta = 'baixado';
    } else {
      estadoConservacao = 'Ativo';
      statusAlerta = 'normal';
    }

    // Atividades (array de strings)
    const atividades: string[] = Array.isArray(item.atividades)
      ? item.atividades
      : typeof item.atividades === 'string' && item.atividades.trim().length > 0
        ? [item.atividades]
        : [];

    // Quantidade real
    const rawQtd = Number(item.quantidade);
    const quantidade = !isNaN(rawQtd) && rawQtd > 0 ? rawQtd : 1;

    // Detalhes extras
    const detalhes = [
      item.brand,
      item.model,
      item.year,
      item.details
    ].filter(Boolean).join(' ').trim();

    return {
      id: item.id || `item-${Math.random()}`,
      nome: item.name || 'Sem Descrição',
      tomboPatrimonio,
      tipo,
      localViatura: localFinal,
      compartimento: nomeCompartimento || undefined,
      viaturaNome: nomeViatura || undefined,
      quantidade,
      estadoConservacao,
      isEmprestado,
      statusAlerta,
      atividades,
      detalhes: detalhes || undefined,
      cautelaInfo: cautelaAtiva ? {
        solicitante: cautelaAtiva.solicitante || cautelaAtiva.retirado_por,
        numeroCautela: cautelaAtiva.numero_cautela,
        dataRetirada: cautelaAtiva.data_retirada,
        previsaoDevolucao: cautelaAtiva.data_prevista_devolucao
      } : undefined
    };
  });

  // Filtros combinados
  return inventario.filter(item => {
    // 1. Filtro de Local / Viatura
    if (localFiltro && localFiltro !== 'todos') {
      const matchLocal = item.localViatura.toLowerCase().includes(localFiltro.toLowerCase()) ||
        (item.compartimento && item.compartimento.toLowerCase().includes(localFiltro.toLowerCase())) ||
        (item.viaturaNome && item.viaturaNome.toLowerCase().includes(localFiltro.toLowerCase()));
      if (!matchLocal) return false;
    }

    // 2. Filtro de Atividade
    if (atividadeFiltro && atividadeFiltro !== 'todos') {
      const matchAtividade = item.atividades.some(
        atv => atv.toLowerCase().trim() === atividadeFiltro.toLowerCase().trim()
      );
      if (!matchAtividade) return false;
    }

    return true;
  });
}

export interface ItemMissaoInstrucaoGuarnicao {
  id: string;
  tipo: 'missao' | 'instrucao';
  titulo: string;
  data: string;
  horario?: string;
  guarnicao: string;
  status: string;
  responsavelOuInstrutor?: string;
  detalhes?: string;
}

export async function buscarMissoesEInstrucoesGuarnicao(
  mes: number,
  ano: number,
  guarnicaoFiltro: string = 'todos'
): Promise<ItemMissaoInstrucaoGuarnicao[]> {
  const padMonth = String(mes).padStart(2, '0');
  const inicioMes = `${ano}-${padMonth}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes = `${ano}-${padMonth}-${String(ultimoDia).padStart(2, '0')}`;

  const [missoesRes, instrucoesRes, materiasRes, escalasRes] = await Promise.allSettled([
    supabase
      .from('daily_missions')
      .select('*')
      .gte('mission_date', inicioMes)
      .lte('mission_date', fimMes),

    supabase
      .from('training_schedule')
      .select('*')
      .gte('date', inicioMes)
      .lte('date', fimMes),

    supabase
      .from('materias_instrucao')
      .select('*'),

    supabase
      .from('escalas')
      .select('*')
      .gte('data', inicioMes)
      .lte('data', fimMes)
  ]);

  const missoesData = missoesRes.status === 'fulfilled' && missoesRes.value.data ? missoesRes.value.data : [];
  const instrucoesData = instrucoesRes.status === 'fulfilled' && instrucoesRes.value.data ? instrucoesRes.value.data : [];
  const materiasData = materiasRes.status === 'fulfilled' && materiasRes.value.data ? materiasRes.value.data : [];
  const escalasData = escalasRes.status === 'fulfilled' && escalasRes.value.data ? escalasRes.value.data : [];

  // Mapeamento de data (YYYY-MM-DD) -> Guarnição/Equipe (ex: "Alfa", "Bravo")
  const escalaMap: Record<string, string> = {};
  escalasData.forEach((esc: any) => {
    if (esc.data && (esc.equipe || esc.turma)) {
      escalaMap[esc.data] = esc.equipe || esc.turma;
    }
  });

  // Data âncora para cálculo do ciclo de 24x72 caso a escala não esteja publicada no banco
  // Ex: 2026-03-01 foi Guarnição Alfa (A)
  const anchorUtc = Date.UTC(2026, 2, 1);
  const codigos = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

  const getGuarnicaoDoDia = (dataStr: string): string => {
    if (escalaMap[dataStr]) return escalaMap[dataStr];
    const [y, m, d] = dataStr.split('-').map(Number);
    if (!y || !m || !d) return 'Não Escalada';
    const targetUtc = Date.UTC(y, m - 1, d);
    const diffDays = Math.floor((targetUtc - anchorUtc) / (1000 * 60 * 60 * 24));
    const idx = ((diffDays % 4) + 4) % 4;
    return `Guarnição ${codigos[idx]}`;
  };

  const resultado: ItemMissaoInstrucaoGuarnicao[] = [];

  // 1. Mapear Missões Diárias
  missoesData.forEach((m: any) => {
    const guarnicaoDia = getGuarnicaoDoDia(m.mission_date);
    resultado.push({
      id: m.id || `m-${Math.random()}`,
      tipo: 'missao',
      titulo: m.title || 'Missão Operacional',
      data: m.mission_date,
      horario: m.start_time ? `${m.start_time}${m.end_time ? ' - ' + m.end_time : ''}` : undefined,
      guarnicao: guarnicaoDia,
      status: m.status === 'concluida' ? 'Concluída' : m.status === 'em_andamento' ? 'Em Andamento' : m.status || 'Agendada',
      responsavelOuInstrutor: m.responsible_name || m.chefe_socorro_nome || m.created_by || 'N/A',
      detalhes: m.description || m.observacoes || ''
    });
  });

  // 2. Mapear Instruções / Treinamentos
  instrucoesData.forEach((t: any) => {
    const materia = materiasData.find((mat: any) => mat.id === t.materia_id);
    const guarnicaoDia = getGuarnicaoDoDia(t.date);
    const statusInstrucao = t.status === 'Completed' || t.status === 'Concluído' ? 'Concluída' : t.status === 'Canceled' || t.status === 'Cancelado' ? 'Cancelada' : 'Agendada/Realizada';

    resultado.push({
      id: t.id || `t-${Math.random()}`,
      tipo: 'instrucao',
      titulo: materia?.name || t.tema || 'Instrução B3',
      data: t.date,
      horario: t.time ? `${t.time}${t.end_time ? ' - ' + t.end_time : ''}` : undefined,
      guarnicao: guarnicaoDia,
      status: statusInstrucao,
      responsavelOuInstrutor: t.instructor || materia?.instructor || 'N/A',
      detalhes: materia?.description || t.location ? `Local: ${t.location}` : ''
    });
  });

  // Ordenar por data (decrescente) e tipo
  resultado.sort((a, b) => b.data.localeCompare(a.data));

  if (guarnicaoFiltro && guarnicaoFiltro !== 'todos') {
    const term = guarnicaoFiltro.toLowerCase().replace('guarnição', '').replace('turma', '').trim();
    return resultado.filter(item => {
      const gNorm = item.guarnicao.toLowerCase();
      if (term === 'alfa' || term === 'a') return gNorm.includes('alfa') || gNorm.includes('turma a') || gNorm.includes('equipe a') || gNorm.endsWith(' a');
      if (term === 'bravo' || term === 'b') return gNorm.includes('bravo') || gNorm.includes('turma b') || gNorm.includes('equipe b') || gNorm.endsWith(' b');
      if (term === 'charlie' || term === 'c') return gNorm.includes('charlie') || gNorm.includes('turma c') || gNorm.includes('equipe c') || gNorm.endsWith(' c');
      if (term === 'delta' || term === 'd') return gNorm.includes('delta') || gNorm.includes('turma d') || gNorm.includes('equipe d') || gNorm.endsWith(' d');
      return gNorm.includes(term);
    });
  }

  return resultado;
}


