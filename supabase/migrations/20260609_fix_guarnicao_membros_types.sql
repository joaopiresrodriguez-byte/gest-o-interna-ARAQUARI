-- ============================================================
-- MIGRAÇÃO: Corrigir tipo de guarnicao_id e militar_id em guarnicao_membros
-- E criar chave estrangeira (FK) para guarnicoes(id)
-- Data: 2026-06-09
-- ============================================================

-- 1. Drop existing constraints that depend on the old columns
ALTER TABLE guarnicao_membros DROP CONSTRAINT IF EXISTS guarnicao_membros_guarnicao_id_militar_id_key;

-- 2. Add temporary column for guarnicao_id as UUID
ALTER TABLE guarnicao_membros ADD COLUMN guarnicao_id_uuid uuid;

-- 3. Map old integer guarnicao_id to actual UUIDs from guarnicoes
UPDATE guarnicao_membros 
SET guarnicao_id_uuid = '330e8bf5-9712-4483-8ae5-b5ca110d97ff'::uuid 
WHERE guarnicao_id = 1;

UPDATE guarnicao_membros 
SET guarnicao_id_uuid = 'be1d50e1-7ab0-4572-9fe0-a1872fc27e6c'::uuid 
WHERE guarnicao_id = 2;

UPDATE guarnicao_membros 
SET guarnicao_id_uuid = '9c58324e-0da3-4f8c-bc4b-dcca02b90784'::uuid 
WHERE guarnicao_id = 3;

UPDATE guarnicao_membros 
SET guarnicao_id_uuid = '3b7c783b-c76b-4825-9d82-5d60a30c8b88'::uuid 
WHERE guarnicao_id = 4;

-- 4. Delete any orphaned rows that didn't map (just in case)
DELETE FROM guarnicao_membros WHERE guarnicao_id_uuid IS NULL;

-- 5. Drop the old integer guarnicao_id column
ALTER TABLE guarnicao_membros DROP COLUMN guarnicao_id;

-- 6. Rename temporary column to guarnicao_id and set NOT NULL
ALTER TABLE guarnicao_membros RENAME COLUMN guarnicao_id_uuid TO guarnicao_id;
ALTER TABLE guarnicao_membros ALTER COLUMN guarnicao_id SET NOT NULL;

-- 7. Alter militar_id type to bigint to match personnel(id)
ALTER TABLE guarnicao_membros ALTER COLUMN militar_id TYPE bigint;

-- 8. Add Foreign Key and Unique constraints
ALTER TABLE guarnicao_membros 
  ADD CONSTRAINT guarnicao_membros_guarnicao_id_fkey 
  FOREIGN KEY (guarnicao_id) REFERENCES guarnicoes(id) ON DELETE CASCADE;

ALTER TABLE guarnicao_membros 
  ADD CONSTRAINT guarnicao_membros_guarnicao_id_militar_id_key 
  UNIQUE (guarnicao_id, militar_id);
