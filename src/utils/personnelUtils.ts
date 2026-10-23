import { Personnel } from '../services/types';

export const RANKS_BM_ORDER = ['Sd', 'Cb', '3º Sgt', '2º Sgt', '1º Sgt', 'Sub Ten', 'Asp Of', '2º Ten', '1º Ten', 'Cap', 'Maj', 'Ten Cel', 'Cel'];

// Mapa de posição hierárquica oficial (0 = Cel [mais antigo], 12 = Sd [menos graduado])
export const RANK_ORDEM_MAP: Record<string, number> = Object.fromEntries(
  [...RANKS_BM_ORDER].reverse().map((r, i) => [r, i])
);

/**
 * Normaliza qualquer formato de posto/graduação para o padrão abreviado (ex: "1º Sgt BM" -> "1º Sgt")
 */
export function normalizeGraduation(val?: string): string {
  if (!val) return '';
  let clean = val.trim();
  // Remove "BM" no final se houver
  clean = clean.replace(/\s*BM$/i, '').trim();
  // Padroniza 1o/1° Sgt
  clean = clean.replace(/(\d+)[°º]\s*Sgt/i, '$1º Sgt');
  clean = clean.replace(/Sub\s*-?\s*Ten/i, 'Sub Ten');
  clean = clean.replace(/Ten\s*-?\s*Cel/i, 'Ten Cel');
  clean = clean.replace(/Asp(\s*Of)?/i, 'Asp Of');
  return clean;
}

/**
 * Retorna o peso hierárquico do militar (quanto menor, mais antigo na hierarquia).
 * Cel = 0, ..., Sd = 12, Bombeiro Comunitário = 100+ (pela ordem do grau), Outros = 999
 */
export function getHierarchicalRankScore(p: Partial<Personnel>): number {
  if (typeof p.bc_graduacao_ordem === 'number' && p.bc_graduacao_ordem > 0) {
    return 100 + p.bc_graduacao_ordem;
  }
  const text = (p.graduation || p.rank || '').toString();
  const bcMatch = text.match(/(\d+)[°º]?\s*Grau/i);
  if (bcMatch) {
    return 100 + (parseInt(bcMatch[1], 10) || 50);
  }
  if (p.type === 'BC' || text.toUpperCase().includes('BC') || text.toUpperCase().includes('COMUNITÁRIO')) {
    return 200;
  }

  const normalized = normalizeGraduation(text);
  if (RANK_ORDEM_MAP[normalized] !== undefined) {
    return RANK_ORDEM_MAP[normalized];
  }

  // Tentar casamento parcial
  for (const [rank, score] of Object.entries(RANK_ORDEM_MAP)) {
    if (normalized.toLowerCase() === rank.toLowerCase()) return score;
  }

  return 999;
}

/**
 * Formata o militar no padrão oficial do CBMSC:
 * [Posto/Graduação] [Nome de Guerra] (ou Nome Completo se não houver nome de guerra)
 */
export function formatPersonnelMilitaryName(p: Partial<Personnel>): string {
  const grad = normalizeGraduation(p.graduation || p.rank);
  const nameToUse = (p.war_name && p.war_name.trim().length > 0) ? p.war_name.trim() : (p.name || '').trim();
  if (!grad) return nameToUse;
  return `${grad} ${nameToUse}`.trim();
}

/**
 * Retorna true se for Bombeiro Militar regular (exclui Bombeiros Comunitários).
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
 * Ordena uma lista qualquer de pessoal pela antiguidade de posto/graduação:
 * 1. Posto/Graduação (Hierarquia militar: Cel -> Sd -> BCs)
 * 2. Data da última promoção (mais antiga primeiro)
 * 3. Data de inclusão (mais antiga primeiro)
 * 4. Ordem alfabética pelo nome de guerra / nome
 */
export function sortPersonnelBySeniority<T extends Partial<Personnel>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const scoreA = getHierarchicalRankScore(a);
    const scoreB = getHierarchicalRankScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;

    const dateA = a.data_ultima_promocao ? new Date(a.data_ultima_promocao + 'T00:00:00').getTime() : Infinity;
    const dateB = b.data_ultima_promocao ? new Date(b.data_ultima_promocao + 'T00:00:00').getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;

    const incA = a.data_inclusao ? new Date(a.data_inclusao + 'T00:00:00').getTime() : Infinity;
    const incB = b.data_inclusao ? new Date(b.data_inclusao + 'T00:00:00').getTime() : Infinity;
    if (incA !== incB) return incA - incB;

    const nameA = a.war_name || a.name || '';
    const nameB = b.war_name || b.name || '';
    return nameA.localeCompare(nameB, 'pt-BR');
  });
}

/**
 * Filtra apenas militares regulares (exclui BCs) e os ordena por graduação hierárquica e antiguidade.
 */
export function getMilitaresRegularesOrdenados(personnelList: Personnel[]): Personnel[] {
  return sortPersonnelBySeniority(personnelList.filter(isMilitarRegular));
}
