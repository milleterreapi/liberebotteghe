-- =====================================================================
-- Libere Botteghe — «Mi piace» su botteghe, prodotti e storie
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
--
-- Chiunque può mettere «mi piace», anche senza account: il sito usa un
-- codice a caso salvato nel browser (niente dati personali). Il numero è
-- pubblico; chi l'ha messo non lo vede nessuno, nemmeno il gestore dal sito.
-- Oggetti: b:<id bottega>, p:<id bottega>:<id prodotto>, s:<id bottega> (storia).
-- =====================================================================

create table if not exists public.mi_piace (
  oggetto text not null,
  chiave text not null,
  creata timestamptz not null default now(),
  primary key (oggetto, chiave)
);
create index if not exists mi_piace_chiave_idx on public.mi_piace (chiave, creata);
alter table public.mi_piace enable row level security;
revoke all on public.mi_piace from anon, authenticated;   -- nessuno li legge uno per uno

create table if not exists public.mi_piace_totali (
  oggetto text primary key,
  n integer not null default 0
);
alter table public.mi_piace_totali enable row level security;
drop policy if exists "mi piace: i totali li vedono tutti" on public.mi_piace_totali;
create policy "mi piace: i totali li vedono tutti" on public.mi_piace_totali for select to anon, authenticated using (true);
revoke all on public.mi_piace_totali from anon, authenticated;
grant select on public.mi_piace_totali to anon, authenticated;

-- mettere o togliere un «mi piace»: restituisce il nuovo totale
create or replace function public.metti_mi_piace(p_oggetto text, p_chiave text, p_on boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare bid uuid; tot integer;
begin
  if p_chiave !~ '^[a-z0-9]{16,40}$' then raise exception 'chiave_non_valida'; end if;
  if p_oggetto !~ '^(b|s):[0-9a-f-]{36}$' and p_oggetto !~ '^p:[0-9a-f-]{36}:[A-Za-z0-9_-]{1,40}$' then raise exception 'oggetto_non_valido'; end if;
  bid := substring(p_oggetto from 3 for 36)::uuid;
  if not exists (select 1 from public.botteghe where id = bid) then raise exception 'oggetto_inesistente'; end if;
  if p_on then
    if (select count(*) from public.mi_piace where chiave = p_chiave and creata > now() - interval '1 day') >= 300 then raise exception 'troppi_mi_piace'; end if;
    insert into public.mi_piace (oggetto, chiave) values (p_oggetto, p_chiave) on conflict do nothing;
    if found then
      insert into public.mi_piace_totali (oggetto, n) values (p_oggetto, 1)
        on conflict (oggetto) do update set n = public.mi_piace_totali.n + 1;
    end if;
  else
    delete from public.mi_piace where oggetto = p_oggetto and chiave = p_chiave;
    if found then update public.mi_piace_totali set n = greatest(n - 1, 0) where oggetto = p_oggetto; end if;
  end if;
  select n into tot from public.mi_piace_totali where oggetto = p_oggetto;
  return coalesce(tot, 0);
end $$;
revoke all on function public.metti_mi_piace(text, text, boolean) from public;
grant execute on function public.metti_mi_piace(text, text, boolean) to anon, authenticated;

-- quando una bottega chiude, spariscono anche i suoi «mi piace»
create or replace function public._mi_piace_pulisci() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.mi_piace where substring(oggetto from 3 for 36) = old.id::text;
  delete from public.mi_piace_totali where substring(oggetto from 3 for 36) = old.id::text;
  return old;
end $$;
drop trigger if exists mi_piace_pulisci on public.botteghe;
create trigger mi_piace_pulisci after delete on public.botteghe for each row execute function public._mi_piace_pulisci();

-- aggiornamenti in diretta dei totali (facoltativo: se la pubblicazione non c'è, si salta)
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.mi_piace_totali'; exception when others then null; end;
end $$;
