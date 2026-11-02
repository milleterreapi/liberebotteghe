// Libere Botteghe — email «La tua bottega ti aspetta» per le botteghe da svegliare
// (ferme da 30 giorni o con la vetrina incompleta: le stesse di /ferme nel bot).
// Ogni email è personale: visite dell'ultimo mese, le 3 cose da sistemare, le monete.
// Mai più di una ogni 30 giorni alla stessa bottega (registro in config.sveglia).
// Non la riceve chi ha tolto la spunta «Resoconto settimanale via email».
import { rest, esc, SITE, day, loadCfg, saveCfg, fermeList, FERMA_GG } from "./telegram.mjs";
import { todo } from "./consigli.mjs";
import { brevo } from "./report.mjs";

const OGNI_GG = 30;
const P = (t, extra = "") => `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 14px${extra}">${t}</p>`;
const cap = (x) => x[0].toUpperCase() + x.slice(1);

/* l'email per una bottega: d = dati, visite = ultimi 30 giorni, gg = giorni dall'ultimo aggiornamento, monete = saldo (o null) */
export function svegliaEmail(d, { visite = 0, gg = 0, monete = null, id = "" } = {}) {
  const mine = `${SITE}/la-mia-bottega`, nome = d.nome || "la tua bottega";
  const ciao = d.produttore ? `Ciao ${esc(String(d.produttore).split(/\s+/)[0])}!` : "Ciao!";
  const t = todo(d).slice(0, 3);
  const subject = visite > 0
    ? `${nome}: ${visite} ${visite === 1 ? "persona è passata" : "persone sono passate"} dalla tua bottega`
    : `${nome}: la tua bottega ti aspetta`;
  const apertura = gg >= FERMA_GG
    ? `È da ${gg} giorni che la tua bottega su Libere Botteghe non viene aggiornata.`
    : "La tua bottega su Libere Botteghe è aperta, ma le mancano ancora alcune cose per farsi trovare.";
  const visiteTxt = visite > 0
    ? `Nell'ultimo mese <b>${visite} ${visite === 1 ? "persona è passata" : "persone sono passate"}</b> a guardarla: vale la pena farle trovare qualcosa di nuovo.`
    : "Nell'ultimo mese l'hanno vista in pochi: con qualche ritocco si fa trovare molto di più.";
  const cose = t.length ? t.map(cap) : ["Metti sul banco un prodotto nuovo: le novità finiscono in prima pagina e nei nostri post su Instagram"];
  const moneteTxt = `Ogni cosa che completi ti fa guadagnare <b>monete</b>: con 120 monete la tua bottega va 7 giorni in prima pagina, con 150 un camion con il tuo nome gira nella piazza del sito.${monete > 0 ? ` <b>Hai già ${monete} ${monete === 1 ? "moneta" : "monete"}.</b>` : ""}`;
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#efe9dc;padding:20px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:18px;overflow:hidden">
<tr><td style="height:14px;background:repeating-linear-gradient(90deg,#1f6b8a 0 18px,#fbf6ea 18px 36px);background-color:#1f6b8a"></td></tr>
<tr><td style="padding:26px 26px 6px">
  <img src="${SITE}/img/logo-email.png" alt="Libere Botteghe" width="157" height="48" style="display:block;width:157px;height:48px;max-width:157px;border:0;border-radius:8px;margin-left:-4px">
  <p style="font:600 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a4a2b;margin:22px 0 4px">La tua bottega ti aspetta</p>
  <h1 style="font:400 28px/1.15 Georgia,serif;color:#2b2118;margin:0 0 18px">${esc(nome)}</h1>
  ${P(ciao)}
  ${P(`${apertura} ${visiteTxt}`)}
  <h2 style="font:400 20px Georgia,serif;color:#2b2118;margin:22px 0 8px">${t.length > 1 ? `${t.length} cose da fare, bastano 5 minuti` : "Una cosa da fare, bastano 5 minuti"}</h2>
  <ol style="margin:0 0 14px;padding-left:22px;font:15px/1.55 Arial,sans-serif;color:#2b2118">${cose.map((x) => `<li style="margin:0 0 8px">${esc(x)}</li>`).join("")}</ol>
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:6px 0 18px;padding:12px 14px;background:#fff3cf;border-radius:10px">🪙 ${moneteTxt}</p>
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 6px"><tr>
    <td style="background:#1f6b8a;border-radius:999px"><a href="${mine}" style="display:inline-block;padding:13px 22px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none">Aggiorna la tua bottega</a></td>
    ${id ? `<td style="width:10px"></td><td style="border:1.5px solid #1f6b8a;border-radius:999px"><a href="${SITE}/b/${id}" style="display:inline-block;padding:11px 20px;font:700 15px Arial,sans-serif;color:#1f6b8a;text-decoration:none">Guardala come i clienti</a></td>` : ""}
  </tr></table>
  ${P("Si fa tutto anche dal telefono: entri con la tua email, senza password. Se ti serve una mano rispondi pure a questa email: possiamo sistemarla insieme, anche con una telefonata.", ";margin-top:18px")}
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 24px">A presto,<br>Piergiorgio<br>Libere Botteghe</p>
</td></tr>
<tr><td style="padding:16px 26px 24px;background:#f7f1e3;font:12px/1.6 Arial,sans-serif;color:#8a7d6c">
  Ricevi questa email perché hai una bottega su <a href="${SITE}" style="color:#1f6b8a">Libere Botteghe</a>. Non vuoi più ricevere le nostre email? Entra in <a href="${mine}" style="color:#1f6b8a">La mia bottega</a> e togli la spunta «Resoconto settimanale via email».
</td></tr></table></td></tr></table></body></html>`;
  const text = `${ciao.replace(/<[^>]+>/g, "")}\n\n${apertura} ${visiteTxt.replace(/<[^>]+>/g, "")}\n\nDa fare (bastano 5 minuti):\n${cose.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n${moneteTxt.replace(/<[^>]+>/g, "")}\n\nAggiorna la tua bottega: ${mine}\n\nSi fa tutto anche dal telefono. Se ti serve una mano rispondi pure a questa email.\n\nA presto,\nPiergiorgio\nLibere Botteghe`;
  return { subject, html, text };
}

/* chi la riceverebbe adesso */
export async function svegliaDestinatari(env, soloId) {
  const since = day(-30);
  const [list, mails, st, mon, cfg] = await Promise.all([
    fermeList(env),
    rest(env, "rpc/email_artigiani", { method: "POST", body: {} }),
    rest(env, `statistiche?select=bottega_id,conteggio&tipo=eq.visita&giorno=gte.${since}`).catch(() => []),
    rest(env, "monete?select=bottega_id,importo").catch(() => null),
    loadCfg(env),
  ]);
  const email = Object.fromEntries((mails || []).map((m) => [m.bottega_id, m.email]));
  const vis = {}; for (const r of st || []) vis[r.bottega_id] = (vis[r.bottega_id] || 0) + (r.conteggio || 0);
  const mn = {}; for (const r of mon || []) mn[r.bottega_id] = (mn[r.bottega_id] || 0) + r.importo;
  const reg = cfg.sveglia || {}, limite = day(-OGNI_GG);
  const out = { ok: [], recenti: [], senzaEmail: [], spente: [], cfg };
  for (const x of list) {
    if (soloId && x.s.id !== soloId) continue;
    const r = { id: x.s.id, d: x.s.data, gg: x.gg, visite: vis[x.s.id] || 0, monete: mon ? (mn[x.s.id] || 0) : null, email: email[x.s.id] || "" };
    if (!r.email) out.senzaEmail.push(r);
    else if (r.d.resoconto === false) out.spente.push(r);
    else if (reg[r.id] && reg[r.id] > limite && !soloId) out.recenti.push(r);
    else out.ok.push(r);
  }
  return out;
}

/* invio: testTo = solo una prova a quell'indirizzo; soloId = una bottega sola */
export async function inviaSveglia(env, { testTo, soloId } = {}) {
  if (!env.BREVO_API_KEY) throw new Error("manca_brevo");
  const D = await svegliaDestinatari(env, soloId);
  if (testTo) {
    const r = D.ok[0] || D.recenti[0] || D.senzaEmail[0] || D.spente[0];
    if (!r) return { ok: 0, nessuna: true };
    await brevo(env, testTo, svegliaEmail(r.d, r)); return { ok: 1, test: true, esempio: r.d.nome };
  }
  let ok = 0, fail = 0; const oggi = day(0), reg = { ...(D.cfg.sveglia || {}) };
  for (const r of D.ok) { try { await brevo(env, r.email, svegliaEmail(r.d, r)); ok++; reg[r.id] = oggi; } catch (_) { fail++; } }
  if (ok) { try { const c = await loadCfg(env); await saveCfg(env, { ...c, sveglia: { ...(c.sveglia || {}), ...reg } }); } catch (_) {} }
  return { ok, fail, recenti: D.recenti.length, senzaEmail: D.senzaEmail.length, spente: D.spente.length, nomi: D.ok.map((r) => r.d.nome) };
}
