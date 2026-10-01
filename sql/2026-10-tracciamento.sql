-- =====================================================================
-- Libere Botteghe — tracciamento dei click e della provenienza
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
-- Solo conteggi anonimi per giorno: nessun dato personale, nessun cookie.
-- =====================================================================

-- 1) Statistiche delle botteghe: ogni conteggio ricorda anche da dove è arrivato il visitatore
alter table public.statistiche add column if not exists fonte text not null default 'diretto';

alter table public.statistiche drop constraint if exists statistiche_pkey;
alter table public.statistiche add constraint statistiche_pkey primary key (bottega_id, giorno, tipo, fonte);

alter table public.statistiche drop constraint if exists statistiche_tipo_check;
alter table public.statistiche add constraint statistiche_tipo_check check (tipo in (
  'visita',        -- qualcuno apre la bottega
  'ordine',        -- «Invia su WhatsApp» dal cestino
  'ordine_copia',  -- «Copia il messaggio» dal cestino
  'whatsapp',      -- apre la chat WhatsApp della bottega
  'telefono',      -- tocca «Chiama»
  'maps',          -- apre Google Maps o le indicazioni
  'email',         -- tocca «Scrivi» per l'email
  'instagram',     -- apre l'Instagram della bottega
  'sito',          -- apre il sito della bottega
  'copia',         -- copia un contatto
  'condivisione',  -- condivide la bottega
  'contatto'       -- vecchio tipo, prima di questa versione
));

-- 2) Visite al sito (home e qualsiasi pagina d'ingresso), per misurare le campagne
create table if not exists public.visite_sito (
  giorno date not null default current_date,
  fonte text not null default 'diretto',
  conteggio int not null default 0,
  primary key (giorno, fonte)
);
alter table public.visite_sito enable row level security;
drop policy if exists "visite_sito_lettura" on public.visite_sito;
create policy "visite_sito_lettura" on public.visite_sito for select using (public.is_admin());

-- Ripulisce la fonte: solo lettere minuscole, numeri, - _ / . e al massimo 60 caratteri
create or replace function public.pulisci_fonte(p text) returns text
language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then 'diretto'
    when lower(btrim(p)) ~ '^[a-z0-9_./-]{1,60}$' then lower(btrim(p))
    else 'altro'
  end;
$$;

-- 3) Registra un evento di una bottega
drop function if exists public.registra_evento(uuid, text);
create or replace function public.registra_evento(p_bottega uuid, p_tipo text, p_fonte text default 'diretto') returns void
language plpgsql security definer set search_path = public as $$
declare f text := public.pulisci_fonte(p_fonte);
begin
  if p_tipo not in ('visita','ordine','ordine_copia','whatsapp','telefono','maps','email','instagram','sito','copia','condivisione','contatto') then return; end if;
  if p_bottega is null or auth.uid() = p_bottega then return; end if;
  if not exists (select 1 from public.botteghe where id = p_bottega) then return; end if;
  insert into public.statistiche (bottega_id, giorno, tipo, fonte, conteggio)
  values (p_bottega, current_date, p_tipo, f, 1)
  on conflict (bottega_id, giorno, tipo, fonte) do update set conteggio = public.statistiche.conteggio + 1;
end $$;
revoke all on function public.registra_evento(uuid, text, text) from public;
grant execute on function public.registra_evento(uuid, text, text) to anon, authenticated;

-- 4) Registra una visita al sito
create or replace function public.registra_visita_sito(p_fonte text default 'diretto') returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.visite_sito (giorno, fonte, conteggio)
  values (current_date, public.pulisci_fonte(p_fonte), 1)
  on conflict (giorno, fonte) do update set conteggio = public.visite_sito.conteggio + 1;
end $$;
revoke all on function public.registra_visita_sito(text) from public;
grant execute on function public.registra_visita_sito(text) to anon, authenticated;
