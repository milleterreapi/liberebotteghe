-- =====================================================================
-- Libere Botteghe — traduzioni automatiche dei testi delle botteghe (EN, FR, DE)
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Ogni testo si traduce una volta sola e resta qui: tutti possono leggere,
-- scrive solo il gestore (il sito lo fa da solo con l'account del gestore).
-- =====================================================================
create table if not exists public.traduzioni (
  id text primary key,          -- lingua + impronta del testo originale, es. en:3f2a…
  testo text not null,          -- il testo tradotto
  creata timestamptz not null default now()
);
alter table public.traduzioni enable row level security;

drop policy if exists "traduzioni: tutti leggono" on public.traduzioni;
create policy "traduzioni: tutti leggono" on public.traduzioni for select using (true);

drop policy if exists "traduzioni: scrive il gestore" on public.traduzioni;
create policy "traduzioni: scrive il gestore" on public.traduzioni for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.traduzioni to anon, authenticated;
grant insert, update, delete on public.traduzioni to authenticated;
