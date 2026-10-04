// Libere Botteghe — bot Telegram del gestore.
// Gira su Cloudflare Pages (functions/api/telegram/[[path]].js) e usa queste variabili
// (Cloudflare → progetto → Settings → Variables and Secrets). Nessuna è scritta nel codice:
//   TELEGRAM_BOT_TOKEN   il token che dà BotFather
//   TELEGRAM_SECRET      una parola segreta lunga: protegge il bot e gli avvisi del database
//   TELEGRAM_ADMIN_CHAT  il tuo codice chat (te lo dice il bot al primo /start)
//   LB_ADMIN_EMAIL       email del gestore del sito (quella che apre la pagina Gestione)
//   LB_ADMIN_PASSWORD    password di quell'account
//   ANTHROPIC_API_KEY    facoltativa: per le domande libere
// Il bot entra in Supabase come il gestore (stesse regole di sicurezza della pagina Gestione):
// non usa mai chiavi di servizio.

const SUPABASE_URL = "https://rvfwfpndvvpdwobkmxus.supabase.co";
const SUPABASE_KEY = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8";
const SITE = "https://liberebotteghe.it";
const MODEL = "claude-haiku-4-5-20251001";
const TZ = "Europe/Rome";

const CONTATTI = { whatsapp: "WhatsApp", telefono: "Telefono", maps: "Maps", email: "Email", instagram: "Instagram", sito: "Sito", copia: "Copiati", contatto: "Altri" };

/* ---------------- utilità ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const day = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); return d.toLocaleDateString("sv-SE", { timeZone: TZ }); };
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" }) : "";
const finoAl = (iso) => { const t = fmtDate(iso); return /^(1|8|11)\s/.test(t) ? `fino all'${t}` : `fino al ${t}`; };
const stars = (n) => "★".repeat(Math.max(0, Math.min(5, n | 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n | 0)));
const shopUrl = (id) => `${SITE}/b/${id}`;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ---------------- Supabase, entrando come gestore ---------------- */
let session = { token: null, exp: 0, key: null };
async function login(env) {
  const key = `${env.LB_ADMIN_EMAIL}\n${env.LB_ADMIN_PASSWORD}`;
  if (session.token && session.exp > Date.now() + 60000 && session.key === key) return session.token;
  if (!env.LB_ADMIN_EMAIL || !env.LB_ADMIN_PASSWORD) throw new Error("manca_login");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: env.LB_ADMIN_EMAIL, password: env.LB_ADMIN_PASSWORD }), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("login_fallito");
  const j = await r.json();
  session = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, key };
  return session.token;
}
async function rest(env, path, { method = "GET", body, prefer } = {}) {
  const token = await login(env);
  const headers = { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (prefer) headers.prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`db_${r.status}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
const loadShops = async (env) => ((await rest(env, "botteghe?select=id,data")) || []).filter((r) => r.data && r.data.nome);
const loadCfg = async (env) => (((await rest(env, "config?id=eq.sito&select=data")) || [])[0] || {}).data || {};
const saveCfg = (env, data) => rest(env, "config?on_conflict=id", { method: "POST", body: [{ id: "sito", data }], prefer: "resolution=merge-duplicates,return=minimal" });

async function removeShop(env, id) {
  const rows = await rest(env, `botteghe?id=eq.${id}&select=data`);
  const d = rows && rows[0] && rows[0].data;
  if (!d) return null;
  const files = (d.prodotti || []).filter((p) => p && p.fotoV).map((p) => `${id}/${p.id}.jpg`);
  if (d.coverV) files.push(`${id}/_cover.jpg`);
  if (d.bannerV) files.push(`${id}/_banner.jpg`);
  await rest(env, `botteghe?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (files.length) {
    const token = await login(env);
    await fetch(`${SUPABASE_URL}/storage/v1/object/foto`, { method: "DELETE", headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ prefixes: files }) }).catch(() => {});
  }
  return d.nome;
}

