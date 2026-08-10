-- =========================================================
-- MIGRAÇÃO: Trigger de Sincronização Automática da Escala
-- Data: 2026-08-10
-- Tabela alvo: escalas → Edge Function sync-sheets
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.fn_sync_escalas_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url   TEXT;
  _anon  TEXT;
BEGIN
  _url  := current_setting('app.supabase_url',  true);
  _anon := current_setting('app.supabase_anon', true);

  IF _url IS NULL OR _url = '' THEN
    _url  := 'https://lsxsbvtacopsvhwbdkhx.supabase.co';
    _anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzeHNidnRhY29wc3Zod2Jka2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTI0MDQsImV4cCI6MjA4NTM2ODQwNH0.W9kcFPQkcbQmpWFWtQ_D_53lfUIA6TWeUcXuFEBVrF0';
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

DROP TRIGGER IF EXISTS trg_sync_escalas_sheets ON public.escalas;

CREATE TRIGGER trg_sync_escalas_sheets
  AFTER INSERT OR UPDATE
  ON public.escalas
  FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_escalas_sheets();
