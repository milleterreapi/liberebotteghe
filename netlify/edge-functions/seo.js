// Libere Botteghe — SEO.
// Per ogni pagina prepara sul server quello che serve a Google e ai social:
// titolo, descrizione, indirizzo canonico, lingue, dati strutturati (schema.org)
// e una versione già scritta del contenuto (botteghe, prodotti, indirizzi),
// che il sito poi sostituisce con la versione interattiva.
// Genera anche la mappa del sito: /sitemap.xml
// e le pagine per regione e mestiere: /artigiani/puglia, /artigianato/ceramica, /artigianato/ceramica/puglia
import "../../lib/luoghi.js";
const L = globalThis.LB_LUOGHI;
const SUPABASE_URL = "https://rvfwfpndvvpdwobkmxus.supabase.co";
const SUPABASE_KEY = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8";
const SITE = "https://liberebotteghe.it"; // dominio principale: gli indirizzi canonici puntano sempre qui
const LANGS = ["it", "en", "fr", "de"];
const BRAND = "Libere Botteghe";
const CLAIM = "Cose fatte a mano, una diversa dall'altra";

const PAGES = {
  "/": { t: `${BRAND} · ${CLAIM}`, d: "Il mercato online degli artigiani e dei piccoli produttori italiani: ceramiche, miele, tessuti, legno, gioielli e sapori fatti a mano. Trova la bottega più vicina sulla mappa e ordina direttamente all'artigiano." },
  "/prodotti": { t: `Prodotti artigianali fatti a mano · ${BRAND}`, d: "Tutti i prodotti delle botteghe artigiane italiane: ceramiche dipinte a mano, miele, tessuti, legno, cuoio, gioielli e prodotti tipici. Ordini direttamente al produttore." },
  "/manifesto": { t: `Il manifesto · ${BRAND}`, d: "Dieci ragioni per comprare da artigiani e piccoli produttori invece che dalla grande distribuzione. Scegliamo le mani, non gli scaffali." },
  "/chi-siamo": { t: `Chi siamo · ${BRAND}`, d: "Libere Botteghe dà a chi lavora con le mani una vetrina online tutta sua: niente intermediari e nessuna commissione sulle vendite." },
  "/prezzi": { t: `Apri la tua bottega online · ${BRAND}`, d: "Artigiano o piccolo produttore? Apri la tua bottega online con vetrina, mappa e ordini su WhatsApp. Gratis il primo anno per le Botteghe fondatrici." },
  "/privacy": { t: `Informativa privacy · ${BRAND}`, d: "Come Libere Botteghe tratta i dati personali di visitatori e artigiani." },
  "/termini": { t: `Condizioni d'uso · ${BRAND}`, d: "Le condizioni d'uso del mercato online Libere Botteghe." },
  "/cookie": { t: `Cookie · ${BRAND}`, d: "Gli strumenti tecnici e i contenuti esterni usati da Libere Botteghe." },
  "/storie": { t: `Storie di bottega: gli artigiani si raccontano · ${BRAND}`, d: "Le storie degli artigiani e dei piccoli produttori italiani: come hanno cominciato, com'è una giornata in laboratorio, cosa rende unico quello che fanno." },
  "/la-mia-bottega": { t: `La mia bottega · ${BRAND}`, d: "Area riservata agli artigiani di Libere Botteghe.", noindex: true },
  "/gestione": { t: `Gestione · ${BRAND}`, d: "Area riservata.", noindex: true },
  "/preferite": { t: `Le tue botteghe preferite · ${BRAND}`, d: "Le botteghe che hai messo tra le preferite su Libere Botteghe.", noindex: true },
};
const MAIN_LINKS = [["/", "Le botteghe"], ["/prodotti", "Tutti i prodotti"], ["/storie", "Storie di bottega"], ["/manifesto", "Il manifesto"], ["/chi-siamo", "Chi siamo"], ["/prezzi", "Apri la tua bottega"]];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const eur = (n) => (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const foto = (shop, key, v) => `${SUPABASE_URL}/storage/v1/object/public/foto/${shop}/${key}.jpg?v=${encodeURIComponent(v)}`;
const shopUrl = (id) => `${SITE}/b/${id}`;
const prodUrl = (id, pid) => `${SITE}/b/${id}/p/${encodeURIComponent(pid)}`;
// Le pagine pronte restano in memoria sulla rete di Netlify per un minuto (e si rinnovano in background):
// così quasi nessuna visita deve aspettare il database. Ogni nuova pubblicazione del sito svuota la memoria.
const CDN_CACHE = "public, durable, s-maxage=60, stale-while-revalidate=600";

// Se il database non risponde, la pagina esce comunque ma non viene messa in cache (st.miss, per ogni richiesta).
async function db(path, ms = 4000, st) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(ms) });
      if (r.ok) return await r.json();
    } catch (_) { /* riprova una volta */ }
  }
  if (st) st.miss = true; return null;
}
const loadShops = async (st) => ((await db("botteghe?select=id,data", 6000, st)) || []).filter((r) => r.data && r.data.nome);
const flat = (rows) => rows.map(({ id, data }) => ({ id, ...data }));
const luogoLabel = (cat, reg) => L.testiLuogo(cat, reg, []).h1;

