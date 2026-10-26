-- =====================================================================
-- Libere Botteghe — Missioni e monete
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Se lo rilanci per sbaglio non succede niente di male.
--
-- Gli artigiani completano missioni (copertina, storia, prodotti con foto,
-- recensioni, un prodotto nuovo ogni settimana, portare un artigiano…) e
-- guadagnano monete. Le monete si spendono in visibilità: giorni in evidenza
-- in prima pagina, un post sui nostri social, la candidatura a Bottega del mese.
--
-- Le monete le assegna SOLO il database (controllando i dati veri della bottega):
-- dal sito nessuno può scriversele da solo.
-- =====================================================================

-- 1) Il libretto delle monete: ogni riga è un'entrata (+) o una spesa (−)
create table if not exists public.monete (
  id bigint generated always as identity primary key,
  bottega_id uuid not null references public.botteghe(id) on delete cascade,
  chiave text not null,
  importo integer not null,
  nota text not null default '',
  creata timestamptz not null default now(),
  unique (bottega_id, chiave)
);
create index if not exists monete_bottega_idx on public.monete (bottega_id);
alter table public.monete enable row level security;
drop policy if exists "monete: le tue" on public.monete;
create policy "monete: le tue" on public.monete for select to authenticated
  using (bottega_id = auth.uid() or public.is_admin());
revoke all on public.monete from anon, authenticated;
grant select on public.monete to authenticated;

-- 2) Le richieste che controlla il gestore (missioni da verificare a mano, premi da preparare)
create table if not exists public.richieste_monete (
  id uuid primary key default gen_random_uuid(),
  bottega_id uuid not null references public.botteghe(id) on delete cascade,
  tipo text not null check (tipo in ('missione','premio')),
  chiave text not null,
  importo integer not null default 0,
  stato text not null default 'attesa' check (stato in ('attesa','ok','no')),
  creata timestamptz not null default now(),
  decisa timestamptz,
  unique (bottega_id, tipo, chiave)
);
alter table public.richieste_monete enable row level security;
drop policy if exists "richieste monete: le tue" on public.richieste_monete;
create policy "richieste monete: le tue" on public.richieste_monete for select to authenticated
  using (bottega_id = auth.uid() or public.is_admin());
revoke all on public.richieste_monete from anon, authenticated;
grant select on public.richieste_monete to authenticated;

-- avviso sul bot Telegram quando arriva una richiesta (se il bot è collegato)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'avvisa_bot' and pronamespace = 'public'::regnamespace) then
    execute 'drop trigger if exists avvisa_bot_richieste_monete on public.richieste_monete';
    execute 'create trigger avvisa_bot_richieste_monete after insert on public.richieste_monete for each row execute function public.avvisa_bot()';
  end if;
end $$;

