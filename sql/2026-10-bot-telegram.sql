-- =====================================================================
-- Libere Botteghe — avvisi automatici sul bot Telegram del gestore
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
--
-- Avvisa il bot quando: si apre una nuova bottega, una bottega aggiunge
-- prodotti o esperienze, una bottega chiude, arriva una nuova recensione.
--
-- La parola segreta NON è in questo file (il codice del sito è pubblico):
-- si salva a parte con il comando in fondo, che ti do in chat.
-- =====================================================================

-- 1) Estensione per fare chiamate web dal database (già disponibile su Supabase)
create extension if not exists pg_net with schema extensions;

-- 2) Impostazioni private del bot: nessuno può leggerle dal sito (nessuna regola di accesso)
create table if not exists public.bot_impostazioni (
  chiave text primary key,
  valore text not null
);
alter table public.bot_impostazioni enable row level security;
revoke all on public.bot_impostazioni from anon, authenticated;

-- 3) Funzione che manda l'avviso al bot
create or replace function public.avvisa_bot() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  segreto text;
begin
  select valore into segreto from public.bot_impostazioni where chiave = 'segreto';
  if segreto is null then
    return coalesce(new, old);
  end if;
  -- Per le modifiche alle botteghe avvisiamo solo se cambiano i prodotti o il nome
  if tg_op = 'UPDATE' and tg_table_name = 'botteghe'
     and (new.data -> 'prodotti') is not distinct from (old.data -> 'prodotti')
     and (new.data ->> 'nome') is not distinct from (old.data ->> 'nome') then
    return new;
  end if;
  perform net.http_post(
    url := 'https://liberebotteghe.it/api/telegram/notify',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-LB-Secret', segreto),
    timeout_milliseconds := 5000
  );
  return coalesce(new, old);
exception when others then
  -- un avviso non riuscito non deve mai bloccare il salvataggio di una bottega
  return coalesce(new, old);
end $$;
revoke all on function public.avvisa_bot() from public, anon, authenticated;

-- 4) Quando scattano gli avvisi
drop trigger if exists avvisa_bot_botteghe on public.botteghe;
create trigger avvisa_bot_botteghe
  after insert or update or delete on public.botteghe
  for each row execute function public.avvisa_bot();

drop trigger if exists avvisa_bot_recensioni on public.recensioni;
create trigger avvisa_bot_recensioni
  after insert on public.recensioni
  for each row execute function public.avvisa_bot();

-- 5) ULTIMO PASSO, a parte: salva la parola segreta (la stessa di TELEGRAM_SECRET in Cloudflare).
--    Sostituisci INCOLLA-QUI con la parola segreta e lancia solo questa riga:
-- insert into public.bot_impostazioni (chiave, valore) values ('segreto', 'INCOLLA-QUI')
--   on conflict (chiave) do update set valore = excluded.valore;