function shopDesc(d) {
  const where = d.paese ? ` a ${d.paese}` : "";
  const base = `${d.categoria || "Artigianato"}${where}${d.produttore ? `, di ${d.produttore}` : ""}.`;
  return clip(`${d.nome}: ${base} ${d.descrizione || CLAIM + "."} Ordina direttamente all'artigiano su ${BRAND}.`, 160);
}

/* ---------- contenuto già scritto, per chi non esegue JavaScript ---------- */
const nav = () => `<nav class="ssr-nav" aria-label="Sezioni">${MAIN_LINKS.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join(" · ")}</nav>`;
function shopListHtml(shops) {
  return `<ul class="ssr-list">${shops.map(({ id, data: d }) => `<li><a href="/b/${esc(id)}"><b>${esc(d.nome)}</b></a> — ${esc(d.categoria || "Artigianato")}${d.paese ? ` · ${esc(d.paese)}` : ""}${d.descrizione ? `<br><span>${esc(clip(d.descrizione, 200))}</span>` : ""}</li>`).join("")}</ul>`;
}
function homeHtml(shops) {
  return `<div class="ssr wrap page">${nav()}
<p class="ssr-eyebrow">Il manifesto di ${BRAND} · il mercato degli artigiani e dei piccoli produttori italiani</p>
<h1>Scegliamo le mani, non gli scaffali.</h1>
<p>Compriamo da chi fa, non dalla grande distribuzione. Ogni acquisto in bottega sostiene un artigiano, una famiglia, un paese: qui niente è fatto in serie e ordini direttamente a chi lavora.</p>
<p><a href="/manifesto">Leggi il manifesto</a></p>
<p><b>Sei un artigiano? Apri la tua bottega gratis.</b> Gratis per il primo anno per le Botteghe fondatrici: vetrina, mappa e ordini su WhatsApp. <a href="/la-mia-bottega">Apri gratis la tua bottega</a></p>
${shops.length ? `<h2>Le botteghe</h2>${shopListHtml(shops)}` : ""}
${esploraHtml(flat(shops), null, null)}</div>`;
}
/* collegamenti alle pagine per regione e mestiere (solo quelle con almeno una bottega) */
function esploraHtml(all, cat, reg) {
  const ls = L.collegati(all, cat, reg);
  return ls.length ? `<h2>Esplora</h2><ul class="ssr-list">${ls.map(([h, l, n]) => `<li><a href="${esc(h)}">${esc(l)}</a> (${n})</li>`).join("")}</ul>` : "";
}
function luogoHtml(all, cat, reg, shops, t) {
  const items = [];
  shops.forEach((d) => (d.prodotti || []).forEach((p) => { if (p && p.nome && items.length < 40) items.push(`<li><a href="/b/${esc(d.id)}/p/${encodeURIComponent(p.id)}"><b>${esc(p.nome)}</b></a> — ${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""} · <a href="/b/${esc(d.id)}">${esc(d.nome)}</a></li>`); }));
  return `<div class="ssr wrap page">${nav()}
<p><a href="/">${BRAND}</a>${cat && reg ? ` › <a href="${L.luogoPath(cat, null)}">${esc(luogoLabel(cat, null))}</a>` : ""} › ${esc(t.h1)}</p>
<h1>${esc(t.h1)}</h1>
<p>${esc(t.intro)}</p>
${shops.length ? `<h2>Le botteghe</h2>${shopListHtml(shops.map((d) => ({ id: d.id, data: d })))}` : `<p><a href="/la-mia-bottega">Apri gratis la tua bottega</a></p>`}
${items.length ? `<h2>Prodotti ed esperienze</h2><ul class="ssr-list">${items.join("")}</ul>` : ""}
${esploraHtml(all, cat, reg)}</div>`;
}
function productsHtml(shops) {
  const items = [];
  shops.forEach(({ id, data: d }) => (d.prodotti || []).forEach((p) => { if (p && p.nome) items.push(`<li><a href="/b/${esc(id)}/p/${encodeURIComponent(p.id)}"><b>${esc(p.nome)}</b></a> — ${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""} · <a href="/b/${esc(id)}">${esc(d.nome)}</a>${p.descrizione ? `<br><span>${esc(clip(p.descrizione, 160))}</span>` : ""}</li>`); }));
  return `<div class="ssr wrap page">${nav()}<h1>Prodotti artigianali fatti a mano</h1>${items.length ? `<ul class="ssr-list">${items.join("")}</ul>` : "<p>I prodotti stanno arrivando.</p>"}</div>`;
}
function shopHtml(id, d) {
  const ps = (d.prodotti || []).filter((p) => p && p.nome);
  const addr = [d.indirizzo, d.paese].filter(Boolean).join(", ");
  return `<div class="ssr wrap page">${nav()}
<p><a href="/">← Tutte le botteghe</a></p>
<h1>${esc(d.nome)}</h1>
<p>${esc(d.categoria || "Artigianato")}${d.produttore ? ` · di ${esc(d.produttore)}` : ""}${d.paese ? ` · ${esc(d.paese)}` : ""}</p>
${d.descrizione ? `<p>${esc(d.descrizione)}</p>` : ""}
${luoghiShop(d)}
${L.storiaOk(d) ? `<p><a href="/storie/${esc(id)}">Leggi la storia di ${esc(d.nome)}</a></p>` : ""}
${addr ? `<p>Indirizzo: ${esc(addr)}</p>` : ""}
${d.consegna ? `<p>Consegna: ${esc(d.consegna)}</p>` : ""}
<h2>Prodotti</h2>${ps.length ? `<ul class="ssr-list">${ps.map((p) => `<li><a href="/b/${esc(id)}/p/${encodeURIComponent(p.id)}"><b>${esc(p.nome)}</b></a> — ${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""}${p.descrizione ? `<br><span>${esc(p.descrizione)}</span>` : ""}</li>`).join("")}</ul>` : "<p>Il banco è ancora vuoto.</p>"}</div>`;
}
/* ---------- storie degli artigiani ---------- */
const storiaUrl = (id) => `${SITE}/storie/${id}`;
const paeseDi = (d) => String(d.paese || "").replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
function storieHtml(shops) {
  const st = shops.filter(({ data: d }) => L.storiaOk(d));
  return `<div class="ssr wrap page">${nav()}<h1>Storie di bottega</h1><p>${esc(PAGES["/storie"].d)}</p>
${st.length ? `<ul class="ssr-list">${st.map(({ id, data: d }) => `<li><a href="/storie/${esc(id)}"><b>La storia di ${esc(d.nome)}</b></a> — ${esc(d.categoria || "Artigianato")}${d.paese ? ` · ${esc(paeseDi(d))}` : ""}<br><span>${esc(clip(L.storiaTesti(d)[0][2], 200))}</span></li>`).join("")}</ul>` : "<p>Le prime storie stanno arrivando.</p>"}</div>`;
}
function storiaHtml(id, d) {
  const ps = (d.prodotti || []).filter((p) => p && p.nome).slice(0, 8);
  return `<div class="ssr wrap page">${nav()}
<p><a href="/storie">← Storie di bottega</a></p>
<h1>La storia di ${esc(d.nome)}</h1>
<p>${esc(d.categoria || "Artigianato")}${d.produttore ? ` · ${esc(d.produttore)}` : ""}${d.paese ? ` · ${esc(paeseDi(d))}` : ""}</p>
${L.storiaTesti(d).map(([, q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join("\n")}
<p><a href="/b/${esc(id)}">Entra nella bottega di ${esc(d.nome)}</a></p>
${ps.length ? `<h2>Dal suo banco</h2><ul class="ssr-list">${ps.map((p) => `<li><a href="/b/${esc(id)}/p/${encodeURIComponent(p.id)}">${esc(p.nome)}</a> — ${eur(p.prezzo)}</li>`).join("")}</ul>` : ""}</div>`;
}
function luoghiShop(d) {
  const r = L.regioneDi(d), m = L.mestiere(d.categoria), ls = [];
  if (m) ls.push([L.luogoPath(m[1], r), luogoLabel(m[1], r)]);
  if (r) ls.push([L.luogoPath(null, r), luogoLabel(null, r)]);
  return ls.length ? `<p>${ls.map(([h, l]) => `<a href="${esc(h)}">${esc(l)}</a>`).join(" · ")}</p>` : "";
}
const simpleHtml = (h1, p) => `<div class="ssr wrap page">${nav()}<h1>${esc(h1)}</h1><p>${esc(p)}</p></div>`;

