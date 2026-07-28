-- =========================================================
-- WEBHOOK: sync daily_missions → sync-sheets Edge Function
-- 
-- Como funciona:
--   A cada INSERT ou UPDATE em daily_missions, este trigger
--   dispara automaticamente uma chamada HTTP para a Edge
--   Function sync-sheets, que grava na planilha Google.
--
-- Pré-requisito: extensão pg_net ativa (padrão no Supabase)
-- =========================================================

-- 1. Garante que pg_net está ativo
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Função que dispara o webhook
CREATE OR REPLACE FUNCTION public.fn_sync_daily_missions_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url   TEXT;
  _anon  TEXT;
BEGIN
  -- Lê as configurações salvas nos Supabase Secrets/Vault
  -- (alternativa: hardcode temporário substituído abaixo)
  _url  := current_setting('app.supabase_url',  true);
  _anon := current_setting('app.supabase_anon', true);

  -- Fallback: lê das variáveis de ambiente da Edge Function
  IF _url IS NULL OR _url = '' THEN
    _url  := 'https://YOUR_PROJECT_REF.supabase.co';
    _anon := 'YOUR_ANON_KEY';
  END IF;

  PERFORM net.http_post(
    url     := _url || '/functions/v1/sync-sheets',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _anon
    ),
    body    := jsonb_build_object(
      'type',   TG_OP,
      'table',  TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

-- 3. Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trg_sync_daily_missions_sheets
  ON public.daily_missions;

-- 4. Cria o trigger para INSERT e UPDATE
CREATE TRIGGER trg_sync_daily_missions_sheets
  AFTER INSERT OR UPDATE
  ON public.daily_missions
  FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_daily_missions_sheets();

-- 5. (Opcional) Configura as variáveis para não hardcodar
-- Execute uma vez no SQL Editor com seus valores reais:
--
-- ALTER DATABASE postgres
--   SET app.supabase_url  = 'https://SEU_REF.supabase.co';
-- ALTER DATABASE postgres
--   SET app.supabase_anon = 'SUA_ANON_KEY';
