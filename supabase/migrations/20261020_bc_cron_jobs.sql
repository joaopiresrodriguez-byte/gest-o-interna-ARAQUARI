-- ============================================================
-- Migration: pg_cron Jobs para automação do ciclo BC
-- DIA 20 → Abertura automática + envio de links WhatsApp
-- DIA 26 → Encerramento + motor de seleção automático
-- ============================================================
-- REQUISITO: extensão pg_cron e pg_net habilitadas no Supabase
-- Habilitar em: Supabase Dashboard → Database → Extensions
-- ============================================================

-- Verificar se pg_cron está disponível
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE NOTICE 'AVISO: pg_cron não está habilitado. Habilite em Supabase Dashboard > Database > Extensions.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN
        RAISE NOTICE 'AVISO: pg_net não está habilitado. Habilite em Supabase Dashboard > Database > Extensions.';
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- JOB 1: Abertura automática do ciclo BC — Todo dia 20 às 08:00 BRT
-- (11:00 UTC = 08:00 BRT)
-- ──────────────────────────────────────────────────────────────
SELECT cron.schedule(
    'bc-abertura-ciclo-dia20',          -- nome único do job
    '0 11 20 * *',                       -- todo dia 20 às 11:00 UTC (08:00 BRT)
    $$
    SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/processar-ciclo-bc',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body    := '{"action":"abrir_ciclo_dia20"}'::jsonb
    ) AS request_id;
    $$
) ON CONFLICT (jobname) DO UPDATE
    SET schedule = EXCLUDED.schedule,
        command  = EXCLUDED.command;

-- ──────────────────────────────────────────────────────────────
-- JOB 2: Encerramento do ciclo BC — Todo dia 26 às 00:01 BRT
-- (03:01 UTC = 00:01 BRT)
-- ──────────────────────────────────────────────────────────────
SELECT cron.schedule(
    'bc-encerramento-ciclo-dia26',       -- nome único do job
    '1 3 26 * *',                         -- todo dia 26 às 03:01 UTC (00:01 BRT)
    $$
    SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/processar-ciclo-bc',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body    := '{"action":"encerrar_ciclo_dia26"}'::jsonb
    ) AS request_id;
    $$
) ON CONFLICT (jobname) DO UPDATE
    SET schedule = EXCLUDED.schedule,
        command  = EXCLUDED.command;

-- ──────────────────────────────────────────────────────────────
-- JOB 3: Motor de Seleção — Todo dia 26 às 00:05 BRT
-- (03:05 UTC — executa 4 minutos após o encerramento)
-- ──────────────────────────────────────────────────────────────
SELECT cron.schedule(
    'bc-motor-selecao-dia26',            -- nome único do job
    '5 3 26 * *',                         -- todo dia 26 às 03:05 UTC (00:05 BRT)
    $$
    SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/processar-ciclo-bc',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body    := '{"action":"rodar_motor_selecao"}'::jsonb
    ) AS request_id;
    $$
) ON CONFLICT (jobname) DO UPDATE
    SET schedule = EXCLUDED.schedule,
        command  = EXCLUDED.command;

-- ──────────────────────────────────────────────────────────────
-- Verificar jobs criados
-- ──────────────────────────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'bc-%';

NOTIFY pgrst, 'reload schema';