function productHtml(id, d, p) {
  const others = (d.prodotti || []).filter((x) => x && x.nome && x.id !== p.id).slice(0, 8);
  return `<div class="ssr wrap page">${nav()}
<p><a href="/b/${esc(id)}">← ${esc(d.nome)}</a></p>
<h1>${esc(p.nome)}</h1>
<p>${p.tipo === "esperienza" ? "Esperienza · " : ""}${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""}${p.disponibile === false ? " · Non disponibile" : ""}</p>
${p.tipo === "esperienza" ? `<p>${[p.durata && "Durata: " + esc(p.durata), p.quando && "Quando: " + esc(p.quando), p.posti && "Fino a " + esc(p.posti) + " persone", "Dove: " + esc(p.luogo || [d.indirizzo, d.paese].filter(Boolean).join(", ")), p.incluso && "Incluso: " + esc(p.incluso), p.portare && "Cosa portare: " + esc(p.portare), p.adatto && "Adatta a: " + esc(p.adatto), p.lingue && "Lingue: " + esc(p.lingue)].filter(Boolean).join(" · ")}</p>` : ""}
${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ""}
<p>${p.tipo === "esperienza" ? "Con" : "Fatto a mano da"} ${esc(d.produttore || d.nome)}${d.paese ? `, ${esc(d.paese)}` : ""}. ${d.categoria ? esc(d.categoria) + "." : ""}</p>
${d.consegna && p.tipo !== "esperienza" ? `<p>Consegna: ${esc(d.consegna)}</p>` : ""}
${others.length ? `<h2>Altro dalla bottega</h2><ul class="ssr-list">${others.map((x) => `<li><a href="/b/${esc(id)}/p/${encodeURIComponent(x.id)}">${esc(x.nome)}</a> — ${eur(x.prezzo)}</li>`).join("")}</ul>` : ""}</div>`;
}
function productDesc(d, p) {
  if (p.tipo === "esperienza") return clip(`${p.nome}${p.durata ? " (" + p.durata + ")" : ""}${p.descrizione ? ": " + p.descrizione : ""}. Esperienza con ${d.produttore || d.nome}${d.paese ? " a " + d.paese : ""}. Prenota su ${BRAND}.`, 160);
  return clip(`${p.nome}${p.descrizione ? ": " + p.descrizione : ""}. Fatto a mano da ${d.produttore || d.nome}${d.paese ? " a " + d.paese : ""}. Ordina direttamente all'artigiano su ${BRAND}.`, 160);
}

