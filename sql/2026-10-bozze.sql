-- =====================================================================
-- Libere Botteghe — «Crea una bottega per un artigiano»
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
--
-- Il gestore compila una BOZZA di bottega (anche dal telefono, insieme all'artigiano).
-- La bozza non compare sul sito. L'artigiano apre il link /la-mia-bottega?bozza=<codice>,
-- entra con la sua email e la bozza diventa la sua bottega (con foto e prodotti).
-- =====================================================================

-- 1) Le bozze: le vede e le modifica solo il gestore
create table if not exists public.bozze_botteghe (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  data jsonb not null default '{}'::jsonb,
  creata timestamptz not null default now(),
  aggiornata timestamptz,
  riscattata_da uuid,
  riscattata_il timestamptz
);
alter table public.bozze_botteghe enable row level security;
drop policy if exists "bozze: solo il gestore" on public.bozze_botteghe;
create policy "bozze: solo il gestore" on public.bozze_botteghe for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.bozze_botteghe from anon;
grant select, insert, update, delete on public.bozze_botteghe to authenticated;

-- 2) Le foto delle bozze (cartella foto/bozze/<id>/): le carica il gestore
drop policy if exists "foto: il gestore carica" on storage.objects;
create policy "foto: il gestore carica" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto' and public.is_admin());
drop policy if exists "foto: il gestore aggiorna" on storage.objects;
create policy "foto: il gestore aggiorna" on storage.objects for update to authenticated
  using (bucket_id = 'foto' and public.is_admin()) with check (bucket_id = 'foto' and public.is_admin());
drop policy if exists "foto: il gestore cancella" on storage.objects;
create policy "foto: il gestore cancella" on storage.objects for delete to authenticated
  using (bucket_id = 'foto' and public.is_admin());

-- 3) Chi ha il link vede la bozza (solo quella del suo codice, mai l'elenco)
create or replace function public.leggi_bozza(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', b.id, 'data', b.data, 'usata', b.riscattata_da is not null)
  from public.bozze_botteghe b where b.token = p_token and length(p_token) >= 16;
$$;
revoke all on function public.leggi_bozza(text) from public;
grant execute on function public.leggi_bozza(text) to anon, authenticated;

-- 4) L'artigiano, entrato con la sua email, prende la bozza: diventa la sua bottega
create or replace function public.riscatta_bozza(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b public.bozze_botteghe%rowtype;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if me is null then raise exception 'serve_accesso'; end if;
  select * into b from public.bozze_botteghe where token = p_token for update;
  if not found then raise exception 'bozza_inesistente'; end if;
  if b.riscattata_da is not null then raise exception 'bozza_usata'; end if;
  if exists (select 1 from public.botteghe where id = me) then raise exception 'hai_gia_una_bottega'; end if;
  if coalesce(b.data ->> 'nome', '') = '' then raise exception 'bozza_vuota'; end if;
  insert into public.botteghe (id, data, updated_at)
    values (me, b.data || jsonb_build_object('creata', now_ms, 'aggiornata', now_ms, 'apertaDalGestore', true), now());
  update public.bozze_botteghe set riscattata_da = me, riscattata_il = now() where id = b.id;
  return me;
end $$;
revoke all on function public.riscatta_bozza(text) from public, anon;
grant execute on function public.riscatta_bozza(text) to authenticated;
