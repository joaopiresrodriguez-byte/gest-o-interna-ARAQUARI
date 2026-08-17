-- ==============================================================================
-- MIGRAÇÃO SQL: ATIVIDADE OPERACIONAL 'CORTE DE ÁRVORE' NO MÓDULO B4
-- ==============================================================================

-- 1. Documentar e garantir a coluna atividades na tabela fleet (Patrimônio e Logística)
ALTER TABLE IF EXISTS public.fleet ADD COLUMN IF NOT EXISTS atividades TEXT[] DEFAULT '{}';

-- 2. Atualizar o comentário da coluna informando a inclusão de 'Corte de Árvore'
COMMENT ON COLUMN public.fleet.atividades IS 'Lista de atividades operacionais associadas ao item de patrimônio B4 (ex: Incêndio Urbano, Incêndio Florestal, Salvamento Terrestre, Salvamento em Altura, Salvamento Aquático, APH, Produtos Perigosos, Corte de Árvore, Defesa Civil, Administrativo)';