-- 3) Aiutanti interni (nessuno li può chiamare dal sito)
create or replace function public._lb_accredita(p_bottega uuid, p_chiave text, p_importo integer, p_nota text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.monete (bottega_id, chiave, importo, nota) values (p_bottega, p_chiave, p_importo, coalesce(p_nota, ''))
    on conflict (bottega_id, chiave) do nothing;
  return found;
end $$;
revoke all on function public._lb_accredita(uuid, text, integer, text) from public, anon, authenticated;

create or replace function public._lb_settimana() returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Rome', 'IYYY-"W"IW');
$$;

create or replace function public._lb_saldo(p_bottega uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(importo), 0)::int from public.monete where bottega_id = p_bottega;
$$;
revoke all on function public._lb_saldo(uuid) from public, anon, authenticated;

create or replace function public._lb_stato(p_bottega uuid, p_nuove jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'saldo', public._lb_saldo(p_bottega),
    'settimana', public._lb_settimana(),
    'nuove', coalesce(p_nuove, '[]'::jsonb),
    'fatte', coalesce((select jsonb_agg(chiave) from public.monete where bottega_id = p_bottega and importo > 0), '[]'::jsonb),
    'movimenti', coalesce((select jsonb_agg(m order by m.creata desc) from (select chiave, importo, nota, creata from public.monete where bottega_id = p_bottega order by creata desc limit 40) m), '[]'::jsonb),
    'richieste', coalesce((select jsonb_agg(r order by r.creata desc) from (select id, tipo, chiave, importo, stato, creata from public.richieste_monete where bottega_id = p_bottega order by creata desc limit 20) r), '[]'::jsonb)
  );
$$;
revoke all on function public._lb_stato(uuid, jsonb) from public, anon, authenticated;

-- 4) L'artigiano apre «Missioni e monete»: il database controlla cosa ha fatto e assegna le monete
create or replace function public.missioni_controlla() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d jsonb;
  nuove jsonb := '[]'::jsonb;
  sett text := public._lb_settimana();
  inizio_sett numeric := extract(epoch from (date_trunc('week', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')) * 1000;
  n_foto int; n_rec int; n_risp int; st_n int; st_len int; nuovo_sett boolean;
  r record;
begin
  if me is null then raise exception 'serve_accesso'; end if;
  select data into d from public.botteghe where id = me;
  if d is null or coalesce(d->>'nome', '') = '' then raise exception 'nessuna_bottega'; end if;
  perform pg_advisory_xact_lock(hashtext('monete:' || me::text));

  select count(*) into n_foto from jsonb_array_elements(case when jsonb_typeof(d->'prodotti') = 'array' then d->'prodotti' else '[]'::jsonb end) p
    where coalesce(p->>'nome', '') <> '' and coalesce(p->>'fotoV', '') not in ('', '0', 'false', 'null');
  select count(*), count(*) filter (where coalesce(trim(risposta), '') <> '') into n_rec, n_risp from public.recensioni where bottega_id = me;
  select count(*), coalesce(sum(length(trim(value))), 0) into st_n, st_len
    from jsonb_each_text(case when jsonb_typeof(d->'storia') = 'object' then d->'storia' else '{}'::jsonb end)
    where key in ('inizio', 'lavoro', 'speciale', 'territorio') and length(trim(value)) > 0;
  select exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d->'prodotti') = 'array' then d->'prodotti' else '[]'::jsonb end) p
    where coalesce(p->>'nome', '') <> '' and (p->>'creato') ~ '^[0-9]+(\.[0-9]+)?$' and (p->>'creato')::numeric >= inizio_sett) into nuovo_sett;

  for r in
    select * from (values
      ('benvenuto',    20, 'Benvenuto nelle missioni', true),
      ('copertina',    20, 'Missione: immagine di copertina', coalesce(d->>'bannerV', '') not in ('', '0', 'false')),
      ('logo',         10, 'Missione: logo della bottega', coalesce(d->>'coverV', '') not in ('', '0', 'false')),
      ('mappa',        10, 'Missione: bottega sulla mappa', jsonb_typeof(d->'lat') = 'number'),
      ('instagram',    10, 'Missione: Instagram collegato', length(trim(coalesce(d->>'instagram', ''))) > 0),
      ('storia',       40, 'Missione: la tua storia', st_n >= 2 and st_len >= 200),
      ('prodotti5',    40, 'Missione: 5 prodotti con la foto', n_foto >= 5),
      ('recensione1',  30, 'Missione: la prima recensione', n_rec >= 1),
      ('recensioni5',  60, 'Missione: 5 recensioni', n_rec >= 5),
      ('risposta',     15, 'Missione: hai risposto a una recensione', n_risp >= 1),
      ('novita:' || sett, 15, 'Missione della settimana: un prodotto nuovo', nuovo_sett)
    ) as m(chiave, importo, nota, ok)
  loop
    if r.ok and public._lb_accredita(me, r.chiave, r.importo, r.nota) then
      nuove := nuove || jsonb_build_object('chiave', r.chiave, 'importo', r.importo, 'nota', r.nota);
    end if;
  end loop;

  -- Porta un artigiano: monete per ogni bottega aperta con il tuo invito (quando ha almeno un prodotto)
  for r in
    select b.id, b.data->>'nome' as nome from public.botteghe b
    where b.data->>'portataDa' = me::text and b.id <> me and coalesce(b.data->>'nome', '') <> ''
      and jsonb_typeof(b.data->'prodotti') = 'array' and jsonb_array_length(b.data->'prodotti') > 0
  loop
    if public._lb_accredita(me, 'portato:' || r.id, 50, 'Missione: hai portato ' || left(r.nome, 60)) then
      nuove := nuove || jsonb_build_object('chiave', 'portato:' || r.id, 'importo', 50, 'nota', 'Missione: hai portato ' || left(r.nome, 60));
    end if;
  end loop;

  return public._lb_stato(me, nuove);