/* ---------- dati strutturati ---------- */
const orgLd = () => ({ "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: SITE + "/", logo: SITE + "/img/icon-512.png", description: PAGES["/"].d, sameAs: ["https://www.instagram.com/liberebotteghe/"] });
const siteLd = () => ({ "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: SITE + "/", inLanguage: "it-IT" });
function shopLd(id, d, reviews) {
  const o = {
    "@context": "https://schema.org", "@type": "Store", "@id": shopUrl(id) + "#bottega",
    name: d.nome, url: shopUrl(id), description: d.descrizione || shopDesc(d),
    image: d.bannerV ? foto(id, "_banner", d.bannerV) : d.coverV ? foto(id, "_cover", d.coverV) : SITE + "/og.png",
    ...(d.coverV ? { logo: foto(id, "_cover", d.coverV) } : {}),
    address: { "@type": "PostalAddress", addressCountry: "IT" },
  };
  if (d.indirizzo) o.address.streetAddress = d.indirizzo;
  if (d.paese) o.address.addressLocality = String(d.paese).replace(/\s*\([A-Z]{2}\)\s*$/, "");
  if (d.provincia) o.address.addressRegion = d.provincia;
  if (typeof d.lat === "number" && typeof d.lon === "number" && d.precisa) o.geo = { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lon };
  if (d.telefono) o.telephone = d.telefono;
  else if (d.whatsapp) o.telephone = d.whatsapp;
  const same = [];
  if (d.instagram) same.push("https://instagram.com/" + String(d.instagram).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""));
  if (d.sito) same.push(/^https?:\/\//.test(d.sito) ? d.sito : "https://" + d.sito);
  if (same.length) o.sameAs = same;
  if (reviews && reviews.length) {
    const avg = reviews.reduce((a, r) => a + r.voto, 0) / reviews.length;
    o.aggregateRating = { "@type": "AggregateRating", ratingValue: Math.round(avg * 10) / 10, reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
  }
  const ps = (d.prodotti || []).filter((p) => p && p.nome && Number(p.prezzo) > 0);
  if (ps.length) o.makesOffer = ps.slice(0, 60).map((p) => ({
    "@type": "Offer", price: Number(p.prezzo).toFixed(2), priceCurrency: "EUR",
    availability: p.disponibile === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    itemOffered: Object.assign({ "@type": "Product", name: p.nome }, p.descrizione ? { description: p.descrizione } : {}, p.fotoV ? { image: foto(id, p.id, p.fotoV) } : {}),
  }));
  return o;
}
function productLd(id, d, p, reviews) {
  const o = { "@context": "https://schema.org", "@type": "Product", name: p.nome, url: prodUrl(id, p.id),
    description: p.descrizione || productDesc(d, p), category: p.tipo === "esperienza" ? "Esperienza" : (d.categoria || undefined),
    image: p.fotoV ? foto(id, p.id, p.fotoV) : (d.bannerV ? foto(id, "_banner", d.bannerV) : d.coverV ? foto(id, "_cover", d.coverV) : SITE + "/og.png"),
    brand: { "@type": "Brand", name: d.nome },
    offers: { "@type": "Offer", url: prodUrl(id, p.id), priceCurrency: "EUR", price: (Number(p.prezzo) || 0).toFixed(2),
      availability: p.disponibile === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: d.nome, url: shopUrl(id) } } };
  return o;
}
const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: u })) });

