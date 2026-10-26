-- =====================================================================
-- Libere Botteghe — Segnalazioni di contenuti (pulsante «Segnala»)
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
--
-- Chiunque può segnalare una bottega, un prodotto o una recensione che
-- ritiene illegale o scorretta (Digital Services Act, art. 16). Le
-- segnalazioni le vede solo il gestore, che riceve anche un avviso sul bot.
-- =====================================================================

create table if not exists public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  bottega_id uuid references public.botteghe(id) on delete set null,
  prodotto text,
  pagina text not null,
  motivo text not null,
  testo text not null,
  email text,
  stato text not null default 'aperta' check (stato in ('aperta','gestita','respinta')),
  esito text,
  creata timestamptz not null default now(),
  gestita timestamptz
);
alter table public.segnalazioni enable row level security;
drop policy if exists "segnalazioni: le vede il gestore" on public.segnalazioni;
create policy "segnalazioni: le vede il gestore" on public.segnalazioni for select to authenticated using (public.is_admin());
drop policy if exists "segnalazioni: le aggiorna il gestore" on public.segnalazioni;
create policy "segnalazioni: le aggiorna il gestore" on public.segnalazioni for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.segnalazioni from anon, authenticated;
grant select, update on public.segnalazioni to authenticated;

-- chi segnala passa da qui (anche senza account): controlli su lunghezze e un freno ai doppioni
create or replace function public.segnala(p_bottega uuid, p_prodotto text, p_pagina text, p_motivo text, p_testo text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare nuovo uuid;
begin
  if p_motivo not in ('illegale','pericoloso','contraffatto','ingannevole','offensivo','recensione','dati','altro') then raise exception 'motivo_non_valido'; end if;
  if length(trim(coalesce(p_testo,''))) < 10 or length(p_testo) > 2000 then raise exception 'testo_non_valido'; end if;
  if p_email is not null and p_email <> '' and (length(p_email) > 120 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'email_non_valida'; end if;
  if (select count(*) from public.segnalazioni where creata > now() - interval '1 hour') > 60 then raise exception 'troppe_segnalazioni'; end if;
  if exists (select 1 from public.segnalazioni where testo = trim(p_testo) and creata > now() - interval '1 day') then raise exception 'gia_segnalato'; end if;
  insert into public.segnalazioni (bottega_id, prodotto, pagina, motivo, testo, email)
  values (case when exists (select 1 from public.botteghe where id = p_bottega) then p_bottega end,
          left(nullif(trim(coalesce(p_prodotto,'')), ''), 60), left(coalesce(p_pagina,''), 300), p_motivo, trim(p_testo), nullif(trim(coalesce(p_email,'')), ''))
  returning id into nuovo;
  return nuovo;
end $$;
revoke all on function public.segnala(uuid, text, text, text, text, text) from public;
grant execute on function public.segnala(uuid, text, text, text, text, text) to anon, authenticated;

-- avviso sul bot Telegram del gestore (se il bot è collegato)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'avvisa_bot' and pronamespace = 'public'::regnamespace) then
    execute 'drop trigger if exists avvisa_bot_segnalazioni on public.segnalazioni';
    execute 'create trigger avvisa_bot_segnalazioni after insert on public.segnalazioni for each row execute function public.avvisa_bot()';
  end if;
end $$;