/* ---------------- Telegram ---------------- */
async function tg(env, method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  return r.json().catch(() => ({}));
}
const clipMsg = (t) => { t = String(t || ""); if (t.length <= 3900) return t; const cut = t.slice(0, 3900); return cut.slice(0, Math.max(cut.lastIndexOf("\n"), 3000)) + "\n…"; };
const send = (env, chat, text, buttons) => tg(env, "sendMessage", { chat_id: chat, text: clipMsg(text), parse_mode: "HTML", disable_web_page_preview: true, ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
const MENU = [
  [{ text: "📊 Oggi", callback_data: "st:1" }, { text: "📊 7 giorni", callback_data: "st:7" }, { text: "📊 30 giorni", callback_data: "st:30" }],
  [{ text: "🏪 Botteghe", callback_data: "bt" }, { text: "🏆 Vetrina", callback_data: "vt" }, { text: "⭐ Recensioni", callback_data: "rc" }],
];

/* ---------------- statistiche ---------------- */
async function statsText(env, days) {
  const from = day(-(days - 1));
  const [rows, sito, shops] = await Promise.all([
    rest(env, `statistiche?select=bottega_id,tipo,fonte,conteggio,giorno&giorno=gte.${from}`),
    rest(env, `visite_sito?select=fonte,conteggio,giorno&giorno=gte.${from}`).catch(() => null),
    loadShops(env),
  ]);
  const names = Object.fromEntries(shops.map((s) => [s.id, s.data.nome]));
  const per = {}; for (const r of rows || []) per[r.tipo] = (per[r.tipo] || 0) + r.conteggio;
  const visSito = sito ? sito.reduce((a, r) => a + r.conteggio, 0) : null;
  const ordini = (per.ordine || 0) + (per.ordine_copia || 0);
  const contatti = Object.keys(CONTATTI).reduce((a, k) => a + (per[k] || 0), 0);
  const fonti = {}; for (const r of sito || []) fonti[r.fonte || "diretto"] = (fonti[r.fonte || "diretto"] || 0) + r.conteggio;
  const byShop = {}; for (const r of rows || []) { const o = byShop[r.bottega_id] = byShop[r.bottega_id] || { v: 0, c: 0 }; if (r.tipo === "visita") o.v += r.conteggio; else if (r.tipo !== "condivisione") o.c += r.conteggio; }
  const top = Object.entries(byShop).sort((a, b) => (b[1].c - a[1].c) || (b[1].v - a[1].v)).slice(0, 5);
  const label = days === 1 ? "Oggi" : `Ultimi ${days} giorni`;
  const canali = Object.entries(CONTATTI).filter(([k]) => per[k]).map(([k, l]) => `${l} ${per[k]}`).join(" · ");
  return [
    `📊 <b>${label}</b>`,
    `👀 Visite al sito: <b>${visSito === null ? "—" : visSito}</b>`,
    `🏪 Visite alle botteghe: <b>${per.visita || 0}</b>`,
    `🛒 Ordini avviati dal cestino: <b>${ordini}</b>`,
    `📞 Contatti: <b>${contatti}</b>${canali ? `\n     ${canali}` : ""}`,
    Object.keys(fonti).length ? `\n🧭 <b>Da dove arrivano</b>\n${Object.entries(fonti).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => `• ${esc(f)}: ${n}`).join("\n")}` : "",
    top.length ? `\n🏆 <b>Botteghe più cercate</b>\n${top.map(([id, o], i) => `${i + 1}. ${esc(names[id] || "(chiusa)")} — ${o.v} visite, ${o.c} contatti`).join("\n")}` : "",
    visSito === null ? "\n<i>Le visite al sito compaiono dopo aver eseguito in Supabase il file sql/2026-10-tracciamento.sql.</i>" : "",
  ].filter(Boolean).join("\n");
}

/* ---------------- botteghe e vetrina ---------------- */
function featState(cfg, id) {
  const t = day(); const e = (cfg.evidenza || {})[id];
  return { botm: cfg.mese === id && (!cfg.meseFino || cfg.meseFino >= t), ev: !!(e && (!e.fino || e.fino >= t)), fino: e && e.fino };
}
async function shopsList(env) {
  const [shops, cfg] = await Promise.all([loadShops(env), loadCfg(env)]);
  shops.sort((a, b) => String(a.data.nome).localeCompare(String(b.data.nome), "it"));
  if (!shops.length) return { text: "Non ci sono ancora botteghe aperte." };
  const text = `🏪 <b>Botteghe aperte: ${shops.length}</b>\n` + shops.map(({ id, data: d }) => {
    const f = featState(cfg, id); const n = (d.prodotti || []).length;
    return `• <a href="${shopUrl(id)}">${esc(d.nome)}</a>${d.paese ? ` — ${esc(d.paese)}` : ""} · ${n} ${n === 1 ? "articolo" : "articoli"}${f.botm ? " 🏆" : ""}${f.ev ? " ⭐" : ""}`;
  }).join("\n") + "\n\nTocca una bottega per gestirla:";
  const buttons = shops.slice(0, 40).map(({ id, data: d }) => [{ text: d.nome.slice(0, 40), callback_data: `sh:${id}` }]);
  return { text, buttons };
}
async function shopCard(env, id) {
  const [rows, cfg] = await Promise.all([rest(env, `botteghe?id=eq.${id}&select=data`), loadCfg(env)]);
  const d = rows && rows[0] && rows[0].data;
  if (!d || !d.nome) return { text: "Questa bottega non esiste più." };
  const f = featState(cfg, id); const ps = d.prodotti || [];
  const exps = ps.filter((p) => p.tipo === "esperienza").length;
  const text = [
    `🏪 <b>${esc(d.nome)}</b>`,
    [d.categoria, d.paese, d.produttore && `di ${d.produttore}`].filter(Boolean).map(esc).join(" · "),
    `${ps.length - exps} prodotti · ${exps} esperienze`,
    f.botm ? `🏆 Bottega del mese${cfg.meseFino ? ` ${finoAl(cfg.meseFino)}` : ""}` : "",
    f.ev ? `⭐ In evidenza${f.fino ? ` ${finoAl(f.fino)}` : ""}` : "",
    d.fondatrice ? "🌿 Bottega fondatrice" : "",
    shopUrl(id),
  ].filter(Boolean).join("\n");
  const buttons = [
    [{ text: "⭐ Evidenza 7 gg", callback_data: `ev:${id}:7` }, { text: "⭐ 30 gg", callback_data: `ev:${id}:30` }, ...(f.ev ? [{ text: "Togli ⭐", callback_data: `ev:${id}:0` }] : [])],
    [f.botm ? { text: "Togli 🏆 Bottega del mese", callback_data: "bm:-" } : { text: "🏆 Bottega del mese (30 gg)", callback_data: `bm:${id}` }],
    [{ text: "🗑 Rimuovi dal mercato", callback_data: `rm?:${id}` }],
  ];
  return { text, buttons };
}
async function vetrinaText(env) {
  const [shops, cfg] = await Promise.all([loadShops(env), loadCfg(env)]);
  const names = Object.fromEntries(shops.map((s) => [s.id, s.data.nome])); const t = day();
  const botm = cfg.mese && names[cfg.mese] && (!cfg.meseFino || cfg.meseFino >= t);
  const ev = Object.entries(cfg.evidenza || {}).filter(([id, e]) => names[id] && (!e.fino || e.fino >= t));
  const text = [
    "🏆 <b>Vetrina</b>",
    botm ? `Bottega del mese: <b>${esc(names[cfg.mese])}</b>${cfg.meseFino ? ` ${finoAl(cfg.meseFino)}` : ""}` : "Bottega del mese: nessuna",
    ev.length ? `\n⭐ In evidenza:\n${ev.map(([id, e]) => `• ${esc(names[id])}${e.fino ? ` ${finoAl(e.fino)}` : ""}`).join("\n")}` : "\n⭐ Nessuna bottega in evidenza.",
    "\nPer cambiare: 🏪 Botteghe → tocca una bottega.",
  ].join("\n");
  return { text, buttons: botm ? [[{ text: "Togli la Bottega del mese", callback_data: "bm:-" }]] : null };
}
async function setEvidenza(env, id, days) {
  const cfg = await loadCfg(env); cfg.evidenza = cfg.evidenza || {};
  if (days > 0) cfg.evidenza[id] = { fino: addDays(day(), days) }; else delete cfg.evidenza[id];
  await saveCfg(env, cfg); return days > 0 ? cfg.evidenza[id].fino : null;
}
async function setBotm(env, id, days = 30) {
  const cfg = await loadCfg(env);
  if (id) { cfg.mese = id; cfg.meseFino = addDays(day(), days); } else { cfg.mese = null; cfg.meseFino = null; }
  await saveCfg(env, cfg); return cfg.meseFino;
}

/* ---------------- recensioni ---------------- */
async function reviewsText(env) {
  const [rows, shops] = await Promise.all([rest(env, "recensioni?select=id,bottega_id,nome,voto,testo,risposta,created_at&order=created_at.desc&limit=6"), loadShops(env)]);
  const names = Object.fromEntries(shops.map((s) => [s.id, s.data.nome]));
  if (!rows || !rows.length) return { text: "⭐ Nessuna recensione ancora." };
  const text = "⭐ <b>Ultime recensioni</b>\n\n" + rows.map((r, i) => `${i + 1}. ${stars(r.voto)} <b>${esc(names[r.bottega_id] || "(bottega chiusa)")}</b>\n${esc(r.nome || "Anonimo")}: «${esc(String(r.testo || "").slice(0, 220))}»${r.risposta ? "\n↳ ha risposto la bottega" : ""}`).join("\n\n");
  const buttons = [rows.map((r, i) => ({ text: `🗑 ${i + 1}`, callback_data: `rv?:${r.id}` }))];
  return { text: text + "\n\nPer eliminare una recensione tocca il suo numero:", buttons };
}

/* ---------------- domande libere (facoltativo) ---------------- */
const TOOLS = [
  { name: "metti_in_evidenza", description: "Mette una bottega in evidenza per un numero di giorni (0 per toglierla).", input_schema: { type: "object", properties: { bottega_id: { type: "string" }, giorni: { type: "integer" } }, required: ["bottega_id", "giorni"] } },
  { name: "bottega_del_mese", description: "Imposta la Bottega del mese per 30 giorni. bottega_id vuoto per toglierla.", input_schema: { type: "object", properties: { bottega_id: { type: "string" } }, required: ["bottega_id"] } },
  { name: "rimuovi_bottega", description: "Rimuove una bottega dal mercato (chiede sempre conferma al gestore).", input_schema: { type: "object", properties: { bottega_id: { type: "string" } }, required: ["bottega_id"] } },
];
async function askAI(env, question) {
  if (!env.ANTHROPIC_API_KEY) return { text: "Per le domande libere aggiungi in Cloudflare la variabile ANTHROPIC_API_KEY. Intanto usa il menu:", buttons: MENU };
  const from = day(-29);
  const [shops, cfg, rows, sito, revs] = await Promise.all([
    loadShops(env), loadCfg(env),
    rest(env, `statistiche?select=bottega_id,tipo,fonte,conteggio,giorno&giorno=gte.${from}`),
    rest(env, `visite_sito?select=fonte,conteggio,giorno&giorno=gte.${from}`).catch(() => []),
    rest(env, "recensioni?select=bottega_id,voto,testo,created_at&order=created_at.desc&limit=20").catch(() => []),
  ]);
  const ctx = {
    oggi: day(),
    botteghe: shops.map(({ id, data: d }) => ({ id, nome: d.nome, categoria: d.categoria, paese: d.paese, prodotti: (d.prodotti || []).filter((p) => p.tipo !== "esperienza").length, esperienze: (d.prodotti || []).filter((p) => p.tipo === "esperienza").length, aggiornata: d.aggiornata ? new Date(d.aggiornata).toISOString().slice(0, 10) : null, ...featState(cfg, id) })),
    statistiche_botteghe_30gg: rows, visite_sito_30gg: sito, recensioni_recenti: revs,
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 700, tools: TOOLS,
      system: `Sei l'assistente del gestore di Libere Botteghe (${SITE}), mercato online di artigiani. Rispondi in italiano, breve e concreto, testo semplice senza markdown. Usa SOLO i dati qui sotto; i conteggi sono per giorno (giorno in formato AAAA-MM-GG). Se il gestore chiede di cambiare la vetrina o rimuovere una bottega, usa lo strumento adatto: il bot gli chiederà conferma prima di farlo.\n\nDATI:\n${JSON.stringify(ctx).slice(0, 60000)}`,
      messages: [{ role: "user", content: String(question).slice(0, 1500) }],
    }), signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) return { text: "L'assistente non risponde in questo momento. Usa il menu:", buttons: MENU };
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
  const names = Object.fromEntries(shops.map((s) => [s.id, s.data.nome]));
  const buttons = [];
  for (const c of (j.content || []).filter((c) => c.type === "tool_use")) {
    const id = String(c.input.bottega_id || "");
    if (id && !names[id]) continue;
    if (c.name === "metti_in_evidenza") { const g = Math.max(0, Math.min(365, c.input.giorni | 0)); buttons.push([{ text: g ? `✅ Metti ⭐ ${names[id]} per ${g} gg` : `✅ Togli ⭐ a ${names[id]}`, callback_data: `ev:${id}:${g}` }]); }
    if (c.name === "bottega_del_mese") buttons.push([{ text: id ? `✅ ${names[id]} Bottega del mese` : "✅ Togli la Bottega del mese", callback_data: id ? `bm:${id}` : "bm:-" }]);
    if (c.name === "rimuovi_bottega" && id) buttons.push([{ text: `🗑 Rimuovi ${names[id]}…`, callback_data: `rm?:${id}` }]);
  }
  return { text: esc(text || (buttons.length ? "Confermi?" : "Non ho una risposta.")), buttons: buttons.length ? buttons : null };
}

