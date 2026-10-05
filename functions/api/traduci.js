// Libere Botteghe — traduzione automatica dei testi delle botteghe (nomi e descrizioni dei prodotti, storie…)
// per chi guarda il sito in inglese, francese o tedesco.
// Usa Cloudflare Workers AI (gratis entro la quota giornaliera): in Cloudflare → progetto → Settings → Bindings
// aggiungi «Workers AI» con nome AI. Le traduzioni restano salvate in Supabase (tabella traduzioni,
// sql/2026-10-traduzioni.sql), così ogni testo si traduce una volta sola.
// Traduce solo testi che esistono davvero nelle botteghe: nessuno può usarlo per tradurre altro.
import { rest, cleanEnv } from "../../bot/telegram.mjs";
import "../../lib/luoghi.js";

const SUPABASE_URL = "https://rvfwfpndvvpdwobkmxus.supabase.co";
const SUPABASE_KEY = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8";
const LANGS = ["en", "fr", "de"];
const MODEL = "@cf/meta/m2m100-1.2b";
const MAX_TESTI = 60, MAX_NUOVI = 25;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const sha1 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const norm = (s) => String(s || "").replace(/\r/g, "").trim();

async function anon(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("db_" + r.status);
  return r.json();
}
/* i testi che si possono tradurre: quelli scritti dagli artigiani (in memoria per un minuto) */
let ammessi = { t: 0, set: null };
async function testiAmmessi() {
  if (ammessi.set && Date.now() - ammessi.t < 60000) return ammessi.set;
  const set = new Set(), add = (x) => { x = norm(x); if (x) set.add(x); };
  for (const { data: d } of (await anon("botteghe?select=data")) || []) {
    if (!d || !d.nome) continue;
    add(d.descrizione); add(d.consegna);
    for (const k of Object.keys(d.storia || {})) add(d.storia[k]);
    for (const p of d.prodotti || []) { if (!p) continue; for (const k of ["nome", "descrizione", "unita", "durata", "quando", "luogo", "incluso", "portare", "adatto", "lingue"]) add(p[k]); }
  }
  ammessi = { t: Date.now(), set };
  return set;
}
/* il modello lavora meglio su frasi brevi: si traduce paragrafo per paragrafo, a pezzi di circa 400 caratteri */
function pezzi(par) {
  if (par.length <= 450) return [par];
  const out = []; let cur = "";
  for (const f of par.match(/[^.!?…]+[.!?…]*\s*/g) || [par]) { if ((cur + f).length > 450 && cur) { out.push(cur.trim()); cur = ""; } cur += f; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
async function traduci(ai, testo, lang) {
  const righe = testo.split("\n"), out = [];
  for (const r of righe) {
    if (!r.trim()) { out.push(r); continue; }
    const parti = [];
    for (const p of pezzi(r.trim())) {
      const res = await ai.run(MODEL, { text: p, source_lang: "it", target_lang: lang });
      const t = res && (res.translated_text || res.response);
      if (!t) throw new Error("ai_vuota");
      parti.push(String(t).trim());
    }
    out.push(parti.join(" "));
  }
  return out.join("\n");
}

export async function onRequestPost(ctx) {
  const { request } = ctx; const env = { ...ctx.env, ...cleanEnv(ctx.env) };
  const body = await request.json().catch(() => null);
  const lang = body && body.lang;
  if (!LANGS.includes(lang) || !Array.isArray(body.testi)) return json({ error: "richiesta" }, 400);
  const testi = [...new Set(body.testi.map(norm).filter((x) => x && x.length <= 2500))].slice(0, MAX_TESTI);
  if (!testi.length) return json({ lang, t: {} });
  const ids = await Promise.all(testi.map(async (x) => `${lang}:${await sha1(x)}`));
  const t = {};
  // 1) quelle già fatte
  let cache = [];
  try { cache = await anon(`traduzioni?select=id,testo&id=in.(${ids.map(encodeURIComponent).join(",")})`); } catch (_) {}
  const byId = Object.fromEntries((cache || []).map((r) => [r.id, r.testo]));
  const mancanti = [];
  testi.forEach((x, i) => { if (byId[ids[i]]) t[x] = byId[ids[i]]; else mancanti.push(i); });
  // 2) le nuove, se Workers AI è collegato
  if (mancanti.length && !env.AI) return json({ lang, t, ai: false });
  if (mancanti.length) {
    const ok = await testiAmmessi().catch(() => new Set());
    const nuove = [];
    for (const i of mancanti.filter((i) => ok.has(testi[i])).slice(0, MAX_NUOVI)) {
      try { const tr = await traduci(env.AI, testi[i], lang); t[testi[i]] = tr; nuove.push({ id: ids[i], testo: tr }); } catch (_) { break; } // quota finita o modello lento: riproverà la prossima volta
    }
    if (nuove.length && env.LB_ADMIN_EMAIL && env.LB_ADMIN_PASSWORD) {
      const save = rest(env, "traduzioni?on_conflict=id", { method: "POST", body: nuove, prefer: "resolution=merge-duplicates,return=minimal" }).catch(() => {});
      ctx.waitUntil ? ctx.waitUntil(save) : await save;
    }
  }
  return json({ lang, t });
}
