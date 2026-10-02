// Libere Botteghe — SEO.
// Per ogni pagina prepara sul server quello che serve a Google e ai social:
// titolo, descrizione, indirizzo canonico, lingue, dati strutturati (schema.org)
// e una versione già scritta del contenuto (botteghe, prodotti, indirizzi),
// che il sito poi sostituisce con la versione interattiva.
// Genera anche la mappa del sito: /sitemap.xml
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
  "/la-mia-bottega": { t: `La mia bottega · ${BRAND}`, d: "Area riservata agli artigiani di Libere Botteghe.", noindex: true },
  "/gestione": { t: `Gestione · ${BRAND}`, d: "Area riservata.", noindex: true },
};
const MAIN_LINKS = [["/", "Le botteghe"], ["/prodotti", "Tutti i prodotti"], ["/manifesto", "Il manifesto"], ["/chi-siamo", "Chi siamo"], ["/prezzi", "Apri la tua bottega"]];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const eur = (n) => (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const foto = (shop, key, v) => `${SUPABASE_URL}/storage/v1/object/public/foto/${shop}/${key}.jpg?v=${encodeURIComponent(v)}`;
const shopUrl = (id) => `${SITE}/b/${id}`;
// Le pagine pronte restano in memoria sulla rete di Netlify per un minuto (e si rinnovano in background):
// così quasi nessuna visita deve aspettare il database. Ogni nuova pubblicazione del sito svuota la memoria.
const CDN_CACHE = "public, durable, s-maxage=60, stale-while-revalidate=600";

async function db(path) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(2500) });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}
const loadShops = async () => ((await db("botteghe?select=id,data")) || []).filter((r) => r.data && r.data.nome);

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
<h1>${BRAND}: il mercato degli artigiani e dei piccoli produttori italiani</h1>
<p>Qui niente è fatto in serie: ceramiche, miele, stoffe, legno e sapori fatti uno per uno da chi li produce. Entra nelle botteghe, riempi il cestino e ordina direttamente all'artigiano, su WhatsApp, senza intermediari.</p>
<h2>Le botteghe</h2>${shops.length ? shopListHtml(shops) : "<p>Le prime botteghe stanno aprendo.</p>"}
<h2>Sei un artigiano?</h2><p><a href="/prezzi">Apri la tua bottega online</a>: vetrina con foto e prezzi, posizione sulla mappa e ordini su WhatsApp.</p></div>`;
}
function productsHtml(shops) {
  const items = [];
  shops.forEach(({ id, data: d }) => (d.prodotti || []).forEach((p) => { if (p && p.nome) items.push(`<li><b>${esc(p.nome)}</b> — ${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""} · <a href="/b/${esc(id)}">${esc(d.nome)}</a>${p.descrizione ? `<br><span>${esc(clip(p.descrizione, 160))}</span>` : ""}</li>`); }));
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
${addr ? `<p>Indirizzo: ${esc(addr)}</p>` : ""}
${d.consegna ? `<p>Consegna: ${esc(d.consegna)}</p>` : ""}
<h2>Prodotti</h2>${ps.length ? `<ul class="ssr-list">${ps.map((p) => `<li><b>${esc(p.nome)}</b> — ${eur(p.prezzo)}${p.unita ? ` / ${esc(p.unita)}` : ""}${p.descrizione ? `<br><span>${esc(p.descrizione)}</span>` : ""}</li>`).join("")}</ul>` : "<p>Il banco è ancora vuoto.</p>"}</div>`;
}
const simpleHtml = (h1, p) => `<div class="ssr wrap page">${nav()}<h1>${esc(h1)}</h1><p>${esc(p)}</p></div>`;

