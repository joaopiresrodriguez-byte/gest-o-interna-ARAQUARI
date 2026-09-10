-- ====================================================================
-- MIGRAÇÃO: LIMPEZA DE TABELAS LEGADO OBSOLETAS E VAZIAS
-- ====================================================================
-- As tabelas abaixo eram utilizadas nas versoes antigas do sistema,
-- sendo substituídas por:
--   - fleet (substituiu b4_vehicles e equipamentos)
--   - compartimentos_viatura (substituiu b4_compartimentos_viaturas)
--   - locais_equipamento (substituiu b4_locais_equipamentos)
--   - checklist_items (substituiu b4_checklist_items)
--   - daily_missions (substituiu missions)

DROP TABLE IF EXISTS public.b4_vehicles CASCADE;
DROP TABLE IF EXISTS public.b4_compartimentos_viaturas CASCADE;
DROP TABLE IF EXISTS public.b4_locais_equipamentos CASCADE;
DROP TABLE IF EXISTS public.b4_checklist_items CASCADE;
DROP TABLE IF EXISTS public.equipamentos CASCADE;
DROP TABLE IF EXISTS public.missions CASCADE;