end $$;
revoke all on function public.missioni_controlla() from public, anon;
grant execute on function public.missioni_controlla() to authenticated;

-- 5) Missioni da far controllare al gestore (per ora: parlare di noi su Instagram, una volta a settimana)
create or replace function public.missioni_richiedi(p_missione text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k text;
begin
  if me is null then raise exception 'serve_accesso'; end if;
  if not exists (select 1 from public.botteghe where id = me and coalesce(data->>'nome', '') <> '') then raise exception 'nessuna_bottega'; end if;
  if p_missione <> 'instagram_tag' then raise exception 'missione_sconosciuta'; end if;
  k := 'instagram_tag:' || public._lb_settimana();
  if exists (select 1 from public.richieste_monete where bottega_id = me and tipo = 'missione' and chiave = k) then raise exception 'gia_richiesto'; end if;
  insert into public.richieste_monete (bottega_id, tipo, chiave, importo) values (me, 'missione', k, 25);
  return public._lb_stato(me, '[]'::jsonb);
end $$;
revoke all on function public.missioni_richiedi(text) from public, anon;
grant execute on function public.missioni_richiedi(text) to authenticated;

-- 6) Spendere le monete
create or replace function public.missioni_spendi(p_premio text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); costo int; giorni int; nota text; saldo int; fino date; cur date; c jsonb; dove text := 'evidenza'; base jsonb;
begin
  if me is null then raise exception 'serve_accesso'; end if;
  if not exists (select 1 from public.botteghe where id = me and coalesce(data->>'nome', '') <> ''
                 and jsonb_typeof(data->'prodotti') = 'array' and jsonb_array_length(data->'prodotti') > 0) then raise exception 'banco_vuoto'; end if;
  case p_premio
    when 'evidenza7'  then costo := 120; giorni := 7;  nota := 'In evidenza in prima pagina per 7 giorni';
    when 'evidenza30' then costo := 400; giorni := 30; nota := 'In evidenza in prima pagina per 30 giorni';
    when 'camion7'    then costo := 150; giorni := 7;  dove := 'camion'; nota := 'Camion pubblicitario in piazza per 7 giorni';
    when 'aereo7'     then costo := 250; giorni := 7;  dove := 'aereo';  nota := 'Aereo con lo striscione per 7 giorni';
    when 'social'     then costo := 200; nota := 'Post dedicato su Instagram e Facebook';
    when 'mese'       then costo := 600; nota := 'Candidatura a Bottega del mese';
    else raise exception 'premio_sconosciuto';
  end case;
  perform pg_advisory_xact_lock(hashtext('monete:' || me::text));
  saldo := public._lb_saldo(me);
  if saldo < costo then raise exception 'monete_insufficienti'; end if;

  if giorni is not null then
    select data into c from public.config where id = 'sito' for update;
    c := coalesce(c, '{}'::jsonb);
    base := case when dove = 'evidenza' then coalesce(c->'evidenza', '{}'::jsonb) else coalesce(c->'pubblicita'->dove, '{}'::jsonb) end;
    begin cur := nullif(base->me::text->>'fino', '')::date; exception when others then cur := null; end;
    fino := greatest(current_date, coalesce(cur, current_date)) + giorni;
    base := base || jsonb_build_object(me::text, jsonb_build_object('fino', to_char(fino, 'YYYY-MM-DD'), 'monete', true));
    if dove = 'evidenza' then c := jsonb_set(c, '{evidenza}', base);
    else c := jsonb_set(c, '{pubblicita}', coalesce(c->'pubblicita', '{}'::jsonb) || jsonb_build_object(dove, base)); end if;
    insert into public.config (id, data) values ('sito', c) on conflict (id) do update set data = excluded.data;
    perform public._lb_accredita(me, 'spesa:' || gen_random_uuid(), -costo, nota || ' (fino al ' || to_char(fino, 'DD/MM') || ')');
  else
    if exists (select 1 from public.richieste_monete where bottega_id = me and tipo = 'premio' and stato = 'attesa' and chiave like p_premio || ':%') then raise exception 'gia_richiesto'; end if;
    insert into public.richieste_monete (bottega_id, tipo, chiave, importo) values (me, 'premio', p_premio || ':' || to_char(now(), 'YYYYMMDDHH24MISS'), costo);
    perform public._lb_accredita(me, 'spesa:' || gen_random_uuid(), -costo, nota);
  end if;
  return public._lb_stato(me, '[]'::jsonb) || jsonb_build_object('fino', to_char(fino, 'YYYY-MM-DD'));
