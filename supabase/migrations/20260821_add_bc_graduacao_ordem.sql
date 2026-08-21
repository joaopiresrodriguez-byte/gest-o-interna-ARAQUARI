ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS bc_graduacao_ordem INTEGER;

COMMENT ON COLUMN public.personnel.bc_graduacao_ordem IS 'Ordem hierárquica da graduação BC de 1 a 10. Valor 1 representa o mais antigo (1º Grau Bombeiro Comunitário) e 10 o mais moderno (10º Grau BC Pleno Classe 1). Nulo para militares regulares.';

NOTIFY pgrst, 'reload schema';
