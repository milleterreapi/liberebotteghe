-- =====================================================================
-- Libere Botteghe — resoconto settimanale via email agli artigiani
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Richiede che sia già stato lanciato sql/2026-10-bot-telegram.sql
-- (usa la stessa parola segreta salvata in bot_impostazioni).
-- =====================================================================

-- 1) Le email dei titolari: le può leggere SOLO il gestore (is_admin)
create or replace function public.email_artigiani()
returns table(bottega_id uuid, email text)
language sql stable security definer set search_path = public, auth as $$
  select b.id, u.email::text
  from public.botteghe b
  join auth.users u on u.id = b.id
  where public.is_admin();
$$;
revoke all on function public.email_artigiani() from public, anon;
grant execute on function public.email_artigiani() to authenticated;

-- 2) Ogni lunedì alle 7:00 UTC (9:00 in Italia d'estate, 8:00 d'inverno) parte il resoconto
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'resoconto-settimanale';
select cron.schedule(
  'resoconto-settimanale',
  '0 7 * * 1',
  $job$
  select net.http_post(
    url := 'https://liberebotteghe.it/api/report',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-LB-Secret', (select valore from public.bot_impostazioni where chiave = 'segreto')
    ),
    timeout_milliseconds := 10000
  );
  $job$
);
