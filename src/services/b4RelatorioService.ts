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
  tomboPatrimonio: string;
  tipo: 'Viatura' | 'Compartimento' | 'Equipamento/Material';
  localViatura: string;
  compartimento?: string;
  quantidade: number;
  estadoConservacao: string; // 'Bom' | 'Manutenção' | 'Baixado' | 'Vencido'
  statusAlerta: 'normal' | 'manutencao' | 'vencido' | 'baixado';
  detalhes?: string;
}

export async function buscarInventarioConsolidado(localFiltro: string = 'todos'): Promise<InventarioItem[]> {
  const [fleetRes, b4VehiclesRes, compViatsRes, b4CompRes, locaisEquipRes, chkItensRes] = await Promise.allSettled([
    supabase.from('fleet').select('*'),
    supabase.from('b4_vehicles').select('*'),
    supabase.from('compartimentos_viatura').select('*'),
    supabase.from('b4_compartimentos_viaturas').select('*'),
    supabase.from('b4_locais_equipamentos').select('*'),
    supabase.from('checklist_itens').select('*')
  ]);

  const fleetData = fleetRes.status === 'fulfilled' && fleetRes.value.data ? fleetRes.value.data : [];
  const b4VehiclesData = b4VehiclesRes.status === 'fulfilled' && b4VehiclesRes.value.data ? b4VehiclesRes.value.data : [];
  const vehicles = fleetData.length > 0 ? fleetData : b4VehiclesData;

  const compData = compViatsRes.status === 'fulfilled' && compViatsRes.value.data ? compViatsRes.value.data : [];
  const b4CompData = b4CompRes.status === 'fulfilled' && b4CompRes.value.data ? b4CompRes.value.data : [];
  const compartimentos = compData.length > 0 ? compData : b4CompData;

  const locaisEquip = locaisEquipRes.status === 'fulfilled' && locaisEquipRes.value.data ? locaisEquipRes.value.data : [];
  const checklistItens = chkItensRes.status === 'fulfilled' && chkItensRes.value.data ? chkItensRes.value.data : [];

  const inventario: InventarioItem[] = [];

  // 1. Bens e Viaturas da Tabela `fleet`
  vehicles.forEach((v: any) => {
    const isViatura = v.type === 'Viatura' || v.type === 'viatura';
    const isManutencao = v.status === 'maintenance' || v.status === 'manutencao';
    const isBaixado = v.status === 'down' || v.status === 'inativo';
    
    inventario.push({
      id: v.id || `vtr-${Math.random()}`,
      nome: v.name || 'Item de Patrimônio',
      tomboPatrimonio: v.plate || v.patrimonio || v.id || 'N/A',
      tipo: isViatura ? 'Viatura' : 'Equipamento/Material',
      localViatura: v.location || 'Garagem / Pátio',
      quantidade: 1,
      estadoConservacao: isManutencao ? 'Em Manutenção' : isBaixado ? 'Inativo/Baixado' : 'Operacional/Bom',
      statusAlerta: isManutencao ? 'manutencao' : isBaixado ? 'baixado' : 'normal',
      detalhes: `${v.brand || ''} ${v.model || ''} ${v.year || ''} ${v.details || ''}`.trim()
    });
  });

  // 2. Compartimentos de Viaturas
  compartimentos.forEach((c: any) => {
    const vtr = vehicles.find((v: any) => v.id === c.viatura_id);
    inventario.push({
      id: c.id || `comp-${Math.random()}`,
      nome: c.nome || c.name || 'Compartimento',
      tomboPatrimonio: `COMP-${c.ordem || 1}`,
      tipo: 'Compartimento',
      localViatura: vtr ? vtr.name : 'Viatura Não Identificada',
      compartimento: c.nome || c.name,
      quantidade: 1,
      estadoConservacao: 'Alocado',
      statusAlerta: 'normal',
      detalhes: c.descricao || 'Módulo de armazenamento interno'
    });
  });

  // 3. Equipamentos de Locais Físicos
  locaisEquip.forEach((e: any) => {
    const isManutencao = e.estado === 'Manutenção' || e.estado === 'manutencao';
    const isBaixado = e.estado === 'Descarte' || e.estado === 'baixado';
    inventario.push({
      id: e.id || `eq-${Math.random()}`,
      nome: e.nome || 'Equipamento',
      tomboPatrimonio: e.patrimonio || 'Sem Tombo',
      tipo: 'Equipamento/Material',
      localViatura: e.local_id || 'Reserva de Materiais',
      quantidade: e.quantidade || 1,
      estadoConservacao: e.estado || 'Bom',
      statusAlerta: isManutencao ? 'manutencao' : isBaixado ? 'baixado' : 'normal',
      detalhes: e.observacoes || ''
    });
  });

  // 4. Checklist Itens vinculados a compartimentos
  checklistItens.forEach((ci: any) => {
    const comp = compartimentos.find((c: any) => c.id === ci.compartimento_id);
    const vtr = comp ? vehicles.find((v: any) => v.id === comp.viatura_id) : null;
    const isVencido = ci.validade && new Date(ci.validade) < new Date();
    const isManutencao = ci.estado === 'Danificado' || ci.estado === 'Faltando';

    inventario.push({
      id: ci.id || `chk-${Math.random()}`,
      nome: ci.nome || ci.item_name || 'Item de Conferência',
      tomboPatrimonio: ci.tombo || ci.patrimonio || 'N/A',
      tipo: 'Equipamento/Material',
      localViatura: vtr ? vtr.name : 'Prontidão Operacional',
      compartimento: comp ? (comp.nome || comp.name) : 'Sem Compartimento',
      quantidade: ci.quantidade || 1,
      estadoConservacao: isVencido ? 'VENCIDO' : (ci.estado || 'Bom'),
      statusAlerta: isVencido ? 'vencido' : isManutencao ? 'manutencao' : 'normal',
      detalhes: ci.observacao || ci.detalhes || ''
    });
  });

  // Aplicar filtro por Local / Viatura se especificado
  if (localFiltro && localFiltro !== 'todos') {
    return inventario.filter(i =>
      i.localViatura.toLowerCase().includes(localFiltro.toLowerCase()) ||
      (i.compartimento && i.compartimento.toLowerCase().includes(localFiltro.toLowerCase()))
    );
  }

  return inventario;
}

