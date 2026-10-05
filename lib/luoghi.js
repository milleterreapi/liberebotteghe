// Libere Botteghe — regioni e mestieri per le pagine «Artigiani in Puglia», «Ceramiche artigianali in Puglia»…
// Un solo file per sito e server: il browser lo carica come /luoghi.js (window.LB_LUOGHI),
// il server e il bot lo importano (import "../lib/luoghi.js"; poi globalThis.LB_LUOGHI).
(function () {

const REGIONI = [
  ["abruzzo", "Abruzzo", "AQ CH PE TE"],
  ["basilicata", "Basilicata", "MT PZ"],
  ["calabria", "Calabria", "CS CZ KR RC VV"],
  ["campania", "Campania", "AV BN CE NA SA"],
  ["emilia-romagna", "Emilia-Romagna", "BO FC FE MO PC PR RA RE RN"],
  ["friuli-venezia-giulia", "Friuli-Venezia Giulia", "GO PN TS UD"],
  ["lazio", "Lazio", "FR LT RI RM VT"],
  ["liguria", "Liguria", "GE IM SP SV"],
  ["lombardia", "Lombardia", "BG BS CO CR LC LO MB MI MN PV SO VA"],
  ["marche", "Marche", "AN AP FM MC PU"],
  ["molise", "Molise", "CB IS"],
  ["piemonte", "Piemonte", "AL AT BI CN NO TO VB VC"],
  ["puglia", "Puglia", "BA BR BT FG LE TA"],
  ["sardegna", "Sardegna", "CA NU OR SS SU"],
  ["sicilia", "Sicilia", "AG CL CT EN ME PA RG SR TP"],
  ["toscana", "Toscana", "AR FI GR LI LU MS PI PO PT SI"],
  ["trentino-alto-adige", "Trentino-Alto Adige", "BZ TN"],
  ["umbria", "Umbria", "PG TR"],
  ["valle-d-aosta", "Valle d'Aosta", "AO"],
  ["veneto", "Veneto", "BL PD RO TV VE VI VR"],
];
// [nome della categoria, indirizzo, titolo della pagina, «botteghe di …»]
const MESTIERI = [
  ["Ceramica", "ceramica", "Ceramiche artigianali", "ceramica"],
  ["Tessuti", "tessuti", "Tessuti artigianali", "tessuti"],
  ["Legno", "legno", "Artigianato del legno", "legno"],
  ["Cuoio", "cuoio", "Pelletteria artigianale", "cuoio e pelle"],
  ["Gioielli", "gioielli", "Gioielli artigianali", "gioielli"],
  ["Miele", "miele", "Miele artigianale", "miele"],
  ["Alimentari", "alimentari", "Prodotti tipici artigianali", "prodotti tipici"],
  ["Vino e liquori", "vino-e-liquori", "Vini e liquori artigianali", "vini e liquori"],
  ["Cosmesi naturale", "cosmesi-naturale", "Cosmesi naturale artigianale", "cosmesi naturale"],
  ["Piante e fiori", "piante-e-fiori", "Piante e fiori", "piante e fiori"],
];

const REG_BY_SIGLA = {};
for (const [slug, , sig] of REGIONI) for (const s of sig.split(" ")) REG_BY_SIGLA[s] = slug;
const regione = (slug) => REGIONI.find((r) => r[0] === slug) || null;
const mestiere = (x) => MESTIERI.find((m) => m[1] === x || m[0] === x) || null;
/* la regione di una bottega: dalla provincia scelta, oppure dalla sigla tra parentesi nel paese, es. «Specchia (LE)» */
function regioneDi(d) {
  const p = String((d && d.provincia) || "").trim().toUpperCase();
  if (REG_BY_SIGLA[p]) return REG_BY_SIGLA[p];
  const m = String((d && d.paese) || "").match(/\(([A-Za-z]{2})\)\s*$/);
  return m ? REG_BY_SIGLA[m[1].toUpperCase()] || null : null;
}
const luogoPath = (cat, reg) => cat ? `/artigianato/${cat}${reg ? "/" + reg : ""}` : `/artigiani/${reg}`;
/* dal percorso alla pagina: {cat, reg} oppure null se non è una pagina di questo tipo (o lo slug non esiste) */
function parseLuogo(path) {
  let m = path.match(/^\/artigiani\/([a-z-]{3,30})$/);
  if (m) return regione(m[1]) ? { cat: null, reg: m[1] } : null;
  m = path.match(/^\/artigianato\/([a-z-]{3,30})(?:\/([a-z-]{3,30}))?$/);
  if (m) return mestiere(m[1]) && (!m[2] || regione(m[2])) ? { cat: m[1], reg: m[2] || null } : null;
  return null;
}
/* le botteghe di una pagina */
const filtraLuogo = (shops, cat, reg) => shops.filter((s) => (!cat || (mestiere(cat) && s.categoria === mestiere(cat)[0])) && (!reg || regioneDi(s) === reg));
/* tutte le pagine con almeno una bottega, con il numero di botteghe */
function pagineLuoghi(shops) {
  const out = new Map(), add = (cat, reg) => { const k = luogoPath(cat, reg); out.set(k, { cat, reg, n: (out.get(k)?.n || 0) + 1 }); };
  for (const s of shops) {
    const r = regioneDi(s), m = mestiere(s.categoria);
    if (r) add(null, r);
    if (m) { add(m[1], null); if (r) add(m[1], r); }
  }
  return out;
}
const unisci = (xs) => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
const paese = (s) => String(s.paese || "").replace(/\s*\([A-Za-z]{2}\)\s*$/, "").trim();
/* titolo, descrizione e testo introduttivo della pagina */
function testiLuogo(cat, reg, shops) {
  const R = reg ? regione(reg)[1] : null, M = cat ? mestiere(cat) : null;
  const n = shops.length, paesi = [...new Set(shops.map(paese).filter(Boolean))].slice(0, 6);
  const cats = [...new Set(shops.map((s) => mestiere(s.categoria)).filter(Boolean).map((m) => m[3]))].slice(0, 5);
  const nProd = shops.reduce((a, s) => a + (s.prodotti || []).filter((p) => p && p.nome).length, 0);
  const inR = R ? ` in ${R}` : "";
  const h1 = M ? `${M[2]}${inR}` : `Artigiani${inR}`;
  const title = M ? `${M[2]}${R ? inR : " in Italia"} · Libere Botteghe` : `Artigiani e botteghe artigiane${inR} · Libere Botteghe`;
  const bott = `${n} ${n === 1 ? "bottega" : "botteghe"}`;
  const dove = paesi.length ? `, a ${unisci(paesi)}` : "";
  let intro;
  if (!n) intro = M ? `Ancora nessuna bottega di ${M[3]}${inR} su Libere Botteghe. Sei un artigiano? Apri la tua bottega: è gratis.` : `Ancora nessuna bottega${inR} su Libere Botteghe. Sei un artigiano? Apri la tua bottega: è gratis.`;
  else if (M) intro = `${bott} di ${M[3]}${inR}${dove}. ${nProd ? `${nProd} ${nProd === 1 ? "creazione fatta" : "creazioni fatte"} a mano, ` : "Creazioni fatte a mano "}da ordinare direttamente all'artigiano, senza intermediari: il messaggio parte su WhatsApp, e consegna e pagamento li concordi con la bottega.`;
  else intro = `${bott} artigiane${inR}${dove}${cats.length ? `: ${unisci(cats)}` : ""}. Ogni bottega ha la sua vetrina con foto e prezzi, e ordini direttamente a chi lavora, senza intermediari.`;
  const desc = intro.replace(/\s+/g, " ").slice(0, 158).replace(/\s+\S*$/, "") + (intro.length > 158 ? "…" : "");
  return { h1, title, desc, intro };
}
/* pagine collegate da mostrare in fondo (solo quelle con almeno una bottega): [percorso, titolo, n. botteghe] */
function collegati(all, cat, reg) {
  const pag = pagineLuoghi(all), out = [];
  const push = (c, r) => { const k = luogoPath(c, r), x = pag.get(k); if (x && !out.some((o) => o[0] === k) && !(c === cat && r === reg)) out.push([k, testiLuogo(c, r, []).h1, x.n, c, r]); };
  const R = REGIONI.map((r) => r[0]), M = MESTIERI.map((m) => m[1]);
  if (!cat && !reg) { R.forEach((r) => push(null, r)); M.forEach((m) => push(m, null)); }
  else if (cat && reg) { push(null, reg); push(cat, null); M.forEach((m) => push(m, reg)); R.forEach((r) => push(cat, r)); }
  else if (reg) { M.forEach((m) => push(m, reg)); R.forEach((r) => push(null, r)); }
  else { R.forEach((r) => push(cat, r)); M.forEach((m) => push(m, null)); }
  return out;
}
globalThis.LB_LUOGHI = { REGIONI, MESTIERI, regione, mestiere, regioneDi, luogoPath, parseLuogo, filtraLuogo, pagineLuoghi, testiLuogo, collegati };
})();
