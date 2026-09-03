-- ============================================================
-- MIGRAÇÃO B4: Adicionar campo sort_order em equipamentos, fleet e materiais_consumo
-- Data: 2026-09-03
-- ============================================================

-- 1. Adicionar sort_order na tabela equipamentos (se existir a tabela)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipamentos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipamentos' AND column_name = 'sort_order') THEN
      ALTER TABLE public.equipamentos ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 2. Adicionar sort_order na tabela fleet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fleet') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fleet' AND column_name = 'sort_order') THEN
      ALTER TABLE public.fleet ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 3. Adicionar sort_order na tabela materiais_consumo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'materiais_consumo') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materiais_consumo' AND column_name = 'sort_order') THEN
      ALTER TABLE public.materiais_consumo ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 4. Garantir que checklist_items possui a coluna sort_order
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'sort_order') THEN
      ALTER TABLE public.checklist_items ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;
