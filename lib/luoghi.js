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

/* centro di ogni provincia (lon,lat): serve per le botteghe che hanno solo la posizione sulla mappa */
const CENTRI = "AG:13.58,37.31 AL:8.61,44.91 AN:13.52,43.62 AO:7.32,45.74 AP:13.58,42.85 AQ:13.40,42.35 AR:11.88,43.46 AT:8.21,44.90 AV:14.79,40.91 BA:16.87,41.12 BG:9.67,45.70 BI:8.05,45.56 BL:12.22,46.14 BN:14.78,41.13 BO:11.34,44.49 BR:17.94,40.63 BS:10.22,45.54 BT:16.28,41.32 BZ:11.35,46.50 CA:9.11,39.22 CB:14.66,41.56 CE:14.33,41.07 CH:14.17,42.35 CL:14.06,37.49 CN:7.55,44.39 CO:9.09,45.81 CR:10.02,45.13 CS:16.25,39.30 CT:15.09,37.50 CZ:16.59,38.91 EN:14.28,37.57 FC:12.04,44.22 FE:11.62,44.84 FG:15.55,41.46 FI:11.25,43.77 FM:13.72,43.16 FR:13.35,41.64 GE:8.93,44.41 GO:13.62,45.94 GR:11.11,42.76 IM:8.03,43.89 IS:14.23,41.59 KR:17.13,39.08 LC:9.39,45.85 LE:18.17,40.35 LI:10.31,43.55 LO:9.50,45.31 LT:12.90,41.47 LU:10.50,43.84 MB:9.27,45.58 MC:13.45,43.30 ME:15.55,38.19 MI:9.19,45.46 MN:10.79,45.16 MO:10.93,44.65 MS:10.14,44.04 MT:16.60,40.67 NA:14.25,40.85 NO:8.62,45.45 NU:9.33,40.32 OR:8.59,39.90 PA:13.36,38.12 PC:9.69,45.05 PD:11.88,45.41 PE:14.21,42.46 PG:12.39,43.11 PI:10.40,43.72 PN:12.66,45.96 PO:11.10,43.88 PR:10.33,44.80 PT:10.92,43.93 PU:12.91,43.91 PV:9.16,45.19 PZ:15.80,40.64 RA:12.20,44.42 RC:15.65,38.11 RE:10.63,44.70 RG:14.73,36.93 RI:12.86,42.40 RM:12.50,41.90 RN:12.57,44.06 RO:11.79,45.07 SA:14.77,40.68 SI:11.33,43.32 SO:9.87,46.17 SP:9.82,44.10 SR:15.29,37.08 SS:8.56,40.73 SU:8.52,39.17 SV:8.48,44.31 TA:17.24,40.47 TE:13.70,42.66 TN:11.12,46.07 TO:7.69,45.07 TP:12.51,38.02 TR:12.64,42.56 TS:13.78,45.65 TV:12.24,45.67 UD:13.23,46.06 VA:8.83,45.82 VB:8.55,45.92 VC:8.42,45.32 VE:12.33,45.44 VI:11.55,45.55 VR:10.99,45.44 VT:12.10,42.42 VV:16.10,38.68".split(" ").map((x) => { const [k, c] = x.split(":"); const [lon, lat] = c.split(",").map(Number); return [k, lon, lat]; });
const REG_BY_SIGLA = {};
for (const [slug, , sig] of REGIONI) for (const s of sig.split(" ")) REG_BY_SIGLA[s] = slug;
const regione = (slug) => REGIONI.find((r) => r[0] === slug) || null;
const mestiere = (x) => MESTIERI.find((m) => m[1] === x || m[0] === x) || null;
/* la regione di una bottega: dalla provincia scelta, oppure dalla sigla tra parentesi nel paese, es. «Specchia (LE)» */
function regioneDi(d) {
  const p = String((d && d.provincia) || "").trim().toUpperCase();
  if (REG_BY_SIGLA[p]) return REG_BY_SIGLA[p];
  const m = String((d && d.paese) || "").match(/\(([A-Za-z]{2})\)\s*$/);
  if (m && REG_BY_SIGLA[m[1].toUpperCase()]) return REG_BY_SIGLA[m[1].toUpperCase()];
  const lat = Number(d && d.lat), lon = Number(d && d.lon);
  if (!d || typeof d.lat !== "number" || !(lat > 35.4 && lat < 47.2 && lon > 6.5 && lon < 18.7)) return null;
  const cx = Math.cos(42 * Math.PI / 180); let best = null, bd = 1e9;
  for (const [k, plon, plat] of CENTRI) { const dd = (plat - lat) ** 2 + ((plon - lon) * cx) ** 2; if (dd < bd) { bd = dd; best = k; } }
  return best ? REG_BY_SIGLA[best] : null;
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
/* ---------- le storie degli artigiani: /storie e /storie/<id> ---------- */
const STORIA = [
  ["inizio", "Come è cominciato tutto?", "Racconta come hai iniziato: chi ti ha insegnato, quando hai capito che sarebbe diventato il tuo lavoro."],
  ["lavoro", "Com'è una giornata nel tuo laboratorio?", "Gli attrezzi, i gesti, i tempi: cosa vede chi entra da te mentre lavori."],
  ["speciale", "Cosa rende unico quello che fai?", "Materiali, tecniche, scelte che fai diversamente da un prodotto in serie."],
  ["territorio", "Che legame c'è con il tuo territorio?", "Il paese, la tradizione, le materie prime del posto, le persone."],
];
const storiaTesti = (d) => STORIA.map(([k, q]) => [k, q, String((d && d.storia && d.storia[k]) || "").trim()]).filter((x) => x[2]);
/* la storia si pubblica quando ci sono almeno due risposte e un po' di testo */
const storiaOk = (d) => { const t = storiaTesti(d); return t.length >= 2 && t.reduce((a, x) => a + x[2].length, 0) >= 200; };
globalThis.LB_LUOGHI = { STORIA, storiaTesti, storiaOk, REGIONI, MESTIERI, regione, mestiere, regioneDi, luogoPath, parseLuogo, filtraLuogo, pagineLuoghi, testiLuogo, collegati };
})();
