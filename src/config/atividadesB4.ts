/**
 * Lista canônica de atividades operacionais do B4.
 * Usada em: PatrimonioB4, ModalEditarItemB4, PessoalB1
 */
export const ATIVIDADES_B4 = [
  'Incêndio Urbano',
  'Incêndio Florestal',
  'Salvamento Terrestre',
  'Salvamento em Altura',
  'Salvamento Aquático',
  'APH',
  'Produtos Perigosos',
  'Corte de Árvore',
  'Defesa Civil',
  'Administrativo',
  'TI',
  'Viaturas administrativas',
  'Viaturas operacionais',
  'Produtos de limpeza',
  'SPCI',
  'Motomecanizado',
] as const;

export type AtividadeB4 = typeof ATIVIDADES_B4[number];
