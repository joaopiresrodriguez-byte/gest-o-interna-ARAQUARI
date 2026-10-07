# design-polish — Plano de Implementação

## Goal
Aplicar as 3 fases do roadmap de melhorias de design/UX sem quebrar nenhuma funcionalidade existente.

## FASE 1 — Fundação
- [ ] T1: index.css — unificar tokens de cor duplicados
- [ ] T2: index.css — escala tipográfica semântica
- [ ] T3: index.css — tokens de spacing (múltiplos de 4px)
- [ ] T4: index.css — focus-visible global
- [ ] T5: Button.tsx — focus-visible + duration explícita
- [ ] T6: Input.tsx — corrigir contraste de labels

## FASE 2 — Experiência
- [ ] T7: index.css — keyframes fadeInUp, fadeIn, shimmer
- [ ] T8: Criar Skeleton.tsx
- [ ] T9: Criar EmptyState.tsx
- [ ] T10: ui/index.ts — exportar Skeleton e EmptyState
- [ ] T11: App.tsx — módulo ativo no header mobile
- [ ] T12: App.tsx — animate-page-in no conteúdo

## FASE 3 — Polimento
- [ ] T13: index.css — microinterações hover-lift, hover-glow
- [ ] T14: index.html — adicionar Inter como fonte institucional
- [ ] T15: index.css — atualizar --font-display para Inter
- [ ] T16: index.css — text-micro mínimo 11px

## Done When
- [ ] npm run build passa sem erros
- [ ] Nenhum componente existente quebra
- [ ] Animações visíveis ao navegar
- [ ] Focus ring visível com Tab
- [ ] Git push com sucesso
