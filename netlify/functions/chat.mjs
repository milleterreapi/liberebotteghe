// Libere Botteghe — assistente con intelligenza artificiale.
// Si attiva solo se su Netlify è impostata la variabile ANTHROPIC_API_KEY
// (Project configuration → Environment variables). Senza chiave risponde 503
// e il sito usa le risposte automatiche già incluse in chat.js.
const SUPABASE_URL = "https://rvfwfpndvvpdwobkmxus.supabase.co";
const SUPABASE_KEY = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8";
const SITE = "https://liberebotteghe.it";
const MODEL = "claude-haiku-4-5-20251001"; // veloce ed economico
const LANG_NAME = { it: "italiano", en: "English", fr: "français", de: "Deutsch" };

let cache = { at: 0, text: "" };
async function catalog() {
  if (Date.now() - cache.at < 5 * 60 * 1000 && cache.text) return cache.text;
  try {
    const h = { apikey: SUPABASE_KEY };
    const [shops, cfg] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/botteghe?select=id,data`, { headers: h, signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.sito&select=data`, { headers: h, signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : [])),
    ]);
    const lines = [];
    for (const { id, data: d } of shops || []) {
      if (!d || !d.nome) continue;
      lines.push(`BOTTEGA "${d.nome}" — ${d.categoria || "Artigianato"}${d.paese ? ", " + d.paese : ""}${d.produttore ? ", di " + d.produttore : ""} — ${SITE}/b/${id}`
        + (d.descrizione ? `\n  Descrizione: ${String(d.descrizione).slice(0, 300)}` : "")
        + (d.consegna ? `\n  Consegna: ${String(d.consegna).slice(0, 200)}` : "")
        + (d.whatsapp ? "\n  Ordini: su WhatsApp dal cestino" : ""));
      for (const p of (d.prodotti || []).slice(0, 60)) {
        if (!p || !p.nome) continue;
        lines.push(`  - ${p.tipo === "esperienza" ? "[ESPERIENZA" + (p.durata ? ", " + p.durata : "") + (p.quando ? ", " + p.quando : "") + (p.posti ? ", max " + p.posti + " persone" : "") + (p.incluso ? ", incluso: " + p.incluso : "") + (p.lingue ? ", lingue: " + p.lingue : "") + "] " : ""}${p.nome}: ${Number(p.prezzo || 0).toFixed(2)} €${p.unita ? " / " + p.unita : ""}${p.disponibile === false ? " (esaurito)" : ""}${p.descrizione ? " — " + String(p.descrizione).slice(0, 140) : ""} — ${SITE}/b/${id}/p/${encodeURIComponent(p.id)}`);
      }
    }
    const c = (cfg && cfg[0] && cfg[0].data) || {};
    const piani = (c.piani && c.piani.length ? c.piani : [{ nome: "Bottega", prezzo: "9", periodo: "al mese" }, { nome: "In evidenza", prezzo: "15", periodo: "al mese" }, { nome: "Bottega del mese", prezzo: "29", periodo: "per un mese" }])
      .map((p) => `${p.nome}: ${p.prezzo} € ${p.periodo || ""}`).join("; ");
    const fondatrici = c.fondatrici !== false;
    cache = { at: Date.now(), text: `PIANI PER GLI ARTIGIANI: ${piani}.${fondatrici ? " Periodo di lancio attivo: chi apre ora è Bottega fondatrice e non paga nulla per 12 mesi." : ""}\n\nCATALOGO ATTUALE:\n${lines.join("\n") || "(ancora nessuna bottega aperta)"}` };
  } catch (_) { /* senza catalogo rispondiamo comunque */ }
  return cache.text;
}

const SYSTEM = (lang, cat, page) => `Sei l'assistente di Libere Botteghe (${SITE}), un mercato online di artigiani e piccoli produttori italiani. Rispondi in ${LANG_NAME[lang] || "italiano"}, con tono cordiale e semplice, in poche frasi (massimo 120 parole).

COME FUNZIONA IL SITO
- Ogni artigiano ha la sua bottega con foto, prezzi, storia, indirizzo sulla mappa e contatti.
- Il cliente mette i prodotti nel cestino; il messaggio d'ordine parte su WhatsApp direttamente all'artigiano. Pagamento, spedizione, resi e garanzia si concordano con l'artigiano.
- Libere Botteghe non vende, non incassa e non prende commissioni: ogni bottega è responsabile dei propri prodotti e delle proprie vendite.
- Ogni prodotto ha una pagina con «Aggiungi al cestino» e «Chiedi all'artigiano».
- Oltre ai prodotti ci sono le ESPERIENZE (corsi, visite guidate, laboratori, degustazioni): si prenotano con «Prenota su WhatsApp» dalla loro pagina, concordando data e numero di persone con l'artigiano.
- I visitatori possono salvare le botteghe preferite toccando il cuore; le ritrovano in ${SITE}/preferite (salvate sul loro dispositivo).
- Recensioni: le scrive chi entra con la propria email, una per bottega.
- Artigiani: aprono la bottega da ${SITE}/la-mia-bottega entrando con l'email. Prezzi in ${SITE}/prezzi.
- Il sito è in italiano, inglese, francese e tedesco. Pagine utili: ${SITE}/prodotti, ${SITE}/manifesto, ${SITE}/chi-siamo, ${SITE}/privacy.

REGOLE
- Consiglia solo prodotti e botteghe presenti nel catalogo qui sotto, con il loro link esatto. Non inventare prodotti, prezzi, tempi di spedizione o disponibilità.
- Se l'informazione non c'è, dillo e suggerisci di chiedere all'artigiano dalla sua pagina.
- Non conosci lo stato degli ordini: i pagamenti e gli ordini avvengono fuori dal sito, con l'artigiano.
- Non chiedere né raccogliere dati personali. Rispondi solo a domande su Libere Botteghe, artigianato e prodotti del catalogo; per altro, riporta gentilmente la conversazione sul sito.
- Scrivi testo semplice, senza titoli né elenchi lunghi. Metti i link come indirizzi completi.
${page && page.shopId ? `\nIl visitatore sta guardando: ${SITE}/b/${page.shopId}${page.prodId ? "/p/" + page.prodId : ""}` : ""}

${cat}`;

export default async (req, ctx) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const key = (ctx && ctx.env && typeof ctx.env === "object" && ctx.env.ANTHROPIC_API_KEY) // Cloudflare
    || (globalThis.Netlify && Netlify.env && Netlify.env.get("ANTHROPIC_API_KEY")) // Netlify
    || (typeof process !== "undefined" && process.env && process.env.ANTHROPIC_API_KEY);
  if (!key) return Response.json({ error: "assistant_off" }, { status: 503 });
  let body;
  try { body = await req.json(); } catch (_) { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return Response.json({ error: "bad_request" }, { status: 400 });
  const lang = ["it", "en", "fr", "de"].includes(body.lang) ? body.lang : "it";
  const page = body.page && typeof body.page === "object" ? { shopId: /^[0-9a-f-]{36}$/i.test(body.page.shopId || "") ? body.page.shopId : null, prodId: /^[A-Za-z0-9_-]{1,40}$/.test(body.page.prodId || "") ? body.page.prodId : null } : null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 450, system: SYSTEM(lang, await catalog(), page), messages }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return Response.json({ error: "upstream", status: r.status }, { status: 502 });
    const j = await r.json();
    const reply = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return Response.json({ reply }, { headers: { "cache-control": "no-store" } });
  } catch (_) {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
};

export const config = { path: "/api/chat" };
