/**
 * Lista canônica de atividades operacionais do B4.
 * Usada em: PatrimonioB4, ModalEditarItemB4, PessoalB1, RelatoriosMensais
 *
 * Atualizada em: 2026-11-19 — Alinhada à estrutura operacional oficial.
 */
export const ATIVIDADES_B4 = [
  'APH',
  'Combate a Incêndio Urbano',
  'Combate a Incêndio Florestal',
  'Resgate Veicular',
  'Salvamento Aquático',
  'Equipamentos de Mergulho',
  'Manejo de Animais e Insetos',
  'Busca Terrestre',
  'Salvamento em Altura',
  'Corte de Árvore',
  'Equipamentos de Informática / Smartphones',
  'Viaturas Operacionais',
  'Viaturas Administrativas',
  'Motomecanizados',
  'Patrimônio',
] as const;

export type AtividadeB4 = typeof ATIVIDADES_B4[number];

/**
 * Metadados visuais por atividade: emoji, cor de badge e ícone Material Symbols.
 * Use `getAtividadeMeta(atividade)` para obter os metadados com fallback seguro.
 */
export const ATIVIDADES_META: Record<AtividadeB4, { emoji: string; color: string; icon: string }> = {
  'APH':                                  { emoji: '🏥', color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: 'emergency' },
  'Combate a Incêndio Urbano':            { emoji: '🔥', color: 'bg-red-100 text-red-700 border-red-200',          icon: 'local_fire_department' },
  'Combate a Incêndio Florestal':         { emoji: '🌲', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: 'forest' },
  'Resgate Veicular':                     { emoji: '🚗', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'car_crash' },
  'Salvamento Aquático':                  { emoji: '🌊', color: 'bg-cyan-100 text-cyan-700 border-cyan-200',       icon: 'pool' },
  'Equipamentos de Mergulho':             { emoji: '🤿', color: 'bg-teal-100 text-teal-700 border-teal-200',       icon: 'scuba_diving' },
  'Manejo de Animais e Insetos':          { emoji: '🐍', color: 'bg-lime-100 text-lime-700 border-lime-200',       icon: 'pest_control' },
  'Busca Terrestre':                      { emoji: '🔍', color: 'bg-stone-100 text-stone-700 border-stone-200',    icon: 'search' },
  'Salvamento em Altura':                 { emoji: '⛰️', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'hiking' },
  'Corte de Árvore':                      { emoji: '🪚', color: 'bg-green-100 text-green-700 border-green-200',    icon: 'carpenter' },
  'Equipamentos de Informática / Smartphones': { emoji: '💻', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'computer' },
  'Viaturas Operacionais':               { emoji: '🚒', color: 'bg-rose-100 text-rose-700 border-rose-200',       icon: 'fire_truck' },
  'Viaturas Administrativas':            { emoji: '🚙', color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: 'directions_car' },
  'Motomecanizados':                     { emoji: '🏍️', color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: 'two_wheeler' },
  'Patrimônio':                          { emoji: '🏛️', color: 'bg-zinc-100 text-zinc-700 border-zinc-200',       icon: 'account_balance' },
};

/** Retorna metadados com fallback seguro para atividades desconhecidas */
export function getAtividadeMeta(atividade: string): { emoji: string; color: string; icon: string } {
  return (ATIVIDADES_META as Record<string, { emoji: string; color: string; icon: string }>)[atividade]
    ?? { emoji: '🎯', color: 'bg-stone-100 text-stone-600 border-stone-200', icon: 'category' };
}
