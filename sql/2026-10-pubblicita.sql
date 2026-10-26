-- =====================================================================
-- Libere Botteghe — Pubblicità in piazza con le monete
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run
-- (dopo sql/2026-10-missioni.sql). Se lo rilanci non succede niente di male.
--
-- Aggiunge due premi: «camion7» (150 monete: un camion con il nome della
-- bottega gira nella piazza della prima pagina per 7 giorni) e «aereo7»
-- (250 monete: un aereo con lo striscione per 7 giorni). Partono da soli.
-- =====================================================================

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
