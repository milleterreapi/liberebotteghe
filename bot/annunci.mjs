// Libere Botteghe — email di annuncio a tutti gli artigiani (una tantum).
// Si mandano dal bot Telegram del gestore: /annuncio → «Invia a tutti».
// Non parte mai due volte lo stesso annuncio (memorizzato in config.annunci).
// Chi ha tolto la spunta «Resoconto settimanale via email» non la riceve.
import { rest, send, esc, SITE, loadCfg, saveCfg } from "./telegram.mjs";
import { brevo } from "./report.mjs";

const P = (t) => `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 14px">${t}</p>`;
const H2 = (t) => `<h2 style="font:400 20px Georgia,serif;color:#2b2118;margin:24px 0 8px">${t}</h2>`;
const row = (a, b) => `<tr><td style="padding:7px 0;border-bottom:1px solid #efe6d2;font:15px Arial,sans-serif;color:#2b2118">${a}</td><td style="padding:7px 0;border-bottom:1px solid #efe6d2;font:700 15px Arial,sans-serif;color:#7a5506;text-align:right;white-space:nowrap">${b}</td></tr>`;
const table = (rows) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px">${rows.map((r) => row(r[0], r[1])).join("")}</table>`;


/* cornice comune delle email di annuncio */
function cornice({ subject, eyebrow, titolo, corpo, cta, ctaUrl }) {
  const mine = `${SITE}/la-mia-bottega`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#efe9dc;padding:20px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:18px;overflow:hidden">
<tr><td style="height:14px;background:repeating-linear-gradient(90deg,#1f6b8a 0 18px,#fbf6ea 18px 36px);background-color:#1f6b8a"></td></tr>
<tr><td style="padding:26px 26px 6px">
  <img src="${SITE}/img/logo-email.png" alt="Libere Botteghe" width="157" height="48" style="display:block;width:157px;height:48px;max-width:157px;border:0;border-radius:8px;margin-left:-4px">
  <p style="font:600 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a4a2b;margin:22px 0 4px">${eyebrow}</p>
  <h1 style="font:400 28px/1.15 Georgia,serif;color:#2b2118;margin:0 0 18px">${titolo}</h1>
  ${corpo}
  ${cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0"><tr><td style="background:#1f6b8a;border-radius:999px"><a href="${ctaUrl}" style="display:inline-block;padding:13px 22px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none">${cta}</a></td></tr></table>` : ""}
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:22px 0 24px">Per qualsiasi domanda rispondi pure a questa email.<br><br>A presto,<br>Piergiorgio<br>Libere Botteghe</p>
</td></tr>
<tr><td style="padding:16px 26px 24px;background:#f7f1e3;font:12px/1.6 Arial,sans-serif;color:#8a7d6c">
  Ricevi questa email perché hai una bottega su <a href="${SITE}" style="color:#1f6b8a">Libere Botteghe</a>. Non vuoi più ricevere le nostre email? Entra in <a href="${mine}" style="color:#1f6b8a">La mia bottega</a> e togli la spunta «Resoconto settimanale via email».
</td></tr></table></td></tr></table></body></html>`;
}
const LI = (t) => `<li style="margin:0 0 8px">${t}</li>`;
export const ANNUNCI = {
  "condizioni-2026-11": {
    titolo: "Condizioni d'uso aggiornate",
    obbligatorio: true, /* comunicazione di servizio: la ricevono tutti gli artigiani */
    build(d) {
      const ciao = d.produttore ? `Ciao ${esc(String(d.produttore).split(/\s+/)[0])}!` : "Ciao!";
      const subject = "Aggiornamento delle Condizioni d'uso di Libere Botteghe";
      const punti = [
        "<b>Professionista o privato.</b> Ogni bottega deve indicare se vende con partita IVA o come privato: lo mostriamo ai clienti, come chiede la legge. <b>Indicalo in «La mia bottega» (bastano due secondi)</b>.",
        "<b>Come ordiniamo le botteghe.</b> Spieghiamo in chiaro l'ordine: prima gli spazi sponsorizzati, poi le altre dalla più aggiornata.",
        "<b>Pubblicità riconoscibile.</b> «In evidenza», Bottega del mese, camion e aereo in piazza sono segnati come «Sponsorizzata» o «Pubblicità».",
        "<b>Pulsante «Segnala».</b> Chiunque può segnalarci contenuti illegali o scorretti; li esaminiamo in modo motivato.",
        "<b>Più tutele per te.</b> Se dovessimo rimuovere un contenuto o sospendere la bottega ti spieghiamo sempre il motivo; per chiudere definitivamente una bottega ti diamo almeno 30 giorni di preavviso (salvo casi gravi) e puoi sempre fare reclamo.",
      ];
      const html = cornice({ subject, eyebrow: "Comunicazione di servizio", titolo: "Condizioni d'uso aggiornate",
        corpo: `<p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 14px">${ciao}</p>
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 14px">Abbiamo aggiornato le Condizioni d'uso per seguire le regole europee sui siti che mettono in contatto venditori e clienti. Le novità valgono per la tua bottega <b>dal 10 novembre 2026</b>:</p>
  <ul style="margin:0 0 14px;padding-left:20px;font:15px/1.55 Arial,sans-serif;color:#2b2118">${punti.map(LI).join("")}</ul>
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:0 0 14px">Non cambia niente su prezzi e commissioni. Puoi leggere il testo completo qui: <a href="${SITE}/termini" style="color:#1f6b8a">${SITE.replace(/^https:\/\//, "")}/termini</a>. Se non sei d'accordo puoi chiudere la bottega prima di quella data, senza costi.</p>`,
        cta: "Indica come vendi", ctaUrl: `${SITE}/la-mia-bottega` });
      const text = `${ciao}\n\nAbbiamo aggiornato le Condizioni d'uso per seguire le regole europee sui siti che mettono in contatto venditori e clienti. Le novità valgono per la tua bottega dal 10 novembre 2026:\n\n${punti.map((p) => "• " + p.replace(/<[^>]+>/g, "")).join("\n")}\n\nNon cambia niente su prezzi e commissioni. Testo completo: ${SITE}/termini\nSe non sei d'accordo puoi chiudere la bottega prima di quella data, senza costi.\n\nIndica come vendi: ${SITE}/la-mia-bottega\n\nA presto,\nPiergiorgio\nLibere Botteghe`;
      return { subject, html, text };
    },
  },
  "missioni-2026-10": {
    titolo: "Missioni e monete",
    build(d) {
      const mine = `${SITE}/la-mia-bottega`;
      const ciao = d.produttore ? `Ciao ${esc(String(d.produttore).split(/\s+/)[0])}!` : "Ciao!";
      const subject = "🪙 Novità: con le missioni la tua bottega va in prima pagina";
      const guadagna = [
        ["Benvenuto (appena apri il riquadro)", "+20"],
        ["Immagine di copertina", "+20"],
        ["Logo, mappa e Instagram", "+10 ciascuna"],
        ["Racconta la tua storia", "+40"],
        ["5 prodotti con la foto", "+40"],
        ["Prima recensione", "+30"],
        ["5 recensioni", "+60"],
        ["Rispondi a una recensione", "+15"],
        ["<b>Ogni settimana:</b> un prodotto nuovo", "+15"],
        ["<b>Ogni settimana:</b> un post o una storia su Instagram con il tag @liberebotteghe", "+25"],
        ["<b>Porta un artigiano</b>: per ogni bottega che apre con il tuo invito", "+50"],
      ];
      const spendi = [
        ["7 giorni in evidenza in prima pagina", "120 monete"],
        ["30 giorni in evidenza", "400 monete"],
        ["Un post dedicato alla tua bottega sui nostri Instagram e Facebook", "200 monete"],
        ["Candidatura a Bottega del mese", "600 monete"],
      ];
      const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#efe9dc;padding:20px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:18px;overflow:hidden">
<tr><td style="height:14px;background:repeating-linear-gradient(90deg,#1f6b8a 0 18px,#fbf6ea 18px 36px);background-color:#1f6b8a"></td></tr>
<tr><td style="padding:26px 26px 6px">
  <img src="${SITE}/img/logo-email.png" alt="Libere Botteghe" width="157" height="48" style="display:block;width:157px;height:48px;max-width:157px;border:0;border-radius:8px;margin-left:-4px">
  <p style="font:600 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a4a2b;margin:22px 0 4px">Novità per la tua bottega</p>
  <h1 style="font:400 28px/1.15 Georgia,serif;color:#2b2118;margin:0 0 18px">🪙 Missioni e monete</h1>
  ${P(ciao)}
  ${P("Da oggi su Libere Botteghe ci sono le <b>Missioni e monete</b>: completi delle piccole missioni, guadagni monete e le spendi per dare più visibilità alla tua bottega.")}
  ${H2("Come si guadagnano le monete")}
  ${table(guadagna)}
  ${H2("Come si spendono")}
  ${table(spendi)}
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:18px 0 0;padding:12px 14px;background:#fff3cf;border-radius:10px">Una bottega completa arriva già a <b>circa 150 monete</b>: la tua prima settimana in prima pagina è a portata di mano.</p>
  ${P(`<br>Le trovi in «La mia bottega», nel riquadro «Missioni e monete».`)}
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 0"><tr>
    <td style="background:#1f6b8a;border-radius:999px"><a href="${mine}" style="display:inline-block;padding:13px 22px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none">Vai alle tue missioni</a></td>
  </tr></table>
  <p style="font:13px/1.5 Arial,sans-serif;color:#8a7d6c;margin:18px 0 0">Le monete non sono soldi e non si convertono in denaro: servono solo per la visibilità su Libere Botteghe.</p>
  <p style="font:15px/1.6 Arial,sans-serif;color:#2b2118;margin:18px 0 24px">Per qualsiasi domanda rispondi pure a questa email.<br><br>A presto,<br>Piergiorgio<br>Libere Botteghe</p>
</td></tr>
<tr><td style="padding:16px 26px 24px;background:#f7f1e3;font:12px/1.6 Arial,sans-serif;color:#8a7d6c">
  Ricevi questa email perché hai una bottega su <a href="${SITE}" style="color:#1f6b8a">Libere Botteghe</a>. Non vuoi più ricevere le nostre email? Entra in <a href="${mine}" style="color:#1f6b8a">La mia bottega</a> e togli la spunta «Resoconto settimanale via email».
</td></tr></table></td></tr></table></body></html>`;
      const text = `${ciao.replace(/<[^>]+>/g, "")}

Da oggi su Libere Botteghe ci sono le Missioni e monete: completi delle piccole missioni, guadagni monete e le spendi per dare più visibilità alla tua bottega.

Come si guadagnano le monete
${guadagna.map((r) => `• ${r[0].replace(/<[^>]+>/g, "")}: ${r[1]}`).join("\n")}

Come si spendono
${spendi.map((r) => `• ${r[0]}: ${r[1]}`).join("\n")}

Una bottega completa arriva già a circa 150 monete: la tua prima settimana in prima pagina è a portata di mano.

Le trovi in «La mia bottega» → riquadro «Missioni e monete»:
${mine}

Le monete non sono soldi e non si convertono in denaro: servono solo per la visibilità su Libere Botteghe.

Per qualsiasi domanda rispondi pure a questa email.

A presto,
Piergiorgio
Libere Botteghe`;
      return { subject, html, text };
    },
  },
};
export const ULTIMO = "condizioni-2026-11";
export const ELENCO = Object.keys(ANNUNCI);

async function destinatari(env, tutti) {
  const [shops, mails] = await Promise.all([rest(env, "botteghe?select=id,data"), rest(env, "rpc/email_artigiani", { method: "POST", body: {} })]);
  const email = Object.fromEntries((mails || []).map((m) => [m.bottega_id, m.email]));
  const all = (shops || []).filter((s) => s.data && s.data.nome);
  const ok = all.filter((s) => email[s.id] && (tutti || s.data.resoconto !== false)).map((s) => ({ ...s, email: email[s.id] }));
  return { ok, skip: all.length - ok.length };
}
export async function statoAnnuncio(env, id = ULTIMO) {
  const [cfg, d] = await Promise.all([loadCfg(env), destinatari(env, ANNUNCI[id] && ANNUNCI[id].obbligatorio)]);
  return { a: ANNUNCI[id], gia: cfg.annunci && cfg.annunci[id], n: d.ok.length, skip: d.skip };
}
/* testTo: manda un solo esempio a quell'indirizzo */
export async function inviaAnnuncio(env, id = ULTIMO, { testTo } = {}) {
  const a = ANNUNCI[id]; if (!a) throw new Error("annuncio_sconosciuto");
  if (!env.BREVO_API_KEY) throw new Error("manca_brevo");
  const { ok: list, skip } = await destinatari(env, a.obbligatorio);
  if (testTo) { const s = list[0] || { data: { nome: "La tua bottega", produttore: "" } }; await brevo(env, testTo, a.build(s.data)); return { ok: 1, test: true }; }
  const cfg = await loadCfg(env);
  if (cfg.annunci && cfg.annunci[id]) return { gia: cfg.annunci[id] };
  // segno subito l'invio, così un secondo tocco non manda doppioni
  await saveCfg(env, { ...cfg, annunci: { ...(cfg.annunci || {}), [id]: { inviato: new Date().toISOString(), stato: "in corso" } } });
  let ok = 0, fail = 0;
  for (const s of list) { try { await brevo(env, s.email, a.build(s.data)); ok++; } catch (_) { fail++; } }
  try { const c = await loadCfg(env); await saveCfg(env, { ...c, annunci: { ...(c.annunci || {}), [id]: { inviato: new Date().toISOString(), email: ok, errori: fail } } }); } catch (_) {}
  return { ok, fail, skip };
}
export async function annuncioMsg(env) {
  const righe = [], buttons = [];
  for (const id of ELENCO) {
    const st = await statoAnnuncio(env, id);
    if (st.gia) { righe.push(`✅ «${esc(st.a.titolo)}»: inviato${st.gia.email != null ? ` a ${st.gia.email}` : ""} il ${new Date(st.gia.inviato).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}`); continue; }
    righe.push(`📣 <b>«${esc(st.a.titolo)}»</b>: da inviare a <b>${st.n}</b> ${st.n === 1 ? "artigiano" : "artigiani"}${st.skip ? ` (${st.skip} senza email${st.a.obbligatorio ? "" : " o con le email disattivate"})` : ""}\nAnteprima: ${SITE}/api/report/annuncio-anteprima?id=${id}`);
    buttons.push([{ text: `📧 Prova a me`, callback_data: `an:t:${id}` }, { text: `📣 Invia «${st.a.titolo}»`.slice(0, 60), callback_data: `an:a:${id}` }]);
  }
  return { text: righe.join("\n\n"), buttons: buttons.length ? buttons : undefined };
}
export { send };
