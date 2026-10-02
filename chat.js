/* Libere Botteghe — assistente del sito.
   Risponde alle domande dei visitatori. Se sul server è configurata la chiave
   dell'intelligenza artificiale (ANTHROPIC_API_KEY su Netlify) usa quella;
   altrimenti risponde da solo con le domande frequenti e cercando nel catalogo. */
(function(){
  "use strict";
  var T = function(s){ return (window.LBI && LBI.t) ? LBI.t(s) : s; };
  var LANG = (window.LBI && LBI.lang) || "it";
  var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  var hist = [];          // conversazione per l'intelligenza artificiale
  var aiOff = false;      // diventa true se il server non ha l'intelligenza artificiale
  var busy = false, built = false, root, list, input;

  var CSS = `
.lbc-btn{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px 12px 14px;background:var(--accent,#1f6b88);color:#fff;font:600 15px/1 var(--f-body,system-ui);box-shadow:0 14px 30px -12px rgb(31 107 136 / .7);cursor:pointer}
.lbc-btn svg{width:22px;height:22px}
.lbc-btn[hidden]{display:none}
.lbc{position:fixed;right:18px;bottom:18px;z-index:61;width:min(380px,calc(100vw - 24px));height:min(580px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--surface,#fff);border:1px solid var(--line,#eee5d4);border-radius:20px;box-shadow:0 30px 60px -20px rgb(40 30 10 / .35);overflow:hidden;font-family:var(--f-body,system-ui)}
.lbc[hidden]{display:none}
.lbc-h{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line,#eee5d4);background:var(--bg,#fdfbf7)}
.lbc-h b{font:400 19px/1.1 var(--f-display,Georgia);flex:1}
.lbc-h small{display:block;font:400 12px/1.3 var(--f-body,system-ui);color:var(--muted,#76684f);margin-top:2px}
.lbc-x{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#76684f);padding:4px 8px;border-radius:8px}
.lbc-l{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
.lbc-m{max-width:88%;padding:10px 13px;border-radius:16px;font-size:14.5px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}
.lbc-m.bot{background:var(--sunk,#f6f0e5);color:var(--ink,#2f2618);border-bottom-left-radius:5px;align-self:flex-start}
.lbc-m.me{background:var(--accent,#1f6b88);color:#fff;border-bottom-right-radius:5px;align-self:flex-end}
.lbc-m a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px}
.lbc-acts{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:92%}
.lbc-acts a,.lbc-acts button{font:600 13px/1 var(--f-body,system-ui);padding:8px 12px;border-radius:999px;border:1px solid var(--line,#eee5d4);background:var(--surface,#fff);color:var(--accent,#1f6b88);cursor:pointer;text-decoration:none}
.lbc-res{display:grid;gap:6px;align-self:stretch}
.lbc-res a{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border:1px solid var(--line,#eee5d4);border-radius:12px;text-decoration:none;color:var(--ink,#2f2618);background:var(--surface,#fff);font-size:14px}
.lbc-res a span{color:var(--muted,#76684f);font-size:12.5px;display:block;margin-top:2px}
.lbc-res a em{font-style:normal;font-family:var(--f-mono,monospace);white-space:nowrap}
.lbc-f{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#eee5d4);background:var(--bg,#fdfbf7)}
.lbc-f input{flex:1;min-width:0;border:1px solid var(--line,#eee5d4);border-radius:999px;padding:11px 14px;font:16px var(--f-body,system-ui);background:var(--surface,#fff);color:var(--ink,#2f2618)}
.lbc-f button{border:0;border-radius:999px;padding:0 16px;background:var(--accent,#1f6b88);color:#fff;font:600 14px var(--f-body,system-ui);cursor:pointer}
.lbc-f button:disabled{opacity:.5}
.lbc-note{font-size:11.5px;color:var(--muted,#76684f);padding:0 14px 8px;background:var(--bg,#fdfbf7)}
.lbc-typing{align-self:flex-start;color:var(--muted,#76684f);font-size:13px;padding:2px 6px}
@media (max-width:560px){.lbc{right:8px;left:8px;bottom:8px;width:auto;height:calc(100vh - 16px);height:calc(100dvh - 16px);border-radius:18px}.lbc-btn{right:12px;bottom:12px;padding:12px}.lbc-btn span{display:none}}
@media print{.lbc,.lbc-btn{display:none!important}}`;

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';

  /* ---------- risposte senza intelligenza artificiale ---------- */
  var norm = function(s){ return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
  var INTENTS = [
    { k:/\b(ciao|salve|buongiorno|buonasera|hello|hi|hey|bonjour|salut|hallo|guten tag)\b/, a:"Ciao! Sono l'assistente di Libere Botteghe. Posso aiutarti a trovare un prodotto o una bottega, oppure spiegarti come si ordina.", sug:true },
    { k:/ordin|compr|acquist|cestino|order|buy|basket|cart|command|achet|panier|bestell|kauf|korb/, a:"Per ordinare: entra in una bottega, tocca «Aggiungi» sui prodotti che ti piacciono, poi apri il cestino. Da lì il messaggio d'ordine parte su WhatsApp direttamente all'artigiano, già scritto. Pagamento e consegna li concordi con lui.", acts:[["Tutti i prodotti","products"]] },
    { k:/\bpag(o|are|amento|amenti|a)\b|carta di credito|paypal|bonifico|\bpay|paiement|payer|bezahl|zahlung/, a:"Il pagamento si concorda direttamente con l'artigiano quando gli scrivi su WhatsApp: ognuno indica i metodi che accetta. Libere Botteghe non incassa nulla e non prende commissioni." },
    { k:/spedi|consegn|ritir|estero|tempi|corriere|ship|deliver|abroad|livr|exp[eé]di|versand|liefer|ausland/, a:"Spedizione e consegna le decide ogni bottega: trovi le informazioni nella sua pagina, alla voce «Consegna». Molti artigiani spediscono in tutta Italia e alcuni anche all'estero; altri preferiscono il ritiro in laboratorio. Per esserne sicuro chiedi all'artigiano." },
    { k:/res[oi]|rimbors|restitu|garanzi|difett|rott|return|refund|retour|rembours|r[uü]ckgabe|erstatt/, a:"Resi, rimborsi e garanzia si concordano con l'artigiano, perché la vendita avviene tra te e lui. Se vende come professionista valgono il diritto di recesso e la garanzia previsti dalla legge. Se qualcosa non va, scrivigli: il rapporto è diretto." },
    { k:/\b(sono|siamo) (un |una )?(artigian|produttor)|apri(re)? (una |la |la mia )?bottega|aprire una bottega|vendere (i miei|le mie|sul sito)|iscriv|registrar|mia bottega|\bsell\b|open a shop|my shop|vendre|ouvrir|verkaufen|er[oö]ffnen|mitmachen/, a:"Se sei un artigiano o un piccolo produttore puoi aprire la tua bottega in pochi minuti: entri con la tua email, scrivi la tua storia, aggiungi foto e prezzi. Chi apre adesso diventa Bottega fondatrice ed è gratis per il primo anno.", acts:[["Apri la tua bottega","mine"],["Vedi i prezzi","prezzi"]] },
    { k:/(quanto costa|costo) (aprire|la bottega|il servizio|per gli artigiani)|abbonament|commission|percentual|tariff|\bfees?\b|subscription|abonnement|geb[uü]hr|provision/, a:"Non prendiamo commissioni sulle vendite. Per gli artigiani c'è un piano mensile, ma chi apre adesso come Bottega fondatrice non paga niente per il primo anno.", acts:[["Vedi i prezzi","prezzi"]] },
    { k:/recension|stell|voto|review|rating|avis|bewert/, a:"Le recensioni le può scrivere chi è entrato nel sito con la propria email, una per bottega. L'artigiano può rispondere ma non può recensire la propria bottega." },
    { k:/privacy|dati personali|cookie|gdpr|donn[eé]es personnelles|datenschutz/, a:"Usiamo solo strumenti tecnici necessari e niente pubblicità o profilazione. Trovi tutto nell'informativa privacy e nella pagina dei cookie.", acts:[["Informativa privacy","privacy"],["Cookie","cookie"]] },
    { k:/contatt|gestor|assistenz|email|telefon|scriver|contact|support|kontakt/, a:"Per un prodotto o un ordine scrivi direttamente all'artigiano dalla pagina della sua bottega. Per domande sul sito puoi contattare il gestore di Libere Botteghe.", owner:true },
    { k:/chi siete|chi siamo|cos.? e|progett|manifest|about|who are|qui [eê]tes|wer seid|[uü]ber euch/, a:"Libere Botteghe è un mercato online dove ogni artigiano ha la sua bottega: niente prodotti in serie, niente intermediari. Compri direttamente da chi fa le cose.", acts:[["Chi siamo","chisiamo"],["Il manifesto","manifesto"]] },
    { k:/lingu|inglese|language|english|langue|sprache|deutsch|fran[cç]ais/, a:"Il sito è in italiano, inglese, francese e tedesco: scegli la lingua con i pulsanti IT, EN, FR, DE in alto." },
    { k:/mappa|vicino a me|\bmap\b|near me|carte|karte/, a:"Nella home trovi la mappa con tutte le botteghe: tocca un segnaposto per vedere chi lavora lì e aprire le indicazioni su Google Maps.", acts:[["Le botteghe","market"]] }
  ];
  var STOP = /^(il|lo|la|i|gli|le|un|uno|una|di|da|in|con|su|per|tra|fra|e|o|a|che|mi|ti|si|cerco|cercando|vorrei|voglio|avete|ce|c'e|qualcosa|regalo|un'|del|della|dei|delle|the|a|an|of|for|i|want|looking|some|le|la|les|un|une|des|je|cherche|der|die|das|ein|eine|ich|suche|und|per)$/;

  function searchCatalog(q){
    if (!window.LB) return [];
    var SYN = { honey:"miele", miel:"miele", honig:"miele", ceramic:"ceramic", ceramics:"ceramic", ceramique:"ceramic", keramik:"ceramic", pottery:"ceramic",
      wood:"legno", wooden:"legno", bois:"legno", holz:"legno", leather:"cuoio", cuir:"cuoio", leder:"cuoio", jewel:"gioiell", jewelry:"gioiell", jewellery:"gioiell", bijou:"gioiell", bijoux:"gioiell", schmuck:"gioiell",
      textile:"tess", textiles:"tess", fabric:"tess", tissu:"tess", stoff:"tess", wine:"vino", vin:"vino", wein:"vino", plant:"piant", plants:"piant", flower:"fior", flowers:"fior", fleur:"fior", fleurs:"fior", blume:"fior", blumen:"fior", pflanze:"piant",
      soap:"sapon", savon:"sapon", seife:"sapon", cosmetic:"cosmesi", cosmetics:"cosmesi", food:"alimentar", plate:"piatt", plates:"piatt", assiette:"piatt", teller:"piatt", cup:"tazz", mug:"tazz", tasse:"tazz",
      cushion:"cuscin", coussin:"cuscin", kissen:"cuscin", rug:"tappet", carpet:"tappet", tapis:"tappet", teppich:"tappet", board:"taglier", planche:"taglier", brett:"taglier", tile:"mattonell", carreau:"mattonell", fliese:"mattonell" };
    var words = norm(q).split(/[^a-z0-9]+/).filter(function(w){ return w.length > 2 && !STOP.test(w); }).map(function(w){ return SYN[w] || w; });
    if (!words.length) return [];
    var stem = function(w){ return w.length > 4 ? w.slice(0, -1) : w; };
    var out = [];
    LB.shops().forEach(function(s){
      var shopTxt = norm([s.nome, s.categoria, s.paese, s.produttore, s.descrizione].join(" "));
      (s.prodotti || []).forEach(function(p){
        var txt = norm([p.nome, p.descrizione, p.unita].join(" ")) + " " + shopTxt;
        var score = 0; words.forEach(function(w){ if (txt.indexOf(stem(w)) >= 0) score += norm(p.nome).indexOf(stem(w)) >= 0 ? 3 : 1; });
        if (score) out.push({ score:score, s:s, p:p });
      });
      var ss = 0; words.forEach(function(w){ if (shopTxt.indexOf(stem(w)) >= 0) ss += 1; });
      if (ss && !(s.prodotti || []).length) out.push({ score:ss, s:s });
    });
    return out.sort(function(a, b){ return b.score - a.score; }).slice(0, 5);
  }
  function eur(n){ try { return (Number(n) || 0).toLocaleString((window.LBI && LBI.locale) || "it-IT", { style:"currency", currency:"EUR" }); } catch(e){ return n + " €"; } }

  function localAnswer(q){
    var n = norm(q);
    for (var i = 0; i < INTENTS.length; i++){
      if (INTENTS[i].k.test(n)){
        var it = INTENTS[i];
        var acts = (it.acts || []).slice();
        if (it.owner && window.LB){ var c = (LB.cfg().contatto || {}); if (c.whatsapp) acts.push(["Scrivi al gestore", "wa:" + c.whatsapp]); else if (c.email) acts.push(["Scrivi al gestore", "mailto:" + c.email]); }
        botMsg(T(it.a), acts, null, it.sug);
        return;
      }
    }
    var res = searchCatalog(q);
    if (res.length){ botMsg(T("Ecco cosa ho trovato nelle botteghe:"), null, res); return; }
    botMsg(T("Non ho trovato niente con queste parole. Prova a scrivere cosa cerchi, per esempio «miele», «ceramica» o «regalo in legno», oppure guarda tutti i prodotti."), [["Tutti i prodotti","products"],["Le botteghe","market"]]);
  }

  /* ---------- intelligenza artificiale (se attiva sul server) ---------- */
  function aiAnswer(q){
    hist.push({ role:"user", content:q });
    var ctx = window.LB ? LB.view() : {};
    var ctrl = new AbortController(); var tm = setTimeout(function(){ ctrl.abort(); }, 25000);
    return fetch("/api/chat", { method:"POST", headers:{ "content-type":"application/json" }, signal:ctrl.signal,
      body: JSON.stringify({ messages: hist.slice(-10), lang: LANG, page: ctx }) })
      .then(function(r){ clearTimeout(tm); if (r.status === 503 || r.status === 404) { aiOff = true; throw new Error("off"); } if (!r.ok) throw new Error("err"); return r.json(); })
      .then(function(j){ var t = String(j.reply || "").trim(); if (!t) throw new Error("empty"); hist.push({ role:"assistant", content:t }); botMsg(t, null, null, false, true); })
      .catch(function(){ hist.pop(); localAnswer(q); });
  }

  /* ---------- interfaccia ---------- */
  function linkify(t){
    var h = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return h.replace(/https?:\/\/(?:www\.)?liberebotteghe\.(?:it|netlify\.app)(\/[^\s<)\]]*)?/g, function(_, path){
      path = (path || "/").replace(/[.,;:!?]+$/, "");
      var mp = path.match(/^\/b\/([0-9a-f-]{36})\/p\/([A-Za-z0-9_%-]+)/i), mb = path.match(/^\/b\/([0-9a-f-]{36})\/?$/i);
      var data = mp ? ' data-openp="' + mp[1] + "|" + decodeURIComponent(mp[2]) + '"' : mb ? ' data-open="' + mb[1] + '"' : "";
      var go = { "/":"market", "/prodotti":"products", "/prezzi":"prezzi", "/manifesto":"manifesto", "/chi-siamo":"chisiamo", "/la-mia-bottega":"mine", "/privacy":"privacy", "/termini":"termini", "/cookie":"cookie" }[path];
      if (!data && go) data = ' data-go="' + go + '"';
      var label = "liberebotteghe.it" + (path === "/" ? "" : path);
      try {
        if (window.LB && (mp || mb)){ var sh = LB.shops().filter(function(x){ return x.id === (mp || mb)[1]; })[0];
          if (sh){ label = sh.nome; if (mp){ var pr = (sh.prodotti || []).filter(function(x){ return x.id === decodeURIComponent(mp[2]); })[0]; if (pr) label = pr.nome; } label = "→ " + label; } }
      } catch(e){}
      return '<a href="' + esc(path) + '"' + data + ">" + esc(label) + "</a>";
    });
  }
  function actHtml(a){
    var label = esc(T(a[0])), to = a[1];
    if (/^wa:/.test(to)) return '<a href="https://wa.me/' + esc(to.slice(3).replace(/\D/g, "")) + '" target="_blank" rel="noopener">' + label + "</a>";
    if (/^mailto:/.test(to)) return '<a href="' + esc(to) + '">' + label + "</a>";
    var path = { market:"/", products:"/prodotti", prezzi:"/prezzi", manifesto:"/manifesto", chisiamo:"/chi-siamo", mine:"/la-mia-bottega", privacy:"/privacy", cookie:"/cookie" }[to] || "/";
    return '<a href="' + path + '" data-go="' + esc(to) + '">' + label + "</a>";
  }
  function sugHtml(){
    return '<div class="lbc-acts">' + ["Come si ordina?", "Come si paga?", "Spedite all'estero?", "Voglio aprire una bottega", "Cerco del miele"].map(function(s){
      return '<button type="button" data-lbcq="' + esc(T(s)) + '">' + esc(T(s)) + "</button>"; }).join("") + "</div>";
  }
  function add(html){ var d = document.createElement("div"); d.innerHTML = html; while (d.firstChild) list.appendChild(d.firstChild); list.scrollTop = list.scrollHeight; }
  function botMsg(text, acts, res, sug, ai){
    var h = '<div class="lbc-m bot">' + (ai ? linkify(text) : esc(text)) + "</div>";
    if (res && res.length) h += '<div class="lbc-res">' + res.map(function(r){
      var s = r.s, p = r.p;
      return p ? '<a href="/b/' + esc(s.id) + "/p/" + encodeURIComponent(p.id) + '" data-openp="' + esc(s.id) + "|" + esc(p.id) + '"><div><b>' + esc(p.nome) + "</b><span>" + esc(s.nome) + (s.paese ? " · " + esc(s.paese) : "") + "</span></div><em>" + eur(p.prezzo) + "</em></a>"
               : '<a href="/b/' + esc(s.id) + '" data-open="' + esc(s.id) + '"><div><b>' + esc(s.nome) + "</b><span>" + esc(T(s.categoria || "Bottega")) + (s.paese ? " · " + esc(s.paese) : "") + "</span></div></a>";
    }).join("") + "</div>";
    if (acts && acts.length) h += '<div class="lbc-acts">' + acts.map(actHtml).join("") + "</div>";
    if (sug) h += sugHtml();
    add(h);
  }
  function ask(q){
    q = String(q || "").trim().slice(0, 500); if (!q || busy) return;
    add('<div class="lbc-m me">' + esc(q) + "</div>");
    input.value = ""; busy = true; root.querySelector(".lbc-f button").disabled = true;
    var typing = document.createElement("div"); typing.className = "lbc-typing"; typing.textContent = "…"; list.appendChild(typing); list.scrollTop = list.scrollHeight;
    var done = function(){ typing.remove(); busy = false; root.querySelector(".lbc-f button").disabled = false; input.focus(); };
    if (aiOff){ setTimeout(function(){ typing.remove(); localAnswer(q); busy = false; root.querySelector(".lbc-f button").disabled = false; }, 250); return; }
    var p = aiAnswer(q); if (p && p.then) p.then(done, done); else done();
  }
  function build(){
    if (built) return; built = true;
    root = document.createElement("section"); root.className = "lbc"; root.setAttribute("data-noi18n", ""); root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Assistente di Libere Botteghe");
    root.innerHTML = '<div class="lbc-h"><div style="flex:1"><b>' + esc(T("Chiedi a Libere Botteghe")) + "</b><small>" + esc(T("Prodotti, botteghe, ordini e spedizioni")) + '</small></div><button class="lbc-x" type="button" aria-label="' + esc(T("Chiudi")) + '">×</button></div>'
      + '<div class="lbc-l" aria-live="polite"></div>'
      + '<p class="lbc-note">' + esc(T("Non scrivere dati personali. Per ordini e pagamenti scrivi all'artigiano.")) + "</p>"
      + '<form class="lbc-f"><input type="text" maxlength="500" autocomplete="off" placeholder="' + esc(T("Scrivi una domanda…")) + '" aria-label="' + esc(T("Scrivi una domanda…")) + '"><button type="submit">' + esc(T("Invia")) + "</button></form>";
    document.body.appendChild(root);
    list = root.querySelector(".lbc-l"); input = root.querySelector("input");
    root.querySelector(".lbc-x").addEventListener("click", close);
    root.querySelector("form").addEventListener("submit", function(e){ e.preventDefault(); ask(input.value); });
    root.addEventListener("click", function(e){
      var b = e.target.closest("[data-lbcq]"); if (b){ ask(b.getAttribute("data-lbcq")); return; }
      var a = e.target.closest("a[data-open],a[data-openp],a[data-go]"); if (a && window.innerWidth < 560) setTimeout(close, 50);
    });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !root.hidden) close(); });
    botMsg(T("Ciao! Sono l'assistente di Libere Botteghe. Chiedimi pure: posso aiutarti a trovare un prodotto o una bottega, o spiegarti come funzionano ordini, pagamenti e spedizioni."), null, null, true);
  }
  var btn;
  function open(){ build(); root.hidden = false; btn.hidden = true; setTimeout(function(){ if (window.innerWidth >= 560) input.focus(); }, 30); }
  function close(){ root.hidden = true; btn.hidden = false; }
  function init(){
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    btn = document.createElement("button"); btn.type = "button"; btn.className = "lbc-btn"; btn.setAttribute("data-noi18n", ""); btn.setAttribute("aria-label", T("Fai una domanda"));
    btn.innerHTML = ICON + "<span>" + esc(T("Fai una domanda")) + "</span>";
    btn.addEventListener("click", open);
    document.body.appendChild(btn);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
