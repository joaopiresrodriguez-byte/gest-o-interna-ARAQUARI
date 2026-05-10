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

  // Fetch all data concurrently from real tables
  const [
    fleetAll,
    fleetNew,
    occurrences,
    purchases
  ] = await Promise.all([
    // All fleet items (current state)
    supabase
      .from('fleet')
      .select('id, type, status, current_km'),

    // Fleet items created in the given month
    supabase
      .from('fleet')
      .select('id, type, status')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim),

    // Occurrences in the given month
    supabase
      .from('occurrences')
      .select('id, occurrence_type, units_involved')
      .gte('occurrence_date', dataInicio)
      .lte('occurrence_date', dataFim),

    // Purchases in the given month
    supabase
      .from('purchases')
      .select('id, item, quantity, unit_price, status')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim),
  ]);

  const allFleet = fleetAll.data || [];
  const newFleet = fleetNew.data || [];
  const allOccurrences = occurrences.data || [];
  const allPurchases = purchases.data || [];

  const viaturas = allFleet.filter((f: any) => f.type === 'Viatura');
  const viaturasOp = viaturas.filter((v: any) => v.status === 'active');
  const viaturasMan = viaturas.filter((v: any) => v.status === 'maintenance');

  // Calculate purchase costs
  const custoCompras = allPurchases.reduce(
    (acc: number, p: any) => acc + ((p.unit_price || 0) * (p.quantity || 1)), 0
  );

  // Calculate total KM from fleet
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
