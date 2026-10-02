-- =====================================================================
-- Libere Botteghe — botteghe preferite salvate nell'account
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Ognuno vede e modifica solo le proprie preferite. Rilanciarlo non fa danni.
-- =====================================================================
create table if not exists public.preferiti (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bottega_id uuid not null references public.botteghe(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bottega_id)
);
alter table public.preferiti enable row level security;

drop policy if exists "preferiti_lettura" on public.preferiti;
drop policy if exists "preferiti_aggiungi" on public.preferiti;
drop policy if exists "preferiti_togli" on public.preferiti;
create policy "preferiti_lettura"  on public.preferiti for select using (user_id = auth.uid());
create policy "preferiti_aggiungi" on public.preferiti for insert with check (user_id = auth.uid());
create policy "preferiti_togli"    on public.preferiti for delete using (user_id = auth.uid());

grant select, insert, delete on public.preferiti to authenticated;