/* ---------- dati strutturati ---------- */
const orgLd = () => ({ "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: SITE + "/", logo: SITE + "/img/icon-512.png", description: PAGES["/"].d });
const siteLd = () => ({ "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: SITE + "/", inLanguage: "it-IT" });
function shopLd(id, d, reviews) {
  const o = {
    "@context": "https://schema.org", "@type": "Store", "@id": shopUrl(id) + "#bottega",
    name: d.nome, url: shopUrl(id), description: d.descrizione || shopDesc(d),
    image: d.coverV ? foto(id, "_cover", d.coverV) : SITE + "/og.png",
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
const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: u })) });

/* ---------- mappa del sito ---------- */
async function sitemap() {
  const shops = await loadShops();
  const day = (ms) => { try { return new Date(ms).toISOString().slice(0, 10); } catch (_) { return null; } };
  const urls = ["/", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi"].map((p) => ({ loc: SITE + p }))
    .concat(shops.map(({ id, data: d }) => ({ loc: shopUrl(id), lastmod: d.aggiornata ? day(d.aggiornata) : null })));
  const alt = (loc) => LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(loc + (l === "it" ? "" : "?lang=" + l))}"/>`).join("") + `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${alt(u.loc)}</url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600", "netlify-cdn-cache-control": CDN_CACHE } });
}

/* ---------- pagina non trovata (404.html) ---------- */
async function notFound(url) {
  let html = "<!doctype html><title>Pagina non trovata · Libere Botteghe</title><p>Pagina non trovata. <a href=\"/\">Torna a Libere Botteghe</a></p>";
  try { const r = await fetch(new URL("/404.html", url.origin)); if (r.ok) html = await r.text(); } catch (_) { /* testo di riserva */ }
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=300", "netlify-cdn-cache-control": CDN_CACHE } });
}

/* ---------- la pagina ---------- */
export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/sitemap.xml") return sitemap();

  const res = await context.next();
  if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
  let html = await res.text();

  const lang = LANGS.includes(url.searchParams.get("lang")) ? url.searchParams.get("lang") : null;
  let status = res.status, title, desc, image = SITE + "/og.png", body = "", ld = [], noindex = false, ogType = "website";

  const m = path.match(/^\/b\/([0-9a-f-]{36})$/i);
  if (!m && !PAGES[path]) return notFound(url);
  if (m) {
    const id = m[1].toLowerCase();
    const [rows, reviews] = await Promise.all([db(`botteghe?id=eq.${id}&select=data`), db(`recensioni?bottega_id=eq.${id}&select=voto`)]);
    const d = rows && rows[0] && rows[0].data;
    if (rows && !(d && d.nome)) return notFound(url);
    else if (d) {
      title = `${d.nome}${d.paese ? ` · ${d.categoria || "Artigianato"} a ${d.paese}` : ""} · ${BRAND}`;
      if (title.length > 70) title = `${d.nome} · ${BRAND}`;
      desc = shopDesc(d);
      if (d.coverV) image = foto(id, "_cover", d.coverV);
      body = shopHtml(id, d); ogType = "business.business";
      ld = [shopLd(id, d, reviews), crumbsLd([[BRAND, SITE + "/"], [d.nome, shopUrl(id)]])];
    } else { title = PAGES["/"].t; desc = PAGES["/"].d; }
  } else if (PAGES[path]) {
    const p = PAGES[path]; title = p.t; desc = p.d; noindex = !!p.noindex;
    if (path === "/") { const shops = await loadShops(); body = homeHtml(shops); ld = [orgLd(), siteLd()]; }
    else if (path === "/prodotti") body = productsHtml(await loadShops());
    else if (!noindex) body = simpleHtml(p.t.split(" · ")[0], p.d);
  } else return new Response(html, { status, headers: res.headers });

  const canonical = SITE + (path === "/" ? "/" : path) + (lang && lang !== "it" ? `?lang=${lang}` : "");
  const base = SITE + (path === "/" ? "/" : path);
  if (url.hostname.endsWith(".netlify.app")) noindex = true;

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
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  if (noindex) headers.set("x-robots-tag", "noindex");
  headers.set("netlify-cdn-cache-control", CDN_CACHE);
  headers.set("netlify-vary", "query=lang");
  return new Response(html, { status, headers });
};

export const config = {
  cache: "manual",
  path: ["/", "/b/*", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi", "/privacy", "/termini", "/cookie", "/la-mia-bottega", "/gestione", "/sitemap.xml"],
};
