-- =====================================================================
-- Libere Botteghe — conteggi per botteghe preferite e prenotazioni
-- Da incollare UNA volta in Supabase: SQL Editor → New query → Run.
-- Va eseguito DOPO sql/2026-10-tracciamento.sql. Rilanciarlo non fa danni.
-- =====================================================================
alter table public.statistiche drop constraint if exists statistiche_tipo_check;
alter table public.statistiche add constraint statistiche_tipo_check check (tipo in (
  'visita','ordine','ordine_copia','whatsapp','telefono','maps','email','instagram','sito','copia','condivisione','contatto',
  'preferito',     -- qualcuno aggiunge la bottega alle preferite
  'prenotazione'   -- «Prenota su WhatsApp» su un'esperienza
));

create or replace function public.registra_evento(p_bottega uuid, p_tipo text, p_fonte text default 'diretto') returns void
language plpgsql security definer set search_path = public as $$
declare f text := public.pulisci_fonte(p_fonte);
begin
  if p_tipo not in ('visita','ordine','ordine_copia','whatsapp','telefono','maps','email','instagram','sito','copia','condivisione','contatto','preferito','prenotazione') then return; end if;
  if p_bottega is null or auth.uid() = p_bottega then return; end if;
  if not exists (select 1 from public.botteghe where id = p_bottega) then return; end if;
  insert into public.statistiche (bottega_id, giorno, tipo, fonte, conteggio)
  values (p_bottega, current_date, p_tipo, f, 1)
  on conflict (bottega_id, giorno, tipo, fonte) do update set conteggio = public.statistiche.conteggio + 1;
end $$;
revoke all on function public.registra_evento(uuid, text, text) from public;
grant execute on function public.registra_evento(uuid, text, text) to anon, authenticated;