end $$;
revoke all on function public.missioni_spendi(text) from public, anon;
grant execute on function public.missioni_spendi(text) to authenticated;

-- 7) Il gestore approva o rifiuta (dalla Gestione del sito o dal bot Telegram)
create or replace function public.missioni_decidi(p_id uuid, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.richieste_monete%rowtype; c jsonb;
begin
  if not public.is_admin() then raise exception 'solo_gestore'; end if;
  select * into q from public.richieste_monete where id = p_id for update;
  if not found then raise exception 'richiesta_inesistente'; end if;
  if q.stato <> 'attesa' then raise exception 'gia_decisa'; end if;
  if q.tipo = 'missione' and p_ok then
    perform public._lb_accredita(q.bottega_id, 'ok:' || q.chiave, q.importo, 'Missione: hai parlato di Libere Botteghe su Instagram');
  elsif q.tipo = 'premio' and not p_ok then
    perform public._lb_accredita(q.bottega_id, 'rimborso:' || q.id, q.importo, 'Monete restituite: richiesta non accolta');
  elsif q.tipo = 'premio' and p_ok and q.chiave like 'mese:%' then
    select data into c from public.config where id = 'sito' for update;
    c := coalesce(c, '{}'::jsonb) || jsonb_build_object('mese', q.bottega_id::text, 'meseFino', to_char(current_date + 30, 'YYYY-MM-DD'));
    insert into public.config (id, data) values ('sito', c) on conflict (id) do update set data = excluded.data;
  end if;
  update public.richieste_monete set stato = case when p_ok then 'ok' else 'no' end, decisa = now() where id = p_id;
  return jsonb_build_object('stato', case when p_ok then 'ok' else 'no' end, 'bottega_id', q.bottega_id, 'tipo', q.tipo, 'chiave', q.chiave);
end $$;
revoke all on function public.missioni_decidi(uuid, boolean) from public, anon;
grant execute on function public.missioni_decidi(uuid, boolean) to authenticated;

-- 8) Il gestore regala (o toglie) monete a mano
create or replace function public.missioni_regala(p_bottega uuid, p_importo integer, p_nota text) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_gestore'; end if;
  if p_importo = 0 or abs(p_importo) > 5000 then raise exception 'importo_non_valido'; end if;
  if not exists (select 1 from public.botteghe where id = p_bottega) then raise exception 'bottega_inesistente'; end if;
  perform public._lb_accredita(p_bottega, 'regalo:' || gen_random_uuid(), p_importo,
    coalesce(nullif(trim(p_nota), ''), case when p_importo > 0 then 'Regalo del gestore' else 'Correzione del gestore' end));
  return public._lb_saldo(p_bottega);
end $$;
revoke all on function public.missioni_regala(uuid, integer, text) from public, anon;
grant execute on function public.missioni_regala(uuid, integer, text) to authenticated;
