-- ====================================================================
-- MIGRAÇÃO: POPULAR ITENS DOS AMBIENTES DO QUARTEL NA TABELA CHECKLIST_ITEMS
-- ====================================================================

-- Esta instrução copia todos os materiais/equipamentos da tabela 'fleet' (que não são Viaturas)
-- que ainda não existem na tabela 'checklist_items', vinculando a coluna 'viatura_id' ao ID do ambiente em 'locais_equipamento'
-- ou ao ID da 'Reserva de materiais' quando o local for NULL/não atribuído.

INSERT INTO public.checklist_items (
  id,
  item_name,
  category,
  description,
  is_active,
  sort_order,
  quantidade,
  viatura_id,
  compartimento_id,
  created_at
)
SELECT
  f.id,
  f.name AS item_name,
  COALESCE(f.type, 'Equipamento') AS category,
  CASE 
    WHEN f.details IS NOT NULL AND f.details::text LIKE '{%' THEN (f.details::jsonb->>'raw')
    ELSE f.details::text 
  END AS description,
  CASE WHEN f.status = 'active' OR f.status IS NULL THEN true ELSE false END AS is_active,
  0 AS sort_order,
  COALESCE(f.quantidade, 1) AS quantidade,
  COALESCE(
    f.local_id::text,
    loc.id::text,
    vtr.id::text,
    (SELECT id::text FROM public.locais_equipamento WHERE LOWER(nome) LIKE '%reserva%' LIMIT 1),
    (SELECT id::text FROM public.locais_equipamento WHERE LOWER(nome) LIKE '%central%' LIMIT 1)
  ) AS viatura_id,
  f.compartimento_id,
  NOW()
FROM public.fleet f
LEFT JOIN public.locais_equipamento loc ON LOWER(TRIM(loc.nome)) = LOWER(TRIM(f.location))
LEFT JOIN public.fleet vtr ON vtr.type = 'Viatura' AND LOWER(TRIM(vtr.name)) = LOWER(TRIM(f.location))
WHERE f.type != 'Viatura'
  AND NOT EXISTS (
    SELECT 1 FROM public.checklist_items ci 
    WHERE ci.id = f.id 
       OR LOWER(TRIM(ci.item_name)) = LOWER(TRIM(f.name))
  );
