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

  const custoCompras = allPurchases.reduce(
    (acc: number, p: any) => acc + ((p.unit_price || 0) * (p.quantity || 1)), 0
  );

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