/* ---------- mappa del sito ---------- */
async function sitemap() {
  const st = { miss: false };
  const shops = await loadShops(st);
  const day = (ms) => { try { return new Date(ms).toISOString().slice(0, 10); } catch (_) { return null; } };
  const urls = ["/", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi"].map((p) => ({ loc: SITE + p }))
    .concat([...L.pagineLuoghi(flat(shops)).keys()].map((k) => ({ loc: SITE + k })))
    .concat(shops.some(({ data: d }) => L.storiaOk(d)) ? [{ loc: SITE + "/storie" }] : [])
    .concat(shops.filter(({ data: d }) => L.storiaOk(d)).map(({ id, data: d }) => ({ loc: storiaUrl(id), lastmod: d.aggiornata ? day(d.aggiornata) : null })))
    .concat(shops.map(({ id, data: d }) => ({ loc: shopUrl(id), lastmod: d.aggiornata ? day(d.aggiornata) : null })))
    .concat(...shops.map(({ id, data: d }) => (d.prodotti || []).filter((p) => p && p.id && p.nome).map((p) => ({ loc: prodUrl(id, p.id), lastmod: d.aggiornata ? day(d.aggiornata) : null }))));
  const alt = (loc) => LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(loc + (l === "it" ? "" : "?lang=" + l))}"/>`).join("") + `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${alt(u.loc)}</url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": st.miss ? "no-store" : "public, max-age=600", ...(st.miss ? {} : { "netlify-cdn-cache-control": CDN_CACHE }) } });
}

