// Libere Botteghe — resoconto settimanale via email per gli artigiani.
// Ogni lunedì Supabase (pg_cron, sql/2026-10-resoconto.sql) chiama POST /api/report con la parola segreta.
// Le email partono con Brevo. Variabili in Cloudflare:
//   BREVO_API_KEY   chiave API di Brevo (SMTP & API → API Keys), obbligatoria
//   MAIL_FROM       facoltativa, mittente (dominio autenticato su Brevo); predefinito noreply@liberebotteghe.it
// più quelle del bot: TELEGRAM_SECRET, LB_ADMIN_EMAIL, LB_ADMIN_PASSWORD (e TELEGRAM_* per l'avviso al gestore).
import { rest, send, esc, day, addDays, fmtDate, shopUrl, SITE, CONTATTI, cleanEnv, novitaText, loadCfg, saveCfg } from "./telegram.mjs";

const isExp = (p) => p && p.tipo === "esperienza";
const eq = (a, b) => { a = String(a || ""); b = String(b || ""); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

/* ---------- numeri della settimana ---------- */
function sum(rows, id, from, to) {
  const o = { visite: 0, ordini: 0, contatti: 0, canali: {}, fonti: {} };
  for (const r of rows) {
    if (r.bottega_id !== id || r.giorno < from || r.giorno > to) continue;
    const n = r.conteggio || 0;
    if (r.tipo === "visita") { o.visite += n; const f = r.fonte || "diretto"; o.fonti[f] = (o.fonti[f] || 0) + n; }
    else if (r.tipo === "ordine" || r.tipo === "ordine_copia" || r.tipo === "prenotazione") o.ordini += n;
    else if (CONTATTI[r.tipo]) { o.contatti += n; o.canali[r.tipo] = (o.canali[r.tipo] || 0) + n; }
  }
  return o;
}
function todo(d) {
  const ps = d.prodotti || [], goods = ps.filter((p) => !isExp(p)), noPhoto = ps.filter((p) => !p.fotoV).length;
  const t = [];
  if (!d.bannerV) t.push("aggiungi l'immagine di copertina: è la prima cosa che vedono i clienti");
  if (!d.coverV) t.push("aggiungi il logo della bottega");
  if (String(d.descrizione || "").trim().length < 100) t.push("racconta qualcosa in più di te e di come lavori");
  if (typeof d.lat !== "number") t.push("metti la bottega sulla mappa, così ti trova chi è vicino");
  if (!String(d.whatsapp || "").trim()) t.push("aggiungi il numero WhatsApp: è lì che arrivano gli ordini");
  if (ps.length < 3) t.push("metti almeno 3 prodotti o esperienze sul banco");
  if (ps.length && noPhoto) t.push(`aggiungi la foto a ${noPhoto === 1 ? "1 prodotto" : noPhoto + " prodotti"}`);
  if ((goods.length || !ps.length) && !String(d.consegna || "").trim()) t.push("spiega come consegni o dove si ritira");
  return t;
}
const delta = (a, b) => (b === 0 ? "" : a === b ? "come la settimana scorsa" : `${a > b ? "+" : "−"}${Math.abs(Math.round((a - b) * 100 / b))}% rispetto alla settimana scorsa`);
const FONTE_NOME = { diretto: "link diretto o passaparola", instagram: "Instagram", facebook: "Facebook", google: "Google", whatsapp: "WhatsApp", locandina: "la tua locandina", biglietto: "i tuoi cartoncini", bing: "Bing" };

/* ---------- l'email ---------- */
function buildEmail(shop, w, prev, from, to) {
  const d = shop.data, url = shopUrl(shop.id), mine = `${SITE}/la-mia-bottega`;
  const per = `dal ${fmtDate(from)} al ${fmtDate(to)}`;
  const t = todo(d);
  const subject = w.visite || w.contatti
    ? `La tua bottega questa settimana: ${w.visite} ${w.visite === 1 ? "visita" : "visite"}${w.contatti ? `, ${w.contatti} ${w.contatti === 1 ? "contatto" : "contatti"}` : ""}`
    : `${d.nome}: idee per farti trovare questa settimana`;
  const canali = Object.entries(w.canali).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${CONTATTI[k]} ${n}`).join(" · ");
  const fonti = Object.entries(w.fonti).filter(([f]) => f !== "diretto").sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${FONTE_NOME[f] || f} (${n})`);
  const box = (n, label, sub) => `<td style="padding:14px 10px;background:#f7f1e3;border-radius:12px;text-align:center;width:33%"><div style="font:700 28px Georgia,serif;color:#2b2118">${n}</div><div style="font:600 13px Arial,sans-serif;color:#6b5d4c;margin-top:4px">${label}</div>${sub ? `<div style="font:12px Arial,sans-serif;color:#9a4a2b;margin-top:4px">${esc(sub)}</div>` : ""}</td>`;
  const tips = t.length ? `<h2 style="font:400 20px Georgia,serif;color:#2b2118;margin:28px 0 8px">Per avere più visite</h2><ul style="margin:0;padding-left:20px;font:15px/1.6 Arial,sans-serif;color:#2b2118">${t.slice(0, 3).map((x) => `<li>${esc(x[0].toUpperCase() + x.slice(1))}</li>`).join("")}</ul>`
    : `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:24px 0 0">🎉 La tua bottega è completa. Per farti trovare anche fuori da internet, stampa la <b>locandina con il QR code</b> da «La mia bottega» e mettila in laboratorio o al mercato.</p>`;
  const nr = shop.recensioni || 0;
  const revTip = nr < 5 && (shop.data.prodotti || []).length
    ? `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:18px 0 0;padding:12px 14px;background:#fff6d9;border-radius:10px">⭐ <b>${nr ? `Hai ${nr} ${nr === 1 ? "recensione" : "recensioni"}.` : "Non hai ancora recensioni."}</b> Chi ti ha comprato qualcosa questa settimana? In «La mia bottega» trovi il messaggio pronto da mandargli su WhatsApp: il link lo porta dritto al modulo della recensione.</p>` : "";
  const zero = !w.visite && !w.contatti
    ? `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:16px 0 0">Questa settimana nessuno è passato dalla tua bottega online. Succede soprattutto all'inizio: il modo più veloce per farti trovare è <b>condividere il link della tua bottega</b> su WhatsApp, Instagram e Facebook, e stampare la locandina con il QR code.</p>` : "";
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#efe9dc;padding:20px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:18px;overflow:hidden">
<tr><td style="height:14px;background:repeating-linear-gradient(90deg,#1f6b8a 0 18px,#fbf6ea 18px 36px);background-color:#1f6b8a"></td></tr>
<tr><td style="padding:26px 26px 8px">
  <img src="${SITE}/img/logo-email.png" alt="Libere Botteghe" width="157" height="48" style="display:block;width:157px;height:48px;max-width:157px;border:0;border-radius:8px;margin-left:-4px">
  <p style="font:600 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a4a2b;margin:22px 0 4px">Il resoconto della settimana · ${esc(per)}</p>
  <h1 style="font:400 28px/1.15 Georgia,serif;color:#2b2118;margin:0">${esc(d.nome)}</h1>
</td></tr>
<tr><td style="padding:14px 20px 0"><table role="presentation" width="100%" cellspacing="6" cellpadding="0"><tr>
  ${box(w.visite, w.visite === 1 ? "visita alla bottega" : "visite alla bottega", delta(w.visite, prev.visite))}
  ${box(w.contatti, w.contatti === 1 ? "contatto" : "contatti", "")}
  ${box(w.ordini, w.ordini === 1 ? "ordine o prenotazione" : "ordini e prenotazioni", "")}
</tr></table></td></tr>
<tr><td style="padding:6px 26px 26px">
  ${canali ? `<p style="font:14px/1.6 Arial,sans-serif;color:#6b5d4c;margin:10px 0 0"><b style="color:#2b2118">Come ti hanno contattato:</b> ${esc(canali)}</p>` : ""}
  ${fonti.length ? `<p style="font:14px/1.6 Arial,sans-serif;color:#6b5d4c;margin:6px 0 0"><b style="color:#2b2118">Da dove sono arrivati:</b> ${esc(fonti.join(", "))}</p>` : ""}
  <p style="font:13px/1.5 Arial,sans-serif;color:#8a7d6c;margin:8px 0 0">«Ordini» sono i messaggi d'ordine aperti su WhatsApp dal cestino: verifica sul telefono quali sono arrivati davvero.</p>
  ${zero}
  ${revTip}
  ${tips}
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 0"><tr>
    <td style="background:#1f6b8a;border-radius:999px"><a href="${mine}" style="display:inline-block;padding:13px 22px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none">Aggiorna la tua bottega</a></td>
    <td style="width:10px"></td>
    <td style="border:1.5px solid #1f6b8a;border-radius:999px"><a href="${url}" style="display:inline-block;padding:11px 20px;font:700 15px Arial,sans-serif;color:#1f6b8a;text-decoration:none">Guardala come i clienti</a></td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 26px 24px;background:#f7f1e3;font:12px/1.6 Arial,sans-serif;color:#8a7d6c">
  Ricevi questa email perché hai una bottega su <a href="${SITE}" style="color:#1f6b8a">Libere Botteghe</a>. I numeri sono conteggi anonimi: non sappiamo chi ha visitato la tua bottega.<br>
  Non vuoi più riceverla? Entra in <a href="${mine}" style="color:#1f6b8a">La mia bottega</a> e togli la spunta «Resoconto settimanale via email». Per domande rispondi pure a questa email.
</td></tr></table></td></tr></table></body></html>`;
  const text = `${d.nome} — il resoconto della settimana (${per})\n\nVisite alla bottega: ${w.visite}${delta(w.visite, prev.visite) ? ` (${delta(w.visite, prev.visite)})` : ""}\nContatti: ${w.contatti}${canali ? ` (${canali})` : ""}\nOrdini e prenotazioni avviati: ${w.ordini}\n${fonti.length ? `Da dove sono arrivati: ${fonti.join(", ")}\n` : ""}\n${nr < 5 && (d.prodotti || []).length ? `Recensioni: ${nr}. In La mia bottega trovi il messaggio pronto per chiederne una ai tuoi clienti.\n\n` : ""}${t.length ? `Per avere più visite:\n${t.slice(0, 3).map((x) => "- " + x).join("\n")}\n\n` : ""}Aggiorna la tua bottega: ${mine}\nGuardala come i clienti: ${url}\n\nNon vuoi più ricevere questa email? In La mia bottega togli la spunta «Resoconto settimanale via email».`;
  return { subject, html, text };
}

/* ---------- invio ---------- */
async function brevo(env, to, mail) {
  const fromAddr = String(env.MAIL_FROM || "noreply@liberebotteghe.it").trim();
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": String(env.BREVO_API_KEY || "").trim(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Libere Botteghe", email: fromAddr }, to: [{ email: to }], ...(env.LB_ADMIN_EMAIL ? { replyTo: { email: env.LB_ADMIN_EMAIL } } : {}), subject: mail.subject, htmlContent: mail.html, textContent: mail.text, tags: ["resoconto-settimanale"] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`brevo_${r.status}`);
}
async function collect(env) {
  const to = day(-1), from = addDays(to, -6), pfrom = addDays(from, -7), pto = addDays(from, -1);
  const [shops, mails, rows, revs] = await Promise.all([
    rest(env, "botteghe?select=id,data"),
    rest(env, "rpc/email_artigiani", { method: "POST", body: {} }),
    rest(env, `statistiche?select=bottega_id,giorno,tipo,fonte,conteggio&giorno=gte.${pfrom}&giorno=lte.${to}`),
    rest(env, "recensioni?select=bottega_id").catch(() => []),
  ]);
  const nRev = {}; for (const r of revs || []) nRev[r.bottega_id] = (nRev[r.bottega_id] || 0) + 1;
  const email = Object.fromEntries((mails || []).map((m) => [m.bottega_id, m.email]));
  return { from, to, list: (shops || []).filter((s) => s.data && s.data.nome).map((s) => ({ ...s, email: email[s.id] || "", recensioni: nRev[s.id] || 0, w: sum(rows || [], s.id, from, to), prev: sum(rows || [], s.id, pfrom, pto) })) };
}
async function sendAll(env, { testTo, force } = {}) {
  const { from, to, list } = await collect(env);
  // mai due invii per la stessa settimana (per esempio un invio a mano e poi quello automatico del lunedì)
  if (!testTo) {
    const cfg = await loadCfg(env);
    const last = cfg.resoconto && cfg.resoconto.periodo;
    if (last === from && !force) return { ok: 0, skip: 0, fail: 0, already: cfg.resoconto };
  }
  let ok = 0, skip = 0, fail = 0;
  for (const s of list) {
    if (!testTo && (s.data.resoconto === false || !s.email)) { skip++; continue; }
    try { await brevo(env, testTo || s.email, buildEmail(s, s.w, s.prev, from, to)); ok++; } catch (_) { fail++; }
    if (testTo && ok >= 3) break; // la prova manda al massimo 3 esempi
  }
  if (!testTo && ok) { try { const c = await loadCfg(env); await saveCfg(env, { ...c, resoconto: { periodo: from, inviato: new Date().toISOString(), email: ok } }); } catch (_) {} }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT) {
    await send(env, env.TELEGRAM_ADMIN_CHAT, testTo
      ? `📬 Prova del resoconto: ${ok} ${ok === 1 ? "email inviata" : "email inviate"} a ${esc(testTo)}${fail ? `, ${fail} non riuscite` : ""}.`
      : `📬 <b>Resoconto settimanale inviato</b> a ${ok} ${ok === 1 ? "bottega" : "botteghe"}${skip ? ` · ${skip} saltate (disattivato o senza email)` : ""}${fail ? ` · ⚠️ ${fail} non riuscite` : ""}.`).catch(() => {});
    if (!testTo) { // il lunedì arrivano anche le novità della settimana, con il testo per Instagram
      try { const n = await novitaText(env, 7); if (!n.empty) await send(env, env.TELEGRAM_ADMIN_CHAT, n.text); } catch (_) {}
    }
  }
  return { ok, skip, fail };
}

/* ---------- punto d'ingresso: /api/report, /api/report/preview, /api/report/test ---------- */
export async function handleReport(request, rawEnv, sub, waitUntil = (p) => p) {
  const env = { ...rawEnv, ...cleanEnv(rawEnv) };
  const url = new URL(request.url);
  const key = request.headers.get("x-lb-secret") || url.searchParams.get("key");
  if (!env.TELEGRAM_SECRET || !eq(key, env.TELEGRAM_SECRET)) return new Response("no", { status: 403 });
  const txt = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (sub === "preview") {
    const { from, to, list } = await collect(env);
    const s = list.find((x) => x.id === url.searchParams.get("id")) || list[0];
    if (!s) return txt("Nessuna bottega.", 404);
    const m = buildEmail(s, s.w, s.prev, from, to);
    return new Response(m.html.replace("<body", `<body data-oggetto="${esc(m.subject)}"`), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (!env.BREVO_API_KEY) return txt("Manca BREVO_API_KEY nelle variabili di Cloudflare.", 503);
  if (sub === "test") {
    if (!env.LB_ADMIN_EMAIL) return txt("Manca LB_ADMIN_EMAIL.", 503);
    const r = await sendAll(env, { testTo: env.LB_ADMIN_EMAIL });
    return txt(r.ok ? `✅ Inviate ${r.ok} email di prova a ${env.LB_ADMIN_EMAIL}.` : `❌ Invio non riuscito: controlla BREVO_API_KEY e che il mittente ${env.MAIL_FROM || "noreply@liberebotteghe.it"} sia autorizzato su Brevo.`, r.ok ? 200 : 502);
  }
  if (sub === "invia") { // invio a mano, dal browser: /api/report/invia?key=… (attende la fine e dice com'è andata)
    const r = await sendAll(env, { force: url.searchParams.get("forza") === "1" });
    if (r.already) return txt(`ℹ️ Il resoconto di questa settimana è già stato inviato (${r.already.email || "?"} email, ${new Date(r.already.inviato).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}). Non lo rimando per non mandare doppioni.`);
    return txt(r.ok ? `✅ Resoconto inviato a ${r.ok} ${r.ok === 1 ? "bottega" : "botteghe"}.${r.skip ? ` ${r.skip} saltate (resoconto disattivato o senza email).` : ""}${r.fail ? ` ⚠️ ${r.fail} non riuscite.` : ""}` : `❌ Nessuna email partita.${r.skip ? ` ${r.skip} botteghe saltate (resoconto disattivato o senza email).` : ""}${r.fail ? ` ${r.fail} invii non riusciti: controlla BREVO_API_KEY.` : ""}`, r.ok ? 200 : 502);
  }
  if (request.method !== "POST") return txt("Method not allowed", 405);
  waitUntil(sendAll(env).catch(() => {}));
  return txt("ok");
}
