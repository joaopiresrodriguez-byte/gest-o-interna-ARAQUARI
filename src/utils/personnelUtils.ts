import { Personnel } from '../services/types';

export const RANKS_BM_ORDER = ['Sd', 'Cb', '3º Sgt', '2º Sgt', '1º Sgt', 'Sub Ten', 'Asp Of', '2º Ten', '1º Ten', 'Cap', 'Maj', 'Ten Cel', 'Cel'];

// Mapa de posição hierárquica (0 = Cel [mais antigo], 12 = Sd [menos graduado])
export const RANK_ORDEM_MAP: Record<string, number> = Object.fromEntries(
  [...RANKS_BM_ORDER].reverse().map((r, i) => [r, i])
);

export function normalizeGraduation(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/(\d+)[°º]\s*Sgt/i, '$1º Sgt');
}

/**
 * Retorna true se for Bombeiro Comunitário (BC).
 * Exclui BCs que possuem bc_graduacao_ordem preenchida ou identificação de BC.
 */
export function isMilitarRegular(p: Personnel): boolean {
  if (typeof p.bc_graduacao_ordem === 'number' && p.bc_graduacao_ordem > 0) {
    return false;
  }
  const text = (p.graduation || p.rank || '').toString();
  if (text.match(/(\d+)[°º]?\s*Grau/i)) {
    return false;
  }
  if (p.type === 'BC' || text.toUpperCase().includes('BC') || text.toUpperCase().includes('COMUNITÁRIO')) {
    return false;
  }
  return true;
}

/**
 * Filtra apenas militares regulares (exclui BCs) e os ordena por graduação hierárquica e nome.
 */
export function getMilitaresRegularesOrdenados(personnelList: Personnel[]): Personnel[] {
  return personnelList
    .filter(isMilitarRegular)
    .sort((a, b) => {
      const gradA = normalizeGraduation(a.graduation || a.rank);
      const gradB = normalizeGraduation(b.graduation || b.rank);
      const rankA = RANK_ORDEM_MAP[gradA] ?? 999;
      const rankB = RANK_ORDEM_MAP[gradB] ?? 999;
      if (rankA !== rankB) return rankA - rankB;

      const dateA = a.data_ultima_promocao ? new Date(a.data_ultima_promocao + 'T00:00:00').getTime() : Infinity;
      const dateB = b.data_ultima_promocao ? new Date(b.data_ultima_promocao + 'T00:00:00').getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;

      const incA = a.data_inclusao ? new Date(a.data_inclusao + 'T00:00:00').getTime() : Infinity;
      const incB = b.data_inclusao ? new Date(b.data_inclusao + 'T00:00:00').getTime() : Infinity;
      if (incA !== incB) return incA - incB;

      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
}