/* ---------- elenco prodotti per Google Shopping (Merchant Center): /feed/google.xml ----------
   Solo prodotti con foto e prezzo; niente esperienze (Google Shopping non accetta servizi). */
const xmlEsc = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
async function googleFeed() {
  const st = { miss: false };
  const shops = await loadShops(st);
  const items = [];
  for (const { id, data: d } of shops) for (const p of d.prodotti || []) {
    if (!p || !p.id || !p.nome || p.tipo === "esperienza" || !p.fotoV || !(Number(p.prezzo) > 0)) continue;
    const reg = L.regioneDi(d), R = reg && L.regione(reg)[1];
    const title = clip(`${p.nome}${p.unita && !/^(pezzo|pz\.?|uno|1)$/i.test(p.unita) ? ` (${p.unita})` : ""} – ${d.nome}`, 150);
    const desc = clip(`${p.descrizione ? String(p.descrizione).trim().replace(/([^.!?…])$/, "$1.") + " " : ""}Fatto a mano da ${d.produttore || d.nome}${d.paese ? `, ${String(d.paese).replace(/\s*\([A-Z]{2}\)\s*$/, "")}` : ""}${R ? ` (${R})` : ""}. ${d.categoria ? d.categoria + " artigianale. " : ""}Si ordina direttamente all'artigiano su ${BRAND}.`, 4900);
    items.push(`<item>
<g:id>${xmlEsc(`${id}_${p.id}`.slice(0, 50))}</g:id>
<g:title>${xmlEsc(title)}</g:title>
<g:description>${xmlEsc(desc)}</g:description>
<g:link>${xmlEsc(prodUrl(id, p.id) + "?utm_source=google-shopping")}</g:link>
<g:image_link>${xmlEsc(foto(id, p.id, p.fotoV))}</g:image_link>
<g:availability>${p.disponibile === false ? "out_of_stock" : "in_stock"}</g:availability>
<g:price>${Number(p.prezzo).toFixed(2)} EUR</g:price>
<g:condition>new</g:condition>
<g:brand>${xmlEsc(clip(d.nome, 70))}</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${xmlEsc(`Artigianato > ${d.categoria || "Altro"}`)}</g:product_type>${reg ? `\n<g:custom_label_0>${xmlEsc(R)}</g:custom_label_0>` : ""}
<g:custom_label_1>${xmlEsc(d.categoria || "Altro")}</g:custom_label_1>
</item>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${BRAND}</title>
<link>${SITE}/</link>
<description>${xmlEsc(PAGES["/prodotti"].d)}</description>
${items.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "x-robots-tag": "noindex", "cache-control": st.miss ? "no-store" : "public, max-age=600", ...(st.miss ? {} : { "netlify-cdn-cache-control": CDN_CACHE }) } });
}

/* ---------- pagina non trovata (404.html) ---------- */
async function notFound(url, context) {
  let html = "<!doctype html><title>Pagina non trovata · Libere Botteghe</title><p>Pagina non trovata. <a href=\"/\">Torna a Libere Botteghe</a></p>";
  try { const r = context && context.asset ? await context.asset("/404.html") : await fetch(new URL("/404.html", url.origin)); if (r.ok || r.status === 404) html = await r.text(); } catch (_) { /* testo di riserva */ }
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=300", "netlify-cdn-cache-control": CDN_CACHE } });
}

/* ---------- la pagina ---------- */
export default async (request, context) => {
  const st = { miss: false };
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/sitemap.xml") return sitemap();
  if (path === "/feed/google.xml") return googleFeed();

  const res = await context.next();
  if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
  let html = await res.text();

  const lang = LANGS.includes(url.searchParams.get("lang")) ? url.searchParams.get("lang") : null;
  let status = res.status, title, desc, image = SITE + "/og.png", body = "", ld = [], noindex = false, ogType = "website";

  const m = path.match(/^\/b\/([0-9a-f-]{36})$/i);
  const mp = path.match(/^\/b\/([0-9a-f-]{36})\/p\/([A-Za-z0-9_%-]{1,60})$/i);
  const lu = L.parseLuogo(path);
  const ms = path.match(/^\/storie\/([0-9a-f-]{36})$/i);
  if (!m && !mp && !lu && !ms && !PAGES[path]) return notFound(url, context);
  if (ms) {
    const id = ms[1].toLowerCase();
    const rows = await db(`botteghe?id=eq.${id}&select=data`, 4000, st);
    const d = rows && rows[0] && rows[0].data;
    if (rows && !(d && d.nome && L.storiaOk(d))) return notFound(url, context);
    if (d) {
      title = clip(`La storia di ${d.nome}${d.categoria ? ` · ${d.categoria}` : ""}${d.paese ? ` a ${paeseDi(d)}` : ""} · ${BRAND}`, 90);
      desc = clip(`${L.storiaTesti(d)[0][2]}`, 160);
      if (d.bannerV) image = foto(id, "_banner", d.bannerV); else if (d.coverV) image = foto(id, "_cover", d.coverV);
      body = storiaHtml(id, d); ogType = "article";
      ld = [{ "@context": "https://schema.org", "@type": "Article", headline: `La storia di ${d.nome}`, url: storiaUrl(id), image, description: desc,
        author: { "@type": "Organization", name: BRAND, url: SITE + "/" }, publisher: { "@type": "Organization", name: BRAND, logo: { "@type": "ImageObject", url: SITE + "/img/icon-512.png" } },
        ...(d.aggiornata ? { dateModified: new Date(d.aggiornata).toISOString() } : {}), about: { "@type": "Store", name: d.nome, url: shopUrl(id) }, inLanguage: "it-IT" },
        crumbsLd([[BRAND, SITE + "/"], ["Storie di bottega", SITE + "/storie"], [`La storia di ${d.nome}`, storiaUrl(id)]])];
    } else { title = PAGES["/"].t; desc = PAGES["/"].d; }
  } else if (lu) {
    const rows = await loadShops(st), all = flat(rows);
    const shops = L.filtraLuogo(all, lu.cat, lu.reg).sort((a, b) => (b.aggiornata || 0) - (a.aggiornata || 0));
    const t = L.testiLuogo(lu.cat, lu.reg, shops);
    title = t.title; desc = t.desc; noindex = !shops.length;
    const first = shops.find((d) => d.bannerV) || shops.find((d) => d.coverV);
    if (first) image = first.bannerV ? foto(first.id, "_banner", first.bannerV) : foto(first.id, "_cover", first.coverV);
    body = luogoHtml(all, lu.cat, lu.reg, shops, t);
    const here = SITE + path;
    ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: t.h1, url: here, description: desc, isPartOf: { "@type": "WebSite", name: BRAND, url: SITE + "/" },
      mainEntity: { "@type": "ItemList", numberOfItems: shops.length, itemListElement: shops.slice(0, 50).map((d, i) => ({ "@type": "ListItem", position: i + 1, url: shopUrl(d.id), name: d.nome })) } },
      crumbsLd([[BRAND, SITE + "/"], ...(lu.cat && lu.reg ? [[luogoLabel(lu.cat, null), SITE + L.luogoPath(lu.cat, null)]] : []), [t.h1, here]])];
  } else if (mp) {
    const id = mp[1].toLowerCase(), pid = decodeURIComponent(mp[2]);
    const rows = await db(`botteghe?id=eq.${id}&select=data`, 4000, st);
    const d = rows && rows[0] && rows[0].data;
    const p = d && (d.prodotti || []).find((x) => x && x.id === pid);
    if (rows && !(d && d.nome && p)) return notFound(url, context);
    if (p) {
      title = `${p.nome} · ${d.nome} · ${BRAND}`;
      if (title.length > 70) title = `${p.nome} · ${BRAND}`;
      desc = productDesc(d, p);
      if (p.fotoV) image = foto(id, p.id, p.fotoV); else if (d.bannerV) image = foto(id, "_banner", d.bannerV); else if (d.coverV) image = foto(id, "_cover", d.coverV);
      body = productHtml(id, d, p); ogType = "product";
      ld = [productLd(id, d, p), crumbsLd([[BRAND, SITE + "/"], [d.nome, shopUrl(id)], [p.nome, prodUrl(id, p.id)]])];
    } else { title = PAGES["/"].t; desc = PAGES["/"].d; }
  } else if (m) {
    const id = m[1].toLowerCase();
    const [rows, reviews] = await Promise.all([db(`botteghe?id=eq.${id}&select=data`, 4000, st), db(`recensioni?bottega_id=eq.${id}&select=voto`, 4000, st)]);
    const d = rows && rows[0] && rows[0].data;
    if (rows && !(d && d.nome)) return notFound(url, context);
    else if (d) {
      title = `${d.nome}${d.paese ? ` · ${d.categoria || "Artigianato"} a ${d.paese}` : ""} · ${BRAND}`;
      if (title.length > 70) title = `${d.nome} · ${BRAND}`;
      desc = shopDesc(d);
      if (d.bannerV) image = foto(id, "_banner", d.bannerV); else if (d.coverV) image = foto(id, "_cover", d.coverV);
      body = shopHtml(id, d); ogType = "business.business";
      ld = [shopLd(id, d, reviews), crumbsLd([[BRAND, SITE + "/"], [d.nome, shopUrl(id)]])];
    } else { title = PAGES["/"].t; desc = PAGES["/"].d; }
  } else if (PAGES[path]) {
    const p = PAGES[path]; title = p.t; desc = p.d; noindex = !!p.noindex;
    if (path === "/") { const shops = await loadShops(st); body = homeHtml(shops); ld = [orgLd(), siteLd()]; }
    else if (path === "/prodotti") body = productsHtml(await loadShops(st));
    else if (path === "/storie") body = storieHtml(await loadShops(st));
    else if (!noindex) body = simpleHtml(p.t.split(" · ")[0], p.d);
  } else return new Response(html, { status, headers: res.headers });

  const canonical = SITE + (path === "/" ? "/" : path) + (lang && lang !== "it" ? `?lang=${lang}` : "");
  const base = SITE + (path === "/" ? "/" : path);
  if (url.hostname.endsWith(".netlify.app") || url.hostname.endsWith(".pages.dev")) noindex = true;

  const head = [
    `<link rel="canonical" href="${esc(canonical)}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(base + (l === "it" ? "" : "?lang=" + l))}">`),
    `<link rel="alternate" hreflang="x-default" href="${esc(base)}">`,
    noindex ? `<meta name="robots" content="noindex">` : `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    ...ld.map(jsonld),
  ].join("\n");

  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${ogType}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(canonical)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`)
    .replace("</head>", head + "\n</head>")
    .replace('<main id="app"></main>', `<main id="app">${body}</main>`);

  const headers = new Headers(res.headers);
  headers.delete("content-length"); headers.delete("etag"); headers.delete("last-modified"); // il contenuto cambia con i dati, non con il file
  headers.set("content-type", "text/html; charset=utf-8");
  if (noindex) headers.set("x-robots-tag", "noindex");
  if (st.miss) headers.set("cache-control", "no-store"); // dati incompleti: non conservarla
  else headers.set("netlify-cdn-cache-control", CDN_CACHE);
  headers.set("netlify-vary", "query=lang");
  return new Response(html, { status, headers });
};

export const config = {
  cache: "manual",
  path: ["/", "/b/*", "/artigiani/*", "/artigianato/*", "/storie", "/storie/*", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi", "/privacy", "/termini", "/cookie", "/la-mia-bottega", "/gestione", "/preferite", "/sitemap.xml", "/feed/google.xml"],
};