/* ---------------- gestione degli aggiornamenti di Telegram ---------------- */
async function onCallback(env, cb) {
  const chat = cb.message.chat.id; const d = cb.data || "";
  const answer = (text) => tg(env, "answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) });
  try {
    if (d.startsWith("st:")) { await answer(); return send(env, chat, await statsText(env, +d.slice(3) || 7), MENU); }
    if (d === "bt") { await answer(); const r = await shopsList(env); return send(env, chat, r.text, r.buttons); }
    if (d === "vt") { await answer(); const r = await vetrinaText(env); return send(env, chat, r.text, r.buttons); }
    if (d === "rc") { await answer(); const r = await reviewsText(env); return send(env, chat, r.text, r.buttons); }
    if (d.startsWith("sh:")) { await answer(); const r = await shopCard(env, d.slice(3)); return send(env, chat, r.text, r.buttons); }
    if (d.startsWith("ev:")) { const [, id, g] = d.split(":"); const fino = await setEvidenza(env, id, +g); await answer(fino ? "In evidenza" : "Evidenza tolta"); const r = await shopCard(env, id); return send(env, chat, (fino ? `⭐ Fatto: in evidenza ${finoAl(fino)}.\n\n` : "Fatto: evidenza tolta.\n\n") + r.text, r.buttons); }
    if (d.startsWith("bm:")) { const id = d.slice(3); const fino = await setBotm(env, id === "-" ? null : id); await answer("Fatto"); if (id === "-") return send(env, chat, "🏆 Bottega del mese tolta.", MENU); const r = await shopCard(env, id); return send(env, chat, `🏆 Fatto: Bottega del mese ${finoAl(fino)}.\n\n` + r.text, r.buttons); }
    if (d.startsWith("rm?:")) { await answer(); const id = d.slice(4); const r = await shopCard(env, id); return send(env, chat, `⚠️ Vuoi davvero rimuovere questa bottega dal mercato? Spariscono anche prodotti e foto, e non si può annullare.\n\n${r.text}`, [[{ text: "Sì, rimuovi", callback_data: `rm!:${id}` }, { text: "Annulla", callback_data: "x" }]]); }
    if (d.startsWith("rm!:")) { const nome = await removeShop(env, d.slice(4)); await answer(nome ? "Rimossa" : "Non trovata"); return send(env, chat, nome ? `🗑 «${esc(nome)}» è stata rimossa dal mercato.` : "Questa bottega non c'era più.", MENU); }
    if (d.startsWith("rv?:")) { await answer(); const id = d.slice(4); return send(env, chat, "Eliminare questa recensione?", [[{ text: "Sì, elimina", callback_data: `rv!:${id}` }, { text: "Annulla", callback_data: "x" }]]); }
    if (d.startsWith("rv!:")) { await rest(env, `recensioni?id=eq.${encodeURIComponent(d.slice(4))}`, { method: "DELETE", prefer: "return=minimal" }); await answer("Eliminata"); return send(env, chat, "🗑 Recensione eliminata.", MENU); }
    if (d === "x") { await answer("Annullato"); return; }
    await answer();
  } catch (e) { await answer("Errore"); return send(env, chat, errText(e), MENU); }
}
function errText(e) {
  const m = String(e && e.message || e);
  if (m === "manca_login") return "⚠️ Mancano LB_ADMIN_EMAIL e LB_ADMIN_PASSWORD nelle variabili di Cloudflare.";
  if (m === "login_fallito") return "⚠️ Non riesco a entrare nel sito: controlla LB_ADMIN_EMAIL e LB_ADMIN_PASSWORD in Cloudflare (l'account deve avere una password).";
  if (/db_40[13]/.test(m)) return "⚠️ Il database rifiuta l'operazione: l'account indicato in LB_ADMIN_EMAIL non risulta gestore.";
  return "⚠️ Qualcosa non ha funzionato, riprova tra poco.";
}
async function onMessage(env, msg) {
  const chat = msg.chat.id; const text = String(msg.text || "").trim();
  if (!env.TELEGRAM_ADMIN_CHAT) return send(env, chat, `Ciao! Il tuo codice chat è <code>${chat}</code>.\nInseriscilo in Cloudflare come variabile <b>TELEGRAM_ADMIN_CHAT</b>, poi scrivimi di nuovo /start.`);
  if (String(chat) !== String(env.TELEGRAM_ADMIN_CHAT)) return send(env, chat, "Questo bot è riservato al gestore di Libere Botteghe.");
  try {
    const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");
    if (!text || cmd === "/start" || cmd === "/menu" || cmd === "/aiuto") return send(env, chat, "👋 <b>Libere Botteghe</b> — cosa vuoi vedere?\nPuoi anche scrivermi una domanda, per esempio «quante visite ieri?» o «metti in evidenza la bottega X per una settimana».", MENU);
    if (cmd === "/oggi") return send(env, chat, await statsText(env, 1), MENU);
    if (cmd === "/settimana" || cmd === "/statistiche") return send(env, chat, await statsText(env, 7), MENU);
    if (cmd === "/mese") return send(env, chat, await statsText(env, 30), MENU);
    if (cmd === "/botteghe") { const r = await shopsList(env); return send(env, chat, r.text, r.buttons); }
    if (cmd === "/vetrina") { const r = await vetrinaText(env); return send(env, chat, r.text, r.buttons); }
    if (cmd === "/recensioni") { const r = await reviewsText(env); return send(env, chat, r.text, r.buttons); }
    if (cmd === "/bottega") {
      const q = norm(text.slice(cmd.length)); const shops = await loadShops(env);
      const hit = shops.find((s) => norm(s.data.nome).includes(q));
      if (!q || !hit) return send(env, chat, "Scrivi /bottega seguito da una parte del nome, per esempio /bottega wild area.");
      const r = await shopCard(env, hit.id); return send(env, chat, r.text, r.buttons);
    }
    await tg(env, "sendChatAction", { chat_id: chat, action: "typing" });
    const r = await askAI(env, text); return send(env, chat, r.text, r.buttons);
  } catch (e) { return send(env, chat, errText(e), MENU); }
}

/* ---------------- avvisi dal database (trigger in Supabase) ---------------- */
async function onNotify(env, ev) {
  const chat = env.TELEGRAM_ADMIN_CHAT; if (!chat) return;
  const t = ev.table, op = ev.type, rec = ev.record || {}, old = ev.old_record || {};
  if (t === "botteghe") {
    const d = rec.data || {}, o = old.data || {};
    if (op === "DELETE") { if (o.nome) await send(env, chat, `🚪 Bottega chiusa: <b>${esc(o.nome)}</b>`); return; }
    if (!d.nome) return;
    if (op === "INSERT" || !o.nome) {
      return send(env, chat, `🎉 <b>Nuova bottega aperta!</b>\n<b>${esc(d.nome)}</b>\n${[d.categoria, d.paese, d.produttore && "di " + d.produttore].filter(Boolean).map(esc).join(" · ")}\n${shopUrl(rec.id)}`, [[{ text: "Gestisci", callback_data: `sh:${rec.id}` }]]);
    }
    const oldIds = new Set((o.prodotti || []).map((p) => p && p.id));
    const nuovi = (d.prodotti || []).filter((p) => p && p.id && !oldIds.has(p.id));
    if (nuovi.length) return send(env, chat, `🆕 <b>${esc(d.nome)}</b> ha messo sul banco:\n${nuovi.slice(0, 8).map((p) => `• ${p.tipo === "esperienza" ? "🎟 " : ""}${esc(p.nome)} — ${Number(p.prezzo || 0).toFixed(2).replace(".", ",")} €`).join("\n")}\n${shopUrl(rec.id)}`);
    return;
  }
  if (t === "recensioni" && op === "INSERT") {
    let nome = ""; try { const s = await rest(env, `botteghe?id=eq.${rec.bottega_id}&select=data`); nome = s && s[0] && s[0].data && s[0].data.nome || ""; } catch (_) {}
    return send(env, chat, `⭐ <b>Nuova recensione</b> ${stars(rec.voto)}\n${nome ? `per <b>${esc(nome)}</b>\n` : ""}${esc(rec.nome || "Anonimo")}: «${esc(String(rec.testo || "").slice(0, 400))}»`, [[{ text: "Vedi le recensioni", callback_data: "rc" }]]);
  }
}

/* ---------------- punto d'ingresso ---------------- */
const eq = (a, b) => { a = String(a || ""); b = String(b || ""); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

/* valori copiati dal telefono: spesso hanno spazi, a capo o virgolette in più */
const clean = (v) => String(v || "").replace(/[\s"'«»“”]+/g, "").replace(/^bot(?=\d)/i, "");
export async function handle(request, rawEnv, sub, waitUntil = (p) => p) {
  const env = { ...rawEnv, TELEGRAM_BOT_TOKEN: clean(rawEnv.TELEGRAM_BOT_TOKEN), TELEGRAM_SECRET: clean(rawEnv.TELEGRAM_SECRET), TELEGRAM_ADMIN_CHAT: clean(rawEnv.TELEGRAM_ADMIN_CHAT), LB_ADMIN_EMAIL: String(rawEnv.LB_ADMIN_EMAIL || "").trim(), LB_ADMIN_PASSWORD: String(rawEnv.LB_ADMIN_PASSWORD || "").replace(/^\s+|\s+$/g, "") };
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_SECRET) {
    const seen = Object.keys(rawEnv || {}).filter((k) => /^(TELEGRAM|LB_|ANTHROPIC)/.test(k)).sort();
    const miss = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_SECRET"].filter((k) => !env[k]);
    return new Response(`Bot non configurato: manca ${miss.join(" e ")}.\nVariabili che il sito vede adesso: ${seen.length ? seen.join(", ") : "nessuna"}.`, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const url = new URL(request.url);

  // 1) collegamento del bot: apri una volta https://liberebotteghe.it/api/telegram/setup?key=TELEGRAM_SECRET
  if (sub === "setup") {
    if (!eq(url.searchParams.get("key"), env.TELEGRAM_SECRET)) return new Response("Chiave sbagliata.", { status: 403 });
    if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(env.TELEGRAM_BOT_TOKEN)) return new Response(`❌ Il token in TELEGRAM_BOT_TOKEN non ha la forma giusta (deve essere tipo 123456789:AAH…, lungo circa 46 caratteri; ora è lungo ${env.TELEGRAM_BOT_TOKEN.length}). Ricopialo da BotFather con /mybots → il tuo bot → API Token.`, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    const me = await tg(env, "getMe", {});
    if (!me || !me.ok) return new Response(`❌ Telegram non riconosce il token (${me && me.description || "nessuna risposta"}). Ricopialo da BotFather con /mybots → il tuo bot → API Token, e aggiornalo in Cloudflare.`, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    const hook = await tg(env, "setWebhook", { url: `${url.origin}/api/telegram`, secret_token: env.TELEGRAM_SECRET, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
    await tg(env, "setMyCommands", { commands: [
      { command: "menu", description: "Menu principale" }, { command: "oggi", description: "Statistiche di oggi" },
      { command: "settimana", description: "Statistiche degli ultimi 7 giorni" }, { command: "mese", description: "Statistiche degli ultimi 30 giorni" },
      { command: "botteghe", description: "Elenco e gestione delle botteghe" }, { command: "vetrina", description: "Bottega del mese e in evidenza" },
      { command: "recensioni", description: "Ultime recensioni" },
    ] });
    const ok = hook && hook.ok;
    return new Response(ok ? `✅ Bot collegato! Ora apri Telegram e scrivi /start a @${me.result.username}.` : `❌ Collegamento non riuscito: ${hook && hook.description || "controlla TELEGRAM_BOT_TOKEN"}`, { status: ok ? 200 : 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // 2) avvisi dal database
  if (sub === "notify") {
    if (!eq(request.headers.get("x-lb-secret"), env.TELEGRAM_SECRET)) return new Response("no", { status: 403 });
    const ev = await request.json().catch(() => null);
    if (ev) waitUntil(onNotify(env, ev).catch(() => {})); // un avviso perso non blocca il database
    return new Response("ok");
  }

  // 3) messaggi da Telegram
  if (!eq(request.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_SECRET)) return new Response("no", { status: 403 });
  const up = await request.json().catch(() => null);
  /* rispondiamo subito a Telegram e lavoriamo dopo: così non rimanda lo stesso messaggio due volte */
  if (up && up.callback_query) {
    if (env.TELEGRAM_ADMIN_CHAT && String(up.callback_query.message?.chat?.id) === String(env.TELEGRAM_ADMIN_CHAT)) waitUntil(onCallback(env, up.callback_query).catch(() => {}));
  } else if (up && up.message && up.message.chat) waitUntil(onMessage(env, up.message).catch(() => {}));
  return new Response("ok");
}
