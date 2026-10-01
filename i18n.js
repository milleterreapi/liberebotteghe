/* Libere Botteghe — traduzioni (it, en, fr, de).
   Il sito è scritto in italiano; questo file traduce la pagina mentre viene mostrata.
   Per aggiungere o correggere una traduzione modifica il dizionario LB_I18N_DICT in fondo:
   chiave = testo italiano esatto, valore = [inglese, francese, tedesco].
   Nelle chiavi i numeri diventano «§»: "§ botteghe" vale per "3 botteghe", "12 botteghe"… */
(function(){
  "use strict";
  var LANGS = ["it","en","fr","de"];
  var NAMES = {it:"Italiano", en:"English", fr:"Français", de:"Deutsch"};
  function pick(){
    try { var s = localStorage.getItem("lb-lang"); if (LANGS.indexOf(s) >= 0) return s; } catch(e){}
    try { var u = new URLSearchParams(location.search).get("lang"); if (LANGS.indexOf(u) >= 0) return u; } catch(e){}
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++){ var c = String(list[i]).slice(0,2).toLowerCase(); if (LANGS.indexOf(c) >= 0) return c; }
    return "en";
  }
  var lang = pick();
  var LOCALE = {it:"it-IT", en:"en-GB", fr:"fr-FR", de:"de-DE"}[lang];
  var IX = {en:0, fr:1, de:2}[lang];
  document.documentElement.lang = lang;

  var D = {};
  var norm = function(s){ return String(s).replace(/\s+/g," ").trim(); };
  var NUM = /\d+(?:[.,]\d+)*/g;
  var PAT = [];
  function look(k, nums){
    var v = D[k]; if (!v || v[IX] == null) return null;
    var i = 0; return v[IX].replace(/§/g, function(){ var n = nums[i++]; return n == null ? "" : n; });
  }
  /* Traduce un testo italiano già normalizzato; null se non c'è traduzione. */
  function tr(s){
    if (IX == null || !s) return null;
    var nums = []; var k = s.replace(NUM, function(m){ nums.push(m); return "§"; });
    var r = look(k, nums); if (r != null) return r;
    /* simboli all'inizio o alla fine ("✓ Pezzo unico", "Entra →") */
    var m = k.match(/^([^\p{L}§«<"(¿¡]+)?([\s\S]*?\S)(\s*[→↗…:]+)?$/u);
    if (m && (m[1] || m[3])){
      var pre = (m[1] || "").match(/§/g), skip = pre ? pre.length : 0;
      var r2 = look(m[2], nums.slice(skip));
      if (r2 != null) return (m[1] || "").replace(/§/g, function(){ return nums.shift(); }) + r2 + (m[3] || "");
    }
    for (var p = 0; p < PAT.length; p++){
      var pm = s.match(PAT[p][0]);
      if (pm && PAT[p][1][IX] != null) return PAT[p][1][IX].replace(/\$(\d)/g, function(_, d){ var x = pm[+d] || "", y = tr(x); return y == null ? x : y; });
    }
    if (window.__i18nMiss) window.__i18nMiss.add(s);
    return null;
  }
  function t(s){ var r = tr(norm(s)); return r == null ? s : r; }

  var SKIP = "script,style,svg,code,pre,.pvbar,.leaflet-container,[data-noi18n],.langsw";
  var FIELD = "input,textarea,select";
  var FMT = {I:1, B:1, EM:1, STRONG:1, BR:1};
  var ATTRS = ["placeholder","aria-label","title"];
  var done = new WeakMap();
  function fmtOnly(el){
    var c = el.children;
    for (var i = 0; i < c.length; i++){
      var x = c[i];
      if (x.children.length) return false;
      if (FMT[x.tagName] && !x.hasAttribute("style")) continue;
      if (x.tagName === "SPAN" && /^(mono|muted|mono muted|muted mono)$/.test(x.className)) continue;
      return false;
    }
    return true;
  }
  function doText(n){
    var v = n.nodeValue; if (!v || !/\p{L}/u.test(v) || done.get(n) === v) return;
    var r = tr(norm(v)); if (r == null) return;
    var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    var out = lead + r + (/\s$/.test(r) ? "" : trail);
    n.nodeValue = out; done.set(n, out);
  }
  function doAttrs(el){
    for (var i = 0; i < ATTRS.length; i++){
      var a = ATTRS[i], v = el.getAttribute(a); if (!v) continue;
      var key = "@" + a; if (done.get(el) && done.get(el)[key] === v) continue;
      var r = tr(norm(v)); if (r != null){ el.setAttribute(a, r); var o = done.get(el) || {}; o[key] = r; done.set(el, o); }
    }
  }
  function walk(el){
    if (el.nodeType === 3){ doText(el); return; }
    if (el.nodeType !== 1 || el.matches(SKIP)) return;
    doAttrs(el);
    if (el.matches(FIELD)) return;
    if (el.children.length && fmtOnly(el)){
      var h = norm(el.innerHTML), o = done.get(el);
      if (!(o && o.html === el.innerHTML)){
        var r = tr(h);
        if (r != null){ el.innerHTML = r; var o2 = done.get(el) || {}; o2.html = el.innerHTML; done.set(el, o2); return; }
      } else return;
    }
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  }
  function inSkip(n){ var e = n.nodeType === 1 ? n : n.parentElement; return !e || !!e.closest(SKIP); }

  var obs = null;
  function handle(recs){
    obs.disconnect();
    try {
      for (var i = 0; i < recs.length; i++){
        var r = recs[i];
        if (r.type === "childList"){ for (var j = 0; j < r.addedNodes.length; j++){ var n = r.addedNodes[j]; if (n.isConnected && !inSkip(n)) walk(n); } }
        else if (r.type === "characterData"){ if (r.target.isConnected && !inSkip(r.target)) doText(r.target); }
        else if (r.type === "attributes"){ if (r.target.isConnected && !inSkip(r.target)) doAttrs(r.target); }
      }
    } finally { observe(); }
  }
  function observe(){ obs.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS}); }
  function start(){
    D = window.LB_I18N_DICT || {};
    PAT = (window.LB_I18N_PATTERNS || []).map(function(x){ return [new RegExp(x[0]), x[1]]; });
    if (IX != null){
      var tt = tr(norm(document.title)); if (tt) document.title = tt;
      walk(document.body);
      obs = new MutationObserver(handle); observe();
    }
    switcher();
  }
  function setLang(l){
    if (LANGS.indexOf(l) < 0) return;
    try { localStorage.setItem("lb-lang", l); } catch(e){}
    location.reload();
  }
  function switcher(){
    var slot = document.getElementById("langsw"); if (!slot) return;
    slot.innerHTML = LANGS.map(function(l){
      return '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (l === lang) + '" title="' + NAMES[l] + '" aria-label="' + NAMES[l] + '">' + l.toUpperCase() + '</button>';
    }).join("");
    slot.addEventListener("click", function(e){ var b = e.target.closest("[data-lang]"); if (b && b.dataset.lang !== lang) setLang(b.dataset.lang); });
  }

  window.LBI = { lang: lang, locale: LOCALE, t: t, setLang: setLang, start: start };
})();

/* ---------------------------------------------------------------------------
   Dizionario: "testo italiano": ["English", "Français", "Deutsch"]
   --------------------------------------------------------------------------- */
window.LB_I18N_DICT = {
  "Botteghe": ["Shops", "Ateliers", "Werkstätten"],
  "Prodotti": ["Products", "Produits", "Produkte"],
  "La mia bottega": ["My shop", "Mon atelier", "Meine Werkstatt"],
  "Manifesto": ["Manifesto", "Manifeste", "Manifest"],
  "Prezzi": ["Pricing", "Tarifs", "Preise"],
  "Gestione": ["Admin", "Gestion", "Verwaltung"],
  "Cestino": ["Basket", "Panier", "Korb"],
  "Torna al mercato": ["Back to the market", "Retour au marché", "Zurück zum Markt"],
  "Sezioni": ["Sections", "Rubriques", "Bereiche"],
  "Lingua": ["Language", "Langue", "Sprache"],
  "Libere Botteghe · Cose fatte a mano, una diversa dall'altra": ["Libere Botteghe · Handmade things, each one different", "Libere Botteghe · Des objets faits main, tous différents", "Libere Botteghe · Handgemachte Dinge, jedes anders"],
  "Cose fatte a mano, una diversa dall'altra.": ["Handmade things, each one different.", "Des objets faits main, tous différents.", "Handgemachte Dinge, jedes anders."],
  "<i class=\"foot-claim\">Cose fatte a mano, una diversa dall'altra.</i><br>Il mercato online degli artigiani e dei piccoli produttori italiani. Qui si compra direttamente da chi fa le cose, bottega per bottega.": ["<i class=\"foot-claim\">Handmade things, each one different.</i><br>The online market of Italian artisans and small producers. Here you buy directly from the people who make things, shop by shop.", "<i class=\"foot-claim\">Des objets faits main, tous différents.</i><br>Le marché en ligne des artisans et petits producteurs italiens. Ici, on achète directement à ceux qui fabriquent, atelier par atelier.", "<i class=\"foot-claim\">Handgemachte Dinge, jedes anders.</i><br>Der Online-Markt der italienischen Handwerker und kleinen Erzeuger. Hier kaufst du direkt bei denen, die die Dinge herstellen – Werkstatt für Werkstatt."],
  "Il mercato online degli artigiani e dei piccoli produttori italiani. Qui si compra direttamente da chi fa le cose, bottega per bottega.": ["The online market of Italian artisans and small producers. Here you buy directly from the people who make things, shop by shop.", "Le marché en ligne des artisans et petits producteurs italiens. Ici, on achète directement à ceux qui fabriquent, atelier par atelier.", "Der Online-Markt der italienischen Handwerker und kleinen Erzeuger. Hier kaufst du direkt bei denen, die die Dinge herstellen – Werkstatt für Werkstatt."],
  "Le botteghe": ["The shops", "Les ateliers", "Die Werkstätten"],
  "Tutti i prodotti": ["All products", "Tous les produits", "Alle Produkte"],
  "Prezzi per gli artigiani": ["Pricing for artisans", "Tarifs pour les artisans", "Preise für Handwerker"],
  "Il manifesto": ["The manifesto", "Le manifeste", "Das Manifest"],
  "Chi siamo": ["About us", "Qui sommes-nous", "Über uns"],
  "Apri la tua bottega": ["Open your shop", "Ouvrez votre atelier", "Eröffne deine Werkstatt"],
  "Pagamenti e consegne si concordano direttamente con ogni bottega.": ["Payment and delivery are arranged directly with each shop.", "Le paiement et la livraison se règlent directement avec chaque atelier.", "Zahlung und Lieferung vereinbarst du direkt mit jeder Werkstatt."],
  "Informativa privacy": ["Privacy policy", "Politique de confidentialité", "Datenschutzerklärung"],
  "Condizioni d'uso": ["Terms of use", "Conditions d'utilisation", "Nutzungsbedingungen"],
  "Cookie": ["Cookies", "Cookies", "Cookies"],
  "Preferenze cookie": ["Cookie preferences", "Préférences cookies", "Cookie-Einstellungen"],
  "Documenti": ["Documents", "Documents", "Dokumente"],
  "Chiudi": ["Close", "Fermer", "Schließen"],
  "Annulla": ["Cancel", "Annuler", "Abbrechen"],
  "Copia": ["Copy", "Copier", "Kopieren"],
  "Apri": ["Open", "Ouvrir", "Öffnen"],
  "Copiato": ["Copied", "Copié", "Kopiert"],
  "Caricamento…": ["Loading…", "Chargement…", "Wird geladen…"],
  "Sto aprendo le serrande…": ["Opening the shutters…", "On lève les rideaux…", "Die Rollläden gehen hoch…"],
  "Non riesco a collegarmi al database in questo momento. Riprova tra poco.": ["I can't reach the database right now. Please try again shortly.", "Impossible de joindre la base de données pour le moment. Réessayez dans un instant.", "Die Datenbank ist gerade nicht erreichbar. Versuch es gleich noch einmal."],
  "L'area dell'artigiano è disponibile solo in italiano.": ["The artisan area is available in Italian only.", "L'espace artisan n'est disponible qu'en italien.", "Der Bereich für Handwerker ist nur auf Italienisch verfügbar."],
  "Questo documento è disponibile solo in italiano. In caso di dubbi fa fede la versione italiana.": ["This document is available in Italian only. In case of doubt, the Italian version prevails.", "Ce document n'est disponible qu'en italien. En cas de doute, la version italienne fait foi.", "Dieses Dokument ist nur auf Italienisch verfügbar. Im Zweifel gilt die italienische Fassung."],
  "Ceramica": ["Ceramics", "Céramique", "Keramik"],
  "Tessuti": ["Textiles", "Textiles", "Textilien"],
  "Legno": ["Wood", "Bois", "Holz"],
  "Cuoio": ["Leather", "Cuir", "Leder"],
  "Gioielli": ["Jewellery", "Bijoux", "Schmuck"],
  "Miele": ["Honey", "Miel", "Honig"],
  "Alimentari": ["Food", "Épicerie fine", "Lebensmittel"],
  "Vino e liquori": ["Wine and spirits", "Vins et spiritueux", "Wein und Spirituosen"],
  "Cosmesi naturale": ["Natural cosmetics", "Cosmétiques naturels", "Naturkosmetik"],
  "Piante e fiori": ["Plants and flowers", "Plantes et fleurs", "Pflanzen und Blumen"],
  "Altro": ["Other", "Autre", "Sonstiges"],
  "Tutte": ["All", "Tous", "Alle"],
  "Categoria": ["Category", "Catégorie", "Kategorie"],
  "Botteghe libere, <i>fatte a mano.</i>": ["Free shops, <i>made by hand.</i>", "Des ateliers libres, <i>faits main.</i>", "Freie Werkstätten, <i>von Hand gemacht.</i>"],
  "Le botteghe di una volta, <i>a un passo da te.</i>": ["The shops of the old days, <i>just around the corner.</i>", "Les ateliers d'autrefois, <i>à deux pas de chez vous.</i>", "Die Werkstätten von früher, <i>gleich um die Ecke.</i>"],
  "Qui niente è fatto in serie: ceramiche, miele, stoffe, legno e sapori fatti uno per uno da chi li produce. Entra nelle botteghe, riempi il cestino e ordina direttamente all'artigiano.": ["Nothing here is mass-produced: ceramics, honey, fabrics, wood and flavours made one by one by the people who produce them. Step into the shops, fill your basket and order directly from the artisan.", "Ici, rien n'est fait en série : céramiques, miel, tissus, bois et saveurs faits un par un par ceux qui les produisent. Entrez dans les ateliers, remplissez votre panier et commandez directement à l'artisan.", "Hier ist nichts Massenware: Keramik, Honig, Stoffe, Holz und Feinkost, Stück für Stück von denen gemacht, die sie herstellen. Schau in die Werkstätten, füll deinen Korb und bestell direkt beim Handwerker."],
  "Cerca miele, ceramiche, un paese…": ["Search honey, ceramics, a town…", "Cherchez du miel, des céramiques, un village…", "Suche Honig, Keramik, einen Ort…"],
  "Cerca nel mercato": ["Search the market", "Rechercher dans le marché", "Im Markt suchen"],
  "Cerca": ["Search", "Rechercher", "Suchen"],
  "Cerca botteghe, paesi o prodotti": ["Search shops, towns or products", "Rechercher ateliers, villages ou produits", "Werkstätten, Orte oder Produkte suchen"],
  "Cerca un prodotto": ["Search for a product", "Rechercher un produit", "Produkt suchen"],
  "Scopri le botteghe": ["Discover the shops", "Découvrir les ateliers", "Werkstätten entdecken"],
  "Sei un artigiano? Apri gratis la tua bottega": ["Are you an artisan? Open your shop for free", "Vous êtes artisan ? Ouvrez votre atelier gratuitement", "Bist du Handwerker? Eröffne deine Werkstatt kostenlos"],
  "Sei un artigiano? Apri la tua bottega": ["Are you an artisan? Open your shop", "Vous êtes artisan ? Ouvrez votre atelier", "Bist du Handwerker? Eröffne deine Werkstatt"],
  "Province": ["Provinces", "Provinces", "Provinzen"],
  "§ botteghe": ["§ shops", "§ ateliers", "§ Werkstätten"],
  "§ bottega": ["§ shop", "§ atelier", "§ Werkstatt"],
  "§ prodotti": ["§ products", "§ produits", "§ Produkte"],
  "§ prodotto": ["§ product", "§ produit", "§ Produkt"],
  "§ in vetrina": ["§ on display", "§ en vitrine", "§ im Schaufenster"],
  "Scegli il <i>mestiere</i>": ["Choose the <i>craft</i>", "Choisissez le <i>métier</i>", "Wähle das <i>Handwerk</i>"],
  "Tutti i mestieri": ["All crafts", "Tous les métiers", "Alle Handwerke"],
  "Ancora nessuna": ["None yet", "Aucun pour l'instant", "Noch keine"],
  "Trova la bottega <i>più vicina</i>": ["Find the <i>nearest</i> shop", "Trouvez l'atelier <i>le plus proche</i>", "Finde die <i>nächste</i> Werkstatt"],
  "La mappa": ["The map", "La carte", "Die Karte"],
  "Tutta Italia": ["All of Italy", "Toute l'Italie", "Ganz Italien"],
  "bottega in": ["shop in", "atelier dans", "Werkstatt in"],
  "botteghe in": ["shops in", "ateliers dans", "Werkstätten in"],
  "province. Tocca un segnaposto per vedere chi lavora lì.": ["provinces. Tap a pin to see who works there.", "provinces. Touchez un repère pour voir qui y travaille.", "Provinzen. Tippe auf eine Markierung, um zu sehen, wer dort arbeitet."],
  "provincia. Tocca un segnaposto per vedere chi lavora lì.": ["province. Tap a pin to see who works there.", "province. Touchez un repère pour voir qui y travaille.", "Provinz. Tippe auf eine Markierung, um zu sehen, wer dort arbeitet."],
  "Vai alla provincia": ["Go to province", "Aller à la province", "Zur Provinz"],
  "Provincia di": ["Province of ", "Province de ", "Provinz "],
  "Bottega in questo punto": ["Shop at this spot", "Atelier à cet endroit", "Werkstatt an dieser Stelle"],
  "Botteghe in questo punto": ["Shops at this spot", "Ateliers à cet endroit", "Werkstätten an dieser Stelle"],
  "Mostra tutte": ["Show all", "Tout afficher", "Alle anzeigen"],
  "Ogni segnaposto è una bottega, nel punto del suo indirizzo. Toccalo per entrare o per aprire le indicazioni su Google Maps.": ["Each pin is a shop, placed at its address. Tap it to step in or to get directions on Google Maps.", "Chaque repère est un atelier, placé à son adresse. Touchez-le pour entrer ou ouvrir l'itinéraire dans Google Maps.", "Jede Markierung ist eine Werkstatt an ihrer Adresse. Tippe darauf, um hineinzuschauen oder die Route in Google Maps zu öffnen."],
  "Nessuna bottega con posizione corrisponde alla ricerca.": ["No shop with a location matches your search.", "Aucun atelier localisé ne correspond à votre recherche.", "Keine Werkstatt mit Standort passt zu deiner Suche."],
  "Nessuna bottega corrisponde alla ricerca.": ["No shop matches your search.", "Aucun atelier ne correspond à votre recherche.", "Keine Werkstatt passt zu deiner Suche."],
  "Nessun prodotto corrisponde alla ricerca.": ["No product matches your search.", "Aucun produit ne correspond à votre recherche.", "Kein Produkt passt zu deiner Suche."],
  "Quando una bottega inserisce il suo indirizzo compare qui.": ["When a shop adds its address, it appears here.", "Dès qu'un atelier indique son adresse, il apparaît ici.", "Sobald eine Werkstatt ihre Adresse einträgt, erscheint sie hier."],
  "La mappa è disattivata": ["The map is turned off", "La carte est désactivée", "Die Karte ist ausgeschaltet"],
  "La mappa è fornita da OpenStreetMap: per mostrarla, il tuo browser si collega ai loro server. Puoi attivarla quando vuoi.": ["The map is provided by OpenStreetMap: to show it, your browser connects to their servers. You can turn it on whenever you like.", "La carte est fournie par OpenStreetMap : pour l'afficher, votre navigateur se connecte à leurs serveurs. Vous pouvez l'activer quand vous voulez.", "Die Karte stammt von OpenStreetMap: Um sie anzuzeigen, verbindet sich dein Browser mit deren Servern. Du kannst sie jederzeit einschalten."],
  "Mostra la mappa": ["Show the map", "Afficher la carte", "Karte anzeigen"],
  "Maggiori informazioni": ["More information", "En savoir plus", "Mehr erfahren"],
  "Caricamento della mappa…": ["Loading the map…", "Chargement de la carte…", "Karte wird geladen…"],
  "La mappa non si è caricata. Controlla la connessione e ricarica la pagina.": ["The map didn't load. Check your connection and reload the page.", "La carte ne s'est pas chargée. Vérifiez votre connexion et rechargez la page.", "Die Karte wurde nicht geladen. Prüfe deine Verbindung und lade die Seite neu."],
  "Qui comparirà la mappa con le strade": ["The street map will appear here", "La carte des rues apparaîtra ici", "Hier erscheint die Straßenkarte"],
  "Nell'anteprima la mappa di OpenStreetMap non può essere caricata. Sul sito pubblicato vedrai ogni bottega nel punto del suo indirizzo, con zoom e strade.": ["The OpenStreetMap map can't load in the preview. On the live site you'll see each shop at its address, with zoom and streets.", "La carte OpenStreetMap ne peut pas se charger dans l'aperçu. Sur le site publié, vous verrez chaque atelier à son adresse, avec zoom et rues.", "In der Vorschau kann die OpenStreetMap-Karte nicht geladen werden. Auf der veröffentlichten Seite siehst du jede Werkstatt an ihrer Adresse, mit Zoom und Straßen."],
  "Tutte le <i>botteghe</i>": ["All the <i>shops</i>", "Tous les <i>ateliers</i>", "Alle <i>Werkstätten</i>"],
  "Botteghe da <i>non perdere</i>": ["Shops <i>not to miss</i>", "Des ateliers <i>à ne pas manquer</i>", "Werkstätten, <i>die du nicht verpassen solltest</i>"],
  "In evidenza": ["Featured", "En vedette", "Hervorgehoben"],
  "Bottega del mese": ["Shop of the month", "Atelier du mois", "Werkstatt des Monats"],
  "Bottega": ["Shop", "Atelier", "Werkstatt"],
  "Bottega fondatrice": ["Founding shop", "Atelier fondateur", "Gründungswerkstatt"],
  "Botteghe fondatrici": ["Founding shops", "Ateliers fondateurs", "Gründungswerkstätten"],
  "Entra nella bottega": ["Step into the shop", "Entrer dans l'atelier", "In die Werkstatt"],
  "Entra": ["Step in", "Entrer", "Ansehen"],
  "Esplora": ["Explore", "Explorer", "Entdecken"],
  "Leggi di più": ["Read more", "Lire la suite", "Weiterlesen"],
  "La piazza è pronta, <i>manca la tua bottega.</i>": ["The square is ready, <i>it's just missing your shop.</i>", "La place est prête, <i>il ne manque que votre atelier.</i>", "Der Platz ist bereit, <i>es fehlt nur deine Werkstatt.</i>"],
  "Ancora nessun produttore ha aperto la sua bottega. La prima comparirà qui, con la tenda del colore che sceglie e tutti i suoi prodotti.": ["No producer has opened a shop yet. The first one will appear here, with the awning colour it chooses and all its products.", "Aucun producteur n'a encore ouvert son atelier. Le premier apparaîtra ici, avec le store de la couleur de son choix et tous ses produits.", "Noch hat kein Erzeuger seine Werkstatt eröffnet. Die erste erscheint hier, mit der Markise in ihrer Wunschfarbe und allen Produkten."],
  "Apri la prima bottega": ["Open the first shop", "Ouvrir le premier atelier", "Die erste Werkstatt eröffnen"],
  "Come funziona": ["How it works", "Comment ça marche", "So funktioniert's"],
  "Dalla bottega <i>a casa tua</i>": ["From the shop <i>to your home</i>", "De l'atelier <i>à chez vous</i>", "Von der Werkstatt <i>zu dir nach Hause</i>"],
  "Entra in una bottega": ["Step into a shop", "Entrez dans un atelier", "Schau in eine Werkstatt"],
  "Guarda la vetrina, leggi la storia di chi lavora e scegli tra i prodotti con foto e prezzi.": ["Browse the display, read the story of the maker and choose from products with photos and prices.", "Parcourez la vitrine, lisez l'histoire de l'artisan et choisissez parmi les produits avec photos et prix.", "Sieh dir das Schaufenster an, lies die Geschichte der Macher und wähle aus Produkten mit Fotos und Preisen."],
  "Riempi il cestino": ["Fill your basket", "Remplissez votre panier", "Füll deinen Korb"],
  "Ogni bottega ha il suo ordine. Puoi comprare da più artigiani nello stesso giro.": ["Each shop gets its own order. You can buy from several artisans in one go.", "Chaque atelier a sa propre commande. Vous pouvez acheter à plusieurs artisans en une fois.", "Jede Werkstatt bekommt ihre eigene Bestellung. Du kannst in einem Rutsch bei mehreren Handwerkern kaufen."],
  "Ordina all'artigiano": ["Order from the artisan", "Commandez à l'artisan", "Bestell beim Handwerker"],
  "Il messaggio con l'ordine parte su WhatsApp, già scritto. Consegna e pagamento li decidi direttamente con lui.": ["The order message goes out on WhatsApp, already written. You agree delivery and payment directly with the artisan.", "Le message de commande part sur WhatsApp, déjà rédigé. Livraison et paiement se décident directement avec l'artisan.", "Die Bestellnachricht geht fertig formuliert über WhatsApp raus. Lieferung und Zahlung klärst du direkt mit dem Handwerker."],
  "Hai un laboratorio? <i>Apri la tua bottega.</i>": ["Have a workshop? <i>Open your shop.</i>", "Vous avez un atelier ? <i>Ouvrez-le ici.</i>", "Hast du eine Werkstatt? <i>Eröffne sie hier.</i>"],
  "Una vetrina con foto, prezzi e la storia del tuo lavoro": ["A display with photos, prices and the story of your work", "Une vitrine avec photos, prix et l'histoire de votre travail", "Ein Schaufenster mit Fotos, Preisen und der Geschichte deiner Arbeit"],
  "Il tuo laboratorio sulla mappa, con le indicazioni di Google Maps": ["Your workshop on the map, with Google Maps directions", "Votre atelier sur la carte, avec l'itinéraire Google Maps", "Deine Werkstatt auf der Karte, mit Wegbeschreibung über Google Maps"],
  "Gli ordini ti arrivano su WhatsApp e tratti direttamente con il cliente": ["Orders reach you on WhatsApp and you deal directly with the customer", "Les commandes vous arrivent sur WhatsApp et vous traitez directement avec le client", "Bestellungen kommen per WhatsApp und du sprichst direkt mit der Kundschaft"],
  "Gratis il primo anno per le Botteghe fondatrici": ["Free for the first year for Founding shops", "Gratuit la première année pour les Ateliers fondateurs", "Im ersten Jahr kostenlos für Gründungswerkstätten"],
  "Vedi i prezzi": ["See pricing", "Voir les tarifs", "Preise ansehen"],
  "<b>Gratis per il primo anno</b> per le Botteghe fondatrici": ["<b>Free for the first year</b> for Founding shops", "<b>Gratuit la première année</b> pour les Ateliers fondateurs", "<b>Im ersten Jahr kostenlos</b> für Gründungswerkstätten"],
  "<b>Promozione fuori dal sito</b>: facciamo conoscere le botteghe in canali e community private, in Italia e all'estero": ["<b>Promotion beyond the site</b>: we introduce the shops in private channels and communities, in Italy and abroad", "<b>Promotion hors du site</b> : nous faisons connaître les ateliers dans des canaux et communautés privés, en Italie et à l'étranger", "<b>Werbung über die Website hinaus</b>: Wir machen die Werkstätten in privaten Kanälen und Communities bekannt, in Italien und im Ausland"],
  "Oltre il sito": ["Beyond the site", "Au-delà du site", "Über die Website hinaus"],
  "Le tue creazioni <i>viaggiano lontano.</i>": ["Your creations <i>travel far.</i>", "Vos créations <i>voyagent loin.</i>", "Deine Werke <i>reisen weit.</i>"],
  "Libere Botteghe non è solo una vetrina: promuoviamo le botteghe in canali e community private, in Italia e all'estero. Arriviamo agli appassionati di artigianato, agli italiani che vivono fuori e a chi cerca il vero fatto a mano.": ["Libere Botteghe is more than a display: we promote the shops in private channels and communities, in Italy and abroad. We reach craft lovers, Italians living abroad and anyone looking for the real handmade.", "Libere Botteghe n'est pas qu'une vitrine : nous faisons la promotion des ateliers dans des canaux et communautés privés, en Italie et à l'étranger. Nous touchons les passionnés d'artisanat, les Italiens de l'étranger et tous ceux qui cherchent le vrai fait main.", "Libere Botteghe ist mehr als ein Schaufenster: Wir bewerben die Werkstätten in privaten Kanälen und Communities, in Italien und im Ausland. So erreichen wir Kunsthandwerk-Fans, Italiener im Ausland und alle, die echtes Handgemachtes suchen."],
  "In Italia": ["In Italy", "En Italie", "In Italien"],
  "All'estero": ["Abroad", "À l'étranger", "Im Ausland"],
  "Canali privati": ["Private channels", "Canaux privés", "Private Kanäle"],
  "Community di appassionati": ["Enthusiast communities", "Communautés de passionnés", "Communities von Liebhabern"],
  "Il nostro manifesto": ["Our manifesto", "Notre manifeste", "Unser Manifest"],
  "Scegliamo <i>le mani,</i> non gli scaffali.": ["We choose <i>hands,</i> not shelves.", "Choisissons <i>les mains,</i> pas les rayons.", "Wir wählen <i>Hände,</i> nicht Regale."],
  "Perché comprare da artigiani e piccoli produttori invece che dalla grande distribuzione cambia le cose: per chi lavora, per i paesi, per te.": ["Why buying from artisans and small producers instead of big retail changes things: for the people who make, for small towns, for you.", "Pourquoi acheter aux artisans et petits producteurs plutôt qu'à la grande distribution change les choses : pour ceux qui travaillent, pour les villages, pour vous.", "Warum es etwas verändert, bei Handwerkern und kleinen Erzeugern statt bei großen Handelsketten zu kaufen: für die, die arbeiten, für die Dörfer, für dich."],
  "Leggi il manifesto": ["Read the manifesto", "Lire le manifeste", "Manifest lesen"],
  "e altre sei ragioni": ["and six more reasons", "et six autres raisons", "und sechs weitere Gründe"],
  "Dieci ragioni per comprare da artigiani e piccoli produttori invece che dalla grande distribuzione. Ogni acquisto racconta che mondo vogliamo.": ["Ten reasons to buy from artisans and small producers instead of big retail. Every purchase says what kind of world we want.", "Dix raisons d'acheter aux artisans et petits producteurs plutôt qu'à la grande distribution. Chaque achat dit quel monde nous voulons.", "Zehn Gründe, bei Handwerkern und kleinen Erzeugern statt bei großen Handelsketten zu kaufen. Jeder Einkauf erzählt, welche Welt wir wollen."],
  "Compriamo da <i>chi fa.</i>": ["We buy from <i>those who make.</i>", "Achetons à <i>ceux qui font.</i>", "Wir kaufen bei denen, <i>die machen.</i>"],
  "Compriamo da chi fa.": ["We buy from those who make.", "Achetons à ceux qui font.", "Wir kaufen bei denen, die machen."],
  "Dietro ogni oggetto di una bottega c'è un nome, un volto, un laboratorio. Lo scaffale ti dà un prodotto; la bottega ti dà il lavoro di qualcuno che puoi conoscere, chiamare, ringraziare.": ["Behind every object in a shop there's a name, a face, a workshop. A shelf gives you a product; a shop gives you the work of someone you can meet, call and thank.", "Derrière chaque objet d'un atelier, il y a un nom, un visage, un lieu de travail. Le rayon vous donne un produit ; l'atelier vous donne le travail de quelqu'un que vous pouvez connaître, appeler, remercier.", "Hinter jedem Stück aus einer Werkstatt stehen ein Name, ein Gesicht, ein Arbeitsplatz. Das Regal gibt dir ein Produkt; die Werkstatt gibt dir die Arbeit eines Menschen, den du kennenlernen, anrufen und dem du danken kannst."],
  "Un nome e un volto": ["A name and a face", "Un nom et un visage", "Ein Name und ein Gesicht"],
  "Un codice a barre": ["A barcode", "Un code-barres", "Ein Strichcode"],
  "L'unico vale più <i>del tutto uguale.</i>": ["The one-of-a-kind is worth more <i>than the all-the-same.</i>", "L'unique vaut plus <i>que l'identique.</i>", "Das Einzelstück ist mehr wert <i>als das Immergleiche.</i>"],
  "L'unico vale più del tutto uguale.": ["The one-of-a-kind is worth more than the all-the-same.", "L'unique vaut plus que l'identique.", "Das Einzelstück ist mehr wert als das Immergleiche."],
  "Un piatto dipinto a mano non sarà mai identico a un altro. Le piccole differenze sono la firma di chi l'ha fatto, non un difetto da nascondere.": ["A hand-painted plate will never be identical to another. The small differences are the maker's signature, not a flaw to hide.", "Une assiette peinte à la main ne sera jamais identique à une autre. Les petites différences sont la signature de celui qui l'a faite, pas un défaut à cacher.", "Ein handbemalter Teller gleicht nie einem anderen. Die kleinen Unterschiede sind die Handschrift dessen, der ihn gemacht hat, kein Fehler, den man verstecken muss."],
  "Pezzo unico": ["One of a kind", "Pièce unique", "Einzelstück"],
  "Mille copie identiche": ["A thousand identical copies", "Mille copies identiques", "Tausend identische Kopien"],
  "Il giusto prezzo <i>va a chi lavora.</i>": ["The fair price <i>goes to the maker.</i>", "Le juste prix <i>va à celui qui travaille.</i>", "Der faire Preis <i>geht an die, die arbeiten.</i>"],
  "Il giusto prezzo va a chi lavora.": ["The fair price goes to the maker.", "Le juste prix va à celui qui travaille.", "Der faire Preis geht an die, die arbeiten."],
  "Quando compri da un artigiano, quello che paghi arriva a chi ha fatto il lavoro. Non si perde lungo una catena di passaggi, magazzini e intermediari.": ["When you buy from an artisan, what you pay goes to the person who did the work. It doesn't get lost along a chain of hand-offs, warehouses and middlemen.", "Quand vous achetez à un artisan, ce que vous payez revient à celui qui a fait le travail. Rien ne se perd le long d'une chaîne d'étapes, d'entrepôts et d'intermédiaires.", "Wenn du bei einem Handwerker kaufst, kommt dein Geld bei dem an, der die Arbeit gemacht hat. Es versickert nicht in einer Kette aus Zwischenstationen, Lagern und Zwischenhändlern."],
  "Direttamente all'artigiano": ["Straight to the artisan", "Directement à l'artisan", "Direkt an den Handwerker"],
  "Lungo la catena": ["Along the chain", "Le long de la chaîne", "Entlang der Kette"],
  "I soldi restano <i>nei paesi.</i>": ["Money stays <i>in the towns.</i>", "L'argent reste <i>dans les villages.</i>", "Das Geld bleibt <i>in den Dörfern.</i>"],
  "I soldi restano nei paesi.": ["Money stays in the towns.", "L'argent reste dans les villages.", "Das Geld bleibt in den Dörfern."],
  "Ogni acquisto in bottega sostiene un laboratorio, una famiglia, una strada che resta viva. Sono le botteghe a tenere aperti i borghi, non i centri commerciali in periferia.": ["Every purchase from a shop supports a workshop, a family, a street that stays alive. It's the shops that keep villages open, not the out-of-town malls.", "Chaque achat en atelier soutient un lieu de travail, une famille, une rue qui reste vivante. Ce sont les ateliers qui font vivre les villages, pas les centres commerciaux en périphérie.", "Jeder Einkauf in einer Werkstatt unterstützt eine Werkstatt, eine Familie, eine Straße, die lebendig bleibt. Die Werkstätten halten die Dörfer am Leben, nicht die Einkaufszentren am Stadtrand."],
  "Il tuo paese": ["Your town", "Votre village", "Dein Ort"],
  "La periferia commerciale": ["The retail park", "La zone commerciale", "Das Gewerbegebiet"],
  "Il tempo <i>giusto.</i>": ["The <i>right</i> time.", "Le temps <i>qu'il faut.</i>", "Die <i>richtige</i> Zeit."],
  "Il miele ha le sue stagioni, il legno i suoi tempi, la lana il suo telaio. Aspettare qualche giorno un pezzo fatto bene vale più che riceverne subito uno fatto in fretta.": ["Honey has its seasons, wood its time, wool its loom. Waiting a few days for a piece made well is worth more than getting one made in a hurry straight away.", "Le miel a ses saisons, le bois son temps, la laine son métier à tisser. Attendre quelques jours une pièce bien faite vaut mieux que d'en recevoir tout de suite une faite à la hâte.", "Honig hat seine Jahreszeiten, Holz seine Zeit, Wolle ihren Webstuhl. Ein paar Tage auf ein gut gemachtes Stück zu warten ist mehr wert, als sofort eines zu bekommen, das in Eile entstand."],
  "Fatto con calma": ["Made unhurried", "Fait sans hâte", "In Ruhe gemacht"],
  "Prodotto in serie": ["Mass-produced", "Produit en série", "Massenware"],
  "Saperi <i>da non perdere.</i>": ["Skills <i>worth keeping.</i>", "Des savoir-faire <i>à ne pas perdre.</i>", "Wissen, <i>das nicht verloren gehen darf.</i>"],
  "Tornire, intrecciare, tessere, dipingere, smielare: mestieri che si imparano in anni e si perdono in una generazione. Ogni acquisto è un motivo in più per continuare a insegnarli.": ["Turning, weaving, braiding, painting, extracting honey: crafts that take years to learn and can vanish in a generation. Every purchase is one more reason to keep teaching them.", "Tourner, tresser, tisser, peindre, extraire le miel : des métiers qui s'apprennent en des années et se perdent en une génération. Chaque achat est une raison de plus de continuer à les transmettre.", "Drechseln, flechten, weben, malen, Honig schleudern: Handwerke, die man in Jahren lernt und in einer Generation verliert. Jeder Einkauf ist ein Grund mehr, sie weiterzugeben."],
  "Mestieri vivi": ["Living crafts", "Des métiers vivants", "Lebendige Handwerke"],
  "Mestieri dimenticati": ["Forgotten crafts", "Des métiers oubliés", "Vergessene Handwerke"],
  "Meno cose, <i>fatte meglio.</i>": ["Fewer things, <i>made better.</i>", "Moins de choses, <i>mieux faites.</i>", "Weniger Dinge, <i>besser gemacht.</i>"],
  "Un oggetto che si ripara, si usa per anni e si tramanda vale più di dieci da buttare. Comprare dall'artigiano è comprare meno, ma comprare meglio.": ["An object you can repair, use for years and pass on is worth more than ten you throw away. Buying from an artisan means buying less, but buying better.", "Un objet qui se répare, s'utilise des années et se transmet vaut plus que dix objets jetables. Acheter à l'artisan, c'est acheter moins, mais mieux.", "Ein Gegenstand, den man reparieren, jahrelang benutzen und weitergeben kann, ist mehr wert als zehn zum Wegwerfen. Beim Handwerker kaufen heißt weniger kaufen, aber besser."],
  "Dura anni": ["Lasts for years", "Dure des années", "Hält jahrelang"],
  "Usa e getta": ["Throwaway", "Jetable", "Wegwerfware"],
  "Vicino è <i>meglio.</i>": ["Near is <i>better.</i>", "Près, c'est <i>mieux.</i>", "Nah ist <i>besser.</i>"],
  "Comprare da chi lavora vicino a te vuol dire sapere da dove vengono le cose, spesso con meno strada e meno imballaggi. E poter passare a salutare.": ["Buying from people who work near you means knowing where things come from, often with fewer miles and less packaging. And being able to drop by and say hello.", "Acheter à ceux qui travaillent près de chez vous, c'est savoir d'où viennent les choses, souvent avec moins de route et moins d'emballages. Et pouvoir passer dire bonjour.", "Bei denen zu kaufen, die in deiner Nähe arbeiten, heißt zu wissen, woher die Dinge kommen, oft mit weniger Transport und weniger Verpackung. Und man kann auf einen Gruß vorbeischauen."],
  "Dietro l'angolo": ["Around the corner", "Au coin de la rue", "Um die Ecke"],
  "Dall'altra parte del mondo": ["The other side of the world", "À l'autre bout du monde", "Am anderen Ende der Welt"],
  "Parliamoci, <i>davvero.</i>": ["Let's talk, <i>for real.</i>", "Parlons-nous, <i>vraiment.</i>", "Lass uns reden, <i>wirklich.</i>"],
  "Fai una domanda, chiedi una modifica, racconta com'è andata. Qui non c'è un numero verde: c'è una persona. Il rapporto diretto è la nostra garanzia più grande.": ["Ask a question, request a change, tell them how it went. There's no call centre here: there's a person. The direct relationship is our biggest guarantee.", "Posez une question, demandez une modification, racontez comment ça s'est passé. Ici, pas de numéro vert : il y a une personne. La relation directe est notre plus belle garantie.", "Stell eine Frage, bitte um eine Änderung, erzähl, wie es war. Hier gibt es keine Hotline, sondern einen Menschen. Der direkte Kontakt ist unsere größte Garantie."],
  "Una persona": ["A person", "Une personne", "Ein Mensch"],
  "Un call center": ["A call centre", "Un centre d'appels", "Ein Callcenter"],
  "Ogni acquisto <i>è una scelta.</i>": ["Every purchase <i>is a choice.</i>", "Chaque achat <i>est un choix.</i>", "Jeder Einkauf <i>ist eine Entscheidung.</i>"],
  "Ogni volta che scegli una bottega invece di uno scaffale, voti per un'economia più piccola, più vicina, più umana. Libere botteghe, liberi di scegliere.": ["Every time you choose a shop over a shelf, you vote for an economy that's smaller, closer, more human. Free shops, free to choose.", "Chaque fois que vous choisissez un atelier plutôt qu'un rayon, vous votez pour une économie plus petite, plus proche, plus humaine. Ateliers libres, libres de choisir.", "Jedes Mal, wenn du eine Werkstatt statt eines Regals wählst, stimmst du für eine kleinere, nähere, menschlichere Wirtschaft. Freie Werkstätten, frei zu wählen."],
  "La bottega": ["The shop", "L'atelier", "Die Werkstatt"],
  "Lo scaffale": ["The shelf", "Le rayon", "Das Regal"],
  "Firma il manifesto <i>con il tuo prossimo acquisto.</i>": ["Sign the manifesto <i>with your next purchase.</i>", "Signez le manifeste <i>avec votre prochain achat.</i>", "Unterschreib das Manifest <i>mit deinem nächsten Einkauf.</i>"],
  "Entra in una bottega, conosci chi lavora e scegli qualcosa fatto a mano. Poi passa la parola: condividi il manifesto con chi ami.": ["Step into a shop, meet the maker and choose something handmade. Then spread the word: share the manifesto with the people you love.", "Entrez dans un atelier, faites connaissance avec l'artisan et choisissez quelque chose de fait main. Puis passez le mot : partagez le manifeste avec ceux que vous aimez.", "Schau in eine Werkstatt, lern die Macher kennen und wähl etwas Handgemachtes. Dann sag es weiter: Teil das Manifest mit den Menschen, die du magst."],
  "Condividi il manifesto": ["Share the manifesto", "Partager le manifeste", "Manifest teilen"],
  "Il manifesto di Libere Botteghe": ["The Libere Botteghe manifesto", "Le manifeste de Libere Botteghe", "Das Manifest von Libere Botteghe"],
  "Scegliamo le mani, non gli scaffali. Dieci ragioni per comprare da artigiani e piccoli produttori.": ["We choose hands, not shelves. Ten reasons to buy from artisans and small producers.", "Choisissons les mains, pas les rayons. Dix raisons d'acheter aux artisans et petits producteurs.", "Wir wählen Hände, nicht Regale. Zehn Gründe, bei Handwerkern und kleinen Erzeugern zu kaufen."],
  "cose fatte a mano su Libere Botteghe": ["handmade things on Libere Botteghe", "des objets faits main sur Libere Botteghe", "Handgemachtes auf Libere Botteghe"],
  "Link al manifesto copiato": ["Manifesto link copied", "Lien du manifeste copié", "Link zum Manifest kopiert"],
  "Libere Botteghe nasce da un'idea semplice: dare a chi lavora con le mani una vetrina online tutta sua, senza perdersi tra milioni di prodotti fatti in serie.": ["Libere Botteghe comes from a simple idea: give people who work with their hands an online shop window of their own, without getting lost among millions of mass-produced products.", "Libere Botteghe est née d'une idée simple : offrir à ceux qui travaillent de leurs mains une vitrine en ligne bien à eux, sans se perdre parmi des millions de produits fabriqués en série.", "Libere Botteghe entstand aus einer einfachen Idee: Menschen, die mit ihren Händen arbeiten, ein eigenes Online-Schaufenster zu geben, ohne zwischen Millionen Massenprodukten unterzugehen."],
  "Qui ogni bottega è di chi la gestisce. L'artigiano racconta il suo lavoro, sceglie i suoi prezzi e riceve gli ordini direttamente, senza intermediari e senza commissioni sulle vendite.": ["Here every shop belongs to whoever runs it. The artisan tells the story of their work, sets their own prices and receives orders directly, with no middlemen and no commission on sales.", "Ici, chaque atelier appartient à celui qui le tient. L'artisan raconte son travail, fixe ses prix et reçoit les commandes directement, sans intermédiaires ni commission sur les ventes.", "Hier gehört jede Werkstatt dem, der sie führt. Der Handwerker erzählt von seiner Arbeit, legt seine Preise selbst fest und bekommt die Bestellungen direkt, ohne Zwischenhändler und ohne Provision auf die Verkäufe."],
  "Chi compra sa da chi compra: legge la storia della bottega, la trova sulla mappa e scrive all'artigiano. Ogni pezzo è fatto uno per uno, e nessuno è uguale all'altro.": ["Buyers know who they're buying from: they read the shop's story, find it on the map and write to the artisan. Every piece is made one at a time, and no two are alike.", "L'acheteur sait à qui il achète : il lit l'histoire de l'atelier, le trouve sur la carte et écrit à l'artisan. Chaque pièce est faite une à une, et aucune n'est identique à une autre.", "Wer kauft, weiß, bei wem: Man liest die Geschichte der Werkstatt, findet sie auf der Karte und schreibt dem Handwerker. Jedes Stück wird einzeln gefertigt, keines gleicht dem anderen."],
  "Vogliamo arrivare in ogni paese d'Italia dove c'è qualcuno che fa le cose con cura e con le proprie mani.": ["We want to reach every town in Italy where someone makes things with care and with their own hands.", "Nous voulons arriver dans chaque village d'Italie où quelqu'un fait les choses avec soin et de ses propres mains.", "Wir wollen in jeden Ort Italiens, in dem jemand Dinge sorgfältig und mit eigenen Händen herstellt."],
  "<b>Fatto a mano</b><span class=\"muted\">Solo artigiani e piccoli produttori, che realizzano quello che vendono.</span>": ["<b>Handmade</b><span class=\"muted\">Only artisans and small producers who make what they sell.</span>", "<b>Fait main</b><span class=\"muted\">Uniquement des artisans et petits producteurs qui fabriquent ce qu'ils vendent.</span>", "<b>Handgemacht</b><span class=\"muted\">Nur Handwerker und kleine Erzeuger, die herstellen, was sie verkaufen.</span>"],
  "<b>Diretto</b><span class=\"muted\">Ordini e pagamenti si concordano con l'artigiano, senza passaggi in mezzo.</span>": ["<b>Direct</b><span class=\"muted\">Orders and payments are agreed with the artisan, with nobody in between.</span>", "<b>Direct</b><span class=\"muted\">Commandes et paiements se règlent avec l'artisan, sans intermédiaire.</span>", "<b>Direkt</b><span class=\"muted\">Bestellung und Zahlung vereinbarst du mit dem Handwerker, ohne Umwege.</span>"],
  "<b>Vicino</b><span class=\"muted\">Ogni bottega è sulla mappa: puoi scoprire chi lavora nel tuo paese.</span>": ["<b>Local</b><span class=\"muted\">Every shop is on the map: you can discover who works in your own town.</span>", "<b>Proche</b><span class=\"muted\">Chaque atelier est sur la carte : découvrez qui travaille près de chez vous.</span>", "<b>Nah</b><span class=\"muted\">Jede Werkstatt ist auf der Karte: Entdecke, wer in deinem Ort arbeitet.</span>"],
  "Chi c'è dietro": ["Who's behind it", "Qui est derrière", "Wer dahintersteckt"],
  "Tutte le botteghe": ["All shops", "Tous les ateliers", "Alle Werkstätten"],
  "Questa bottega ha chiuso o non esiste più.": ["This shop has closed or no longer exists.", "Cet atelier a fermé ou n'existe plus.", "Diese Werkstatt hat geschlossen oder existiert nicht mehr."],
  "Consegna": ["Delivery", "Livraison", "Lieferung"],
  "Indirizzo": ["Address", "Adresse", "Adresse"],
  "Apri in Google Maps": ["Open in Google Maps", "Ouvrir dans Google Maps", "In Google Maps öffnen"],
  "Indicazioni": ["Directions", "Itinéraire", "Route"],
  "Telefono": ["Phone", "Téléphone", "Telefon"],
  "Email": ["Email", "E-mail", "E-Mail"],
  "Sito": ["Website", "Site web", "Website"],
  "Vedi sulla mappa": ["See on the map", "Voir sur la carte", "Auf der Karte ansehen"],
  "Condividi": ["Share", "Partager", "Teilen"],
  "Copia il link": ["Copy link", "Copier le lien", "Link kopieren"],
  "Link copiato": ["Link copied", "Lien copié", "Link kopiert"],
  "Copia il link dalla barra dell'indirizzo": ["Copy the link from the address bar", "Copiez le lien depuis la barre d'adresse", "Kopiere den Link aus der Adressleiste"],
  "Seleziona il testo e copialo a mano": ["Select the text and copy it manually", "Sélectionnez le texte et copiez-le à la main", "Markiere den Text und kopiere ihn von Hand"],
  "Modifica la mia bottega": ["Edit my shop", "Modifier mon atelier", "Meine Werkstatt bearbeiten"],
  "Sul banco": ["On the counter", "Sur l'étal", "Auf dem Ladentisch"],
  "Il banco è ancora vuoto.": ["The counter is still empty.", "L'étal est encore vide.", "Der Ladentisch ist noch leer."],
  "Aggiungi": ["Add", "Ajouter", "Hinzufügen"],
  "Nel cestino · §": ["In basket · §", "Au panier · §", "Im Korb · §"],
  "Esaurito": ["Sold out", "Épuisé", "Ausverkauft"],
  "Aggiunto al cestino": ["Added to basket", "Ajouté au panier", "In den Korb gelegt"],
  "Recensioni": ["Reviews", "Avis", "Bewertungen"],
  "§ recensioni": ["§ reviews", "§ avis", "§ Bewertungen"],
  "§ recensione": ["§ review", "§ avis", "§ Bewertung"],
  "§ · § recensioni": ["§ · § reviews", "§ · § avis", "§ · § Bewertungen"],
  "§ · § recensione": ["§ · § review", "§ · § avis", "§ · § Bewertung"],
  "§ su §": ["§ out of §", "§ sur §", "§ von §"],
  "§ stella": ["§ star", "§ étoile", "§ Stern"],
  "§ stelle": ["§ stars", "§ étoiles", "§ Sterne"],
  "Voto": ["Rating", "Note", "Bewertung"],
  "Ancora nessuna recensione.": ["No reviews yet.", "Pas encore d'avis.", "Noch keine Bewertungen."],
  "Come verifichiamo le recensioni: può scriverle solo chi è entrato nel sito con la propria email, una per bottega. Non verifichiamo che l'autore abbia acquistato. L'artigiano non può recensire la propria bottega.": ["How we check reviews: only people who have signed in with their own email can write them, one per shop. We don't verify that the author has made a purchase. Artisans can't review their own shop.", "Comment nous vérifions les avis : seules les personnes connectées avec leur propre e-mail peuvent en écrire, un par atelier. Nous ne vérifions pas que l'auteur a effectué un achat. L'artisan ne peut pas évaluer son propre atelier.", "So prüfen wir Bewertungen: Schreiben kann sie nur, wer sich mit der eigenen E-Mail angemeldet hat, eine pro Werkstatt. Wir prüfen nicht, ob die Person etwas gekauft hat. Handwerker können ihre eigene Werkstatt nicht bewerten."],
  "Hai comprato qui? Lascia una recensione": ["Bought here? Leave a review", "Vous avez acheté ici ? Laissez un avis", "Hier gekauft? Hinterlass eine Bewertung"],
  "Per scrivere una recensione entra con la tua email: ti mandiamo un link, senza password.": ["To write a review, sign in with your email: we'll send you a link, no password needed.", "Pour écrire un avis, connectez-vous avec votre e-mail : nous vous envoyons un lien, sans mot de passe.", "Um eine Bewertung zu schreiben, melde dich mit deiner E-Mail an: Wir schicken dir einen Link, ganz ohne Passwort."],
  "La tua email": ["Your email", "Votre e-mail", "Deine E-Mail"],
  "Mandami il link": ["Send me the link", "Envoyez-moi le lien", "Link schicken"],
  "Ho letto l'": ["I have read the ", "J'ai lu la ", "Ich habe die "],
  "e accetto le": [" and accept the ", " et j'accepte les ", " gelesen und akzeptiere die "],
  ". So che i dati della mia bottega saranno pubblicati sul sito.": [". I understand that my shop's details will be published on the site.", ". Je sais que les informations de mon atelier seront publiées sur le site.", ". Mir ist bewusst, dass die Daten meiner Werkstatt auf der Website veröffentlicht werden."],
  "Invio in corso…": ["Sending…", "Envoi en cours…", "Wird gesendet…"],
  "Fatto! Apri la tua posta e tocca il link per entrare. Controlla anche lo spam.": ["Done! Open your inbox and tap the link to sign in. Check your spam folder too.", "C'est fait ! Ouvrez votre messagerie et touchez le lien pour vous connecter. Vérifiez aussi les spams.", "Erledigt! Öffne dein Postfach und tippe auf den Link, um dich anzumelden. Schau auch im Spam-Ordner nach."],
  "Fatto! Apri la tua posta e tocca il link: tornerai qui per scrivere la recensione.": ["Done! Open your inbox and tap the link: you'll come back here to write your review.", "C'est fait ! Ouvrez votre messagerie et touchez le lien : vous reviendrez ici pour écrire votre avis.", "Erledigt! Öffne dein Postfach und tippe auf den Link: Du kommst hierher zurück, um deine Bewertung zu schreiben."],
  "Non sono riuscito a mandare il link: controlla l'email e riprova tra qualche minuto.": ["I couldn't send the link: check the email address and try again in a few minutes.", "Impossible d'envoyer le lien : vérifiez l'adresse e-mail et réessayez dans quelques minutes.", "Der Link konnte nicht gesendet werden: Prüfe die E-Mail-Adresse und versuch es in ein paar Minuten noch einmal."],
  "Non sono riuscito a mandare il link. Riprova tra qualche minuto.": ["I couldn't send the link. Try again in a few minutes.", "Impossible d'envoyer le lien. Réessayez dans quelques minutes.", "Der Link konnte nicht gesendet werden. Versuch es in ein paar Minuten noch einmal."],
  "Questa è la tua bottega: puoi rispondere alle recensioni, ma non recensirla.": ["This is your shop: you can reply to reviews, but not review it.", "C'est votre atelier : vous pouvez répondre aux avis, mais pas l'évaluer.", "Das ist deine Werkstatt: Du kannst auf Bewertungen antworten, sie aber nicht bewerten."],
  "Scrivi una recensione": ["Write a review", "Écrire un avis", "Bewertung schreiben"],
  "Modifica la tua recensione": ["Edit your review", "Modifier votre avis", "Bewertung bearbeiten"],
  "Il tuo nome (sarà pubblico)": ["Your name (will be public)", "Votre nom (sera public)", "Dein Name (wird veröffentlicht)"],
  "Es. Maria R.": ["E.g. Maria R.", "Ex. Maria R.", "z. B. Maria R."],
  "Com'è andata?": ["How did it go?", "Comment ça s'est passé ?", "Wie war's?"],
  "Il prodotto, la cura, la spedizione…": ["The product, the care, the shipping…", "Le produit, le soin, l'expédition…", "Das Produkt, die Sorgfalt, der Versand…"],
  "Pubblica la recensione": ["Publish review", "Publier l'avis", "Bewertung veröffentlichen"],
  "Risposta della bottega": ["The shop's reply", "Réponse de l'atelier", "Antwort der Werkstatt"],
  "La tua risposta": ["Your reply", "Votre réponse", "Deine Antwort"],
  "Pubblica la risposta": ["Publish reply", "Publier la réponse", "Antwort veröffentlichen"],
  "Rispondi": ["Reply", "Répondre", "Antworten"],
  "Modifica la risposta": ["Edit reply", "Modifier la réponse", "Antwort bearbeiten"],
  "Modifica": ["Edit", "Modifier", "Bearbeiten"],
  "Elimina": ["Delete", "Supprimer", "Löschen"],
  "Sì, elimina": ["Yes, delete", "Oui, supprimer", "Ja, löschen"],
  "No": ["No", "Non", "Nein"],
  "Grazie! Recensione pubblicata": ["Thank you! Review published", "Merci ! Avis publié", "Danke! Bewertung veröffentlicht"],
  "Scegli da § a § stelle.": ["Choose from § to § stars.", "Choisissez de § à § étoiles.", "Wähle § bis § Sterne."],
  "Scrivi il tuo nome.": ["Write your name.", "Indiquez votre nom.", "Gib deinen Namen ein."],
  "Recensione eliminata": ["Review deleted", "Avis supprimé", "Bewertung gelöscht"],
  "Risposta pubblicata": ["Reply published", "Réponse publiée", "Antwort veröffentlicht"],
  "Non sono riuscito a pubblicarla. Riprova.": ["I couldn't publish it. Please try again.", "Impossible de la publier. Réessayez.", "Konnte nicht veröffentlicht werden. Bitte versuch es noch einmal."],
  "Non sono riuscito a eliminarla. Riprova.": ["I couldn't delete it. Please try again.", "Impossible de la supprimer. Réessayez.", "Konnte nicht gelöscht werden. Bitte versuch es noch einmal."],
  "Non sono riuscito a salvare la risposta.": ["I couldn't save the reply.", "Impossible d'enregistrer la réponse.", "Die Antwort konnte nicht gespeichert werden."],
  "Sei uscito": ["You're signed out", "Vous êtes déconnecté", "Du bist abgemeldet"],
  "Il cestino": ["Your basket", "Votre panier", "Dein Korb"],
  "Il cestino è vuoto. Entra in una bottega e aggiungi quello che ti piace.": ["Your basket is empty. Step into a shop and add whatever you like.", "Votre panier est vide. Entrez dans un atelier et ajoutez ce qui vous plaît.", "Dein Korb ist leer. Schau in eine Werkstatt und leg hinein, was dir gefällt."],
  "Ogni bottega riceve il suo ordine. Il pagamento e la consegna li concordi direttamente con il produttore.": ["Each shop receives its own order. You agree payment and delivery directly with the producer.", "Chaque atelier reçoit sa propre commande. Le paiement et la livraison se règlent directement avec le producteur.", "Jede Werkstatt bekommt ihre eigene Bestellung. Zahlung und Lieferung vereinbarst du direkt mit dem Erzeuger."],
  "Il messaggio dell'ordine resta in italiano, così l'artigiano lo capisce subito. Se vuoi, aggiungi in fondo una nota nella tua lingua.": ["The order message stays in Italian so the artisan understands it straight away. If you like, add a note in your own language at the end.", "Le message de commande reste en italien pour que l'artisan le comprenne tout de suite. Si vous voulez, ajoutez une note dans votre langue à la fin.", "Die Bestellnachricht bleibt auf Italienisch, damit der Handwerker sie sofort versteht. Wenn du magst, füg am Ende eine Notiz in deiner Sprache hinzu."],
  "Meno": ["Less", "Moins", "Weniger"],
  "Più": ["More", "Plus", "Mehr"],
  "Totale": ["Total", "Total", "Summe"],
  "Invia su WhatsApp": ["Send on WhatsApp", "Envoyer sur WhatsApp", "Per WhatsApp senden"],
  "Copia il messaggio": ["Copy the message", "Copier le message", "Nachricht kopieren"],
  "Svuota": ["Empty", "Vider", "Leeren"],
  "Questa bottega non ha WhatsApp: copia il messaggio e invialo a:": ["This shop doesn't use WhatsApp: copy the message and send it to:", "Cet atelier n'a pas WhatsApp : copiez le message et envoyez-le à :", "Diese Werkstatt hat kein WhatsApp: Kopiere die Nachricht und schicke sie an:"],
  "Questa bottega non ha WhatsApp: copia il messaggio e invialo ai contatti della bottega.": ["This shop doesn't use WhatsApp: copy the message and send it to the shop's contacts.", "Cet atelier n'a pas WhatsApp : copiez le message et envoyez-le aux contacts de l'atelier.", "Diese Werkstatt hat kein WhatsApp: Kopiere die Nachricht und schicke sie an die Kontakte der Werkstatt."],
  "Per artigiani e produttori": ["For artisans and producers", "Pour les artisans et producteurs", "Für Handwerker und Erzeuger"],
  "Entra nella tua <i>bottega</i>": ["Step into your <i>shop</i>", "Entrez dans votre <i>atelier</i>", "Betritt deine <i>Werkstatt</i>"],
  "Scrivi la tua email: ti mandiamo un link per entrare, senza password. Se è la prima volta, la bottega la apri subito dopo.": ["Enter your email: we'll send you a link to sign in, no password needed. If it's your first time, you'll open your shop right after.", "Saisissez votre e-mail : nous vous envoyons un lien pour vous connecter, sans mot de passe. Si c'est la première fois, vous ouvrez votre atelier juste après.", "Gib deine E-Mail ein: Wir schicken dir einen Link zum Anmelden, ganz ohne Passwort. Beim ersten Mal eröffnest du gleich danach deine Werkstatt."],
  "Apri la tua bottega, <i>fai crescere le vendite.</i>": ["Open your shop, <i>grow your sales.</i>", "Ouvrez votre atelier, <i>développez vos ventes.</i>", "Eröffne deine Werkstatt, <i>steigere deinen Umsatz.</i>"],
  "Una vetrina online per il tuo laboratorio, con la mappa e gli ordini su WhatsApp. Scegli quanto farti vedere.": ["An online shop window for your workshop, with the map and WhatsApp orders. Choose how visible you want to be.", "Une vitrine en ligne pour votre atelier, avec la carte et les commandes sur WhatsApp. Choisissez votre visibilité.", "Ein Online-Schaufenster für deine Werkstatt, mit Karte und Bestellungen per WhatsApp. Du entscheidest, wie sichtbar du sein willst."],
  "Apri la tua bottega <i>gratis per il primo anno.</i>": ["Open your shop <i>free for the first year.</i>", "Ouvrez votre atelier <i>gratuitement la première année.</i>", "Eröffne deine Werkstatt <i>im ersten Jahr kostenlos.</i>"],
  "Stiamo aprendo il mercato. Chi apre la bottega adesso non paga niente per § mesi: vetrina, prodotti, mappa, ordini su WhatsApp e promozione nei nostri canali privati in Italia e all'estero, tutto incluso. Prima della scadenza ti avvisiamo con almeno § giorni di anticipo, e potrai scegliere se continuare con un piano o chiudere senza costi.": ["We're opening the market. Shops that open now pay nothing for § months: display, products, map, WhatsApp orders and promotion in our private channels in Italy and abroad, all included. We'll let you know at least § days before it ends, and you can choose to continue with a plan or close at no cost.", "Nous ouvrons le marché. Les ateliers qui ouvrent maintenant ne paient rien pendant § mois : vitrine, produits, carte, commandes sur WhatsApp et promotion dans nos canaux privés en Italie et à l'étranger, tout compris. Nous vous prévenons au moins § jours avant l'échéance, et vous choisissez de continuer avec une formule ou de fermer sans frais.", "Wir eröffnen gerade den Markt. Wer jetzt eine Werkstatt eröffnet, zahlt § Monate lang nichts: Schaufenster, Produkte, Karte, Bestellungen per WhatsApp und Werbung in unseren privaten Kanälen in Italien und im Ausland, alles inklusive. Wir sagen dir mindestens § Tage vor Ablauf Bescheid, und du entscheidest, ob du mit einem Paket weitermachst oder kostenlos schließt."],
  "Apri gratis la tua bottega": ["Open your shop for free", "Ouvrez votre atelier gratuitement", "Eröffne deine Werkstatt kostenlos"],
  "I prezzi dopo il primo anno": ["Prices after the first year", "Les tarifs après la première année", "Preise nach dem ersten Jahr"],
  "Per le Botteghe fondatrici la bottega è gratis per § mesi dall'apertura.": ["For Founding shops, the shop is free for § months from opening.", "Pour les Ateliers fondateurs, l'atelier est gratuit pendant § mois à partir de l'ouverture.", "Für Gründungswerkstätten ist die Werkstatt § Monate ab Eröffnung kostenlos."],
  "Paga ora": ["Pay now", "Payer maintenant", "Jetzt bezahlen"],
  "Richiedi su WhatsApp": ["Request on WhatsApp", "Demander sur WhatsApp", "Per WhatsApp anfragen"],
  "Per attivarlo scrivi a": ["To activate it, write to ", "Pour l'activer, écrivez à ", "Zum Aktivieren schreib an "],
  "Per attivarlo contatta il gestore del mercato.": ["To activate it, contact the market manager.", "Pour l'activer, contactez le gestionnaire du marché.", "Zum Aktivieren wende dich an die Marktverwaltung."],
  "Servizi su misura": ["Tailored services", "Services sur mesure", "Individuelle Leistungen"],
  "Foto dei prodotti, testi della vetrina e apertura della bottega fatta per te. Prezzo su richiesta.": ["Product photos, display texts and your shop set up for you. Price on request.", "Photos des produits, textes de la vitrine et ouverture de l'atelier faites pour vous. Prix sur demande.", "Produktfotos, Schaufenstertexte und Einrichtung der Werkstatt übernehmen wir für dich. Preis auf Anfrage."],
  "Chiedi informazioni": ["Ask for information", "Demander des informations", "Infos anfragen"],
  "Domande frequenti": ["FAQ", "Questions fréquentes", "Häufige Fragen"],
  "Quello che <i>ci chiedono</i>": ["What people <i>ask us</i>", "Ce qu'on <i>nous demande</i>", "Was man <i>uns fragt</i>"],
  "Quanto costa aprire adesso?": ["How much does it cost to open now?", "Combien coûte l'ouverture maintenant ?", "Was kostet die Eröffnung jetzt?"],
  "Niente. Chi apre ora diventa Bottega fondatrice: nessun costo per il primo anno e nessun rinnovo automatico. Prima della scadenza ti avvisiamo e decidi tu.": ["Nothing. Shops that open now become Founding shops: no cost for the first year and no automatic renewal. We'll let you know before it ends and you decide.", "Rien. Ceux qui ouvrent maintenant deviennent Ateliers fondateurs : aucun frais la première année et aucun renouvellement automatique. Nous vous prévenons avant l'échéance et c'est vous qui décidez.", "Nichts. Wer jetzt eröffnet, wird Gründungswerkstatt: keine Kosten im ersten Jahr und keine automatische Verlängerung. Vor Ablauf sagen wir dir Bescheid und du entscheidest."],
  "Come fate conoscere la mia bottega?": ["How do you promote my shop?", "Comment faites-vous connaître mon atelier ?", "Wie macht ihr meine Werkstatt bekannt?"],
  "Oltre al sito, promuoviamo le botteghe in canali e community private, in Italia e all'estero: gruppi di appassionati di artigianato e di prodotti tipici, italiani che vivono fuori e chi cerca il vero fatto a mano. Ti raccontiamo noi dove compare la tua bottega.": ["Besides the site, we promote the shops in private channels and communities, in Italy and abroad: groups of craft and local-produce enthusiasts, Italians living abroad and anyone looking for the real handmade. We'll tell you where your shop appears.", "En plus du site, nous faisons la promotion des ateliers dans des canaux et communautés privés, en Italie et à l'étranger : groupes de passionnés d'artisanat et de produits du terroir, Italiens de l'étranger et tous ceux qui cherchent le vrai fait main. Nous vous disons où votre atelier apparaît.", "Neben der Website bewerben wir die Werkstätten in privaten Kanälen und Communities, in Italien und im Ausland: Gruppen von Liebhabern von Kunsthandwerk und regionalen Produkten, Italiener im Ausland und alle, die echtes Handgemachtes suchen. Wir sagen dir, wo deine Werkstatt erscheint."],
  "Prendete una percentuale sulle vendite?": ["Do you take a percentage of sales?", "Prenez-vous une commission sur les ventes ?", "Nehmt ihr eine Provision auf die Verkäufe?"],
  "No. Gli ordini arrivano direttamente a te su WhatsApp e il cliente paga a te.": ["No. Orders come straight to you on WhatsApp and the customer pays you.", "Non. Les commandes vous arrivent directement sur WhatsApp et le client vous paie directement.", "Nein. Die Bestellungen kommen direkt per WhatsApp zu dir und die Kundschaft bezahlt dich."],
  "Come si paga l'abbonamento?": ["How do I pay for a plan?", "Comment payer l'abonnement ?", "Wie bezahle ich ein Paket?"],
  "Il pagamento si concorda con il gestore del mercato quando attivi il piano. Ricevi sempre la ricevuta o la fattura.": ["Payment is agreed with the market manager when you activate the plan. You always receive a receipt or invoice.", "Le paiement se convient avec le gestionnaire du marché lorsque vous activez la formule. Vous recevez toujours un reçu ou une facture.", "Die Zahlung wird bei Aktivierung des Pakets mit der Marktverwaltung vereinbart. Du bekommst immer eine Quittung oder Rechnung."],
  "Con il pulsante «Paga ora», con carta o PayPal, oppure accordandoti con il gestore. Ricevi sempre la ricevuta o la fattura.": ["With the \"Pay now\" button, by card or PayPal, or by arrangement with the manager. You always receive a receipt or invoice.", "Avec le bouton « Payer maintenant », par carte ou PayPal, ou en vous arrangeant avec le gestionnaire. Vous recevez toujours un reçu ou une facture.", "Über den Button „Jetzt bezahlen“, per Karte oder PayPal, oder nach Absprache mit der Verwaltung. Du bekommst immer eine Quittung oder Rechnung."],
  "Posso cambiare piano?": ["Can I change plan?", "Puis-je changer de formule ?", "Kann ich das Paket wechseln?"],
  "Sì. «In evidenza» e «Bottega del mese» si aggiungono alla bottega quando vuoi e scadono da soli.": ["Yes. \"Featured\" and \"Shop of the month\" can be added to your shop whenever you like and expire on their own.", "Oui. « En vedette » et « Atelier du mois » s'ajoutent à l'atelier quand vous voulez et expirent tout seuls.", "Ja. „Hervorgehoben“ und „Werkstatt des Monats“ kannst du jederzeit dazubuchen, sie laufen von selbst aus."],
  "Cosa mi serve per iniziare?": ["What do I need to get started?", "De quoi ai-je besoin pour commencer ?", "Was brauche ich für den Start?"],
  "Qualche foto dei prodotti, i prezzi e un numero WhatsApp per ricevere gli ordini.": ["A few product photos, the prices and a WhatsApp number to receive orders.", "Quelques photos des produits, les prix et un numéro WhatsApp pour recevoir les commandes.", "Ein paar Produktfotos, die Preise und eine WhatsApp-Nummer für die Bestellungen."],
  "Contatti del gestore:": ["Manager contacts:", "Contacts du gestionnaire :", "Kontakt zur Verwaltung:"],
  "La tua bottega": ["Your shop", "Votre atelier", "Deine Werkstatt"],
  "Vetrina con foto, prezzi e la tua storia": ["Display with photos, prices and your story", "Vitrine avec photos, prix et votre histoire", "Schaufenster mit Fotos, Preisen und deiner Geschichte"],
  "Fino a § prodotti": ["Up to § products", "Jusqu'à § produits", "Bis zu § Produkte"],
  "Segnaposto sulla mappa e link a Google Maps": ["Pin on the map and Google Maps link", "Repère sur la carte et lien Google Maps", "Markierung auf der Karte und Link zu Google Maps"],
  "Ordini diretti su WhatsApp": ["Direct orders on WhatsApp", "Commandes directes sur WhatsApp", "Direkte Bestellungen per WhatsApp"],
  "al mese": ["per month", "par mois", "pro Monat"],
  "per un mese": ["for one month", "pour un mois", "für einen Monat"],
  "In aggiunta alla bottega": ["On top of your shop", "En complément de l'atelier", "Zusätzlich zur Werkstatt"],
  "La tua bottega nella sezione In evidenza della home": ["Your shop in the Featured section of the home page", "Votre atelier dans la rubrique En vedette de l'accueil", "Deine Werkstatt im Bereich „Hervorgehoben“ auf der Startseite"],
  "Prima nell'elenco e nella sua categoria": ["First in the list and in its category", "En tête de liste et de sa catégorie", "Ganz oben in der Liste und in ihrer Kategorie"],
  "Etichetta «In evidenza» sulla scheda": ["\"Featured\" label on the card", "Étiquette « En vedette » sur la fiche", "Label „Hervorgehoben“ auf der Karte"],
  "Un solo posto al mese": ["Only one spot per month", "Une seule place par mois", "Nur ein Platz pro Monat"],
  "Grande vetrina in apertura della home": ["Large showcase at the top of the home page", "Grande vitrine en haut de l'accueil", "Großes Schaufenster ganz oben auf der Startseite"],
  "La tua storia in primo piano": ["Your story in the spotlight", "Votre histoire au premier plan", "Deine Geschichte im Mittelpunkt"],
  "Etichetta «Bottega del mese»": ["\"Shop of the month\" label", "Étiquette « Atelier du mois »", "Label „Werkstatt des Monats“"],
  "Cookie e contenuti esterni": ["Cookies and external content", "Cookies et contenus externes", "Cookies und externe Inhalte"],
  "Usiamo solo strumenti tecnici necessari al sito: accesso degli artigiani, cestino e queste scelte. Per mostrare la mappa delle botteghe ci serve il tuo consenso, perché viene caricata da OpenStreetMap. Niente pubblicità, niente profilazione.": ["We only use technical tools the site needs: artisan sign-in, the basket and these choices. To show the map of shops we need your consent, because it's loaded from OpenStreetMap. No ads, no profiling.", "Nous utilisons uniquement les outils techniques nécessaires au site : connexion des artisans, panier et ces choix. Pour afficher la carte des ateliers, nous avons besoin de votre consentement, car elle est chargée depuis OpenStreetMap. Pas de publicité, pas de profilage.", "Wir nutzen nur technisch notwendige Werkzeuge: Anmeldung der Handwerker, Korb und diese Einstellungen. Für die Karte der Werkstätten brauchen wir deine Einwilligung, weil sie von OpenStreetMap geladen wird. Keine Werbung, kein Profiling."],
  "Accetta": ["Accept", "Accepter", "Akzeptieren"],
  "Rifiuta": ["Reject", "Refuser", "Ablehnen"],
  "Personalizza le scelte": ["Customise", "Personnaliser", "Anpassen"],
  "Chiudi e rifiuta": ["Close and reject", "Fermer et refuser", "Schließen und ablehnen"],
  "Scegli cosa attivare. Puoi cambiare idea in ogni momento dal link «Preferenze cookie» in fondo alla pagina.": ["Choose what to turn on. You can change your mind at any time from the \"Cookie preferences\" link at the bottom of the page.", "Choisissez ce que vous activez. Vous pouvez changer d'avis à tout moment via le lien « Préférences cookies » en bas de page.", "Wähle, was du aktivieren möchtest. Du kannst es jederzeit über den Link „Cookie-Einstellungen“ unten auf der Seite ändern."],
  "<b>Necessari</b>Tengono attivo l'accesso degli artigiani, il cestino e queste scelte. Senza, il sito non funziona. Restano solo nel tuo browser.": ["<b>Necessary</b>They keep artisans signed in and remember the basket and these choices. Without them the site doesn't work. They stay in your browser only.", "<b>Nécessaires</b>Ils maintiennent la connexion des artisans, le panier et ces choix. Sans eux, le site ne fonctionne pas. Ils restent uniquement dans votre navigateur.", "<b>Notwendig</b>Sie halten die Anmeldung der Handwerker, den Korb und diese Einstellungen aktiv. Ohne sie funktioniert die Website nicht. Sie bleiben nur in deinem Browser."],
  "<b>Mappa (OpenStreetMap)</b>Mostra le botteghe su una mappa con le strade. Per farlo il browser scarica la mappa dai server di OpenStreetMap, che ricevono il tuo indirizzo IP. Non usiamo cookie di profilazione o statistiche.": ["<b>Map (OpenStreetMap)</b>Shows the shops on a street map. To do this your browser downloads the map from OpenStreetMap's servers, which receive your IP address. We don't use profiling or analytics cookies.", "<b>Carte (OpenStreetMap)</b>Affiche les ateliers sur une carte avec les rues. Pour cela, votre navigateur télécharge la carte depuis les serveurs d'OpenStreetMap, qui reçoivent votre adresse IP. Nous n'utilisons pas de cookies de profilage ni de statistiques.", "<b>Karte (OpenStreetMap)</b>Zeigt die Werkstätten auf einer Straßenkarte. Dazu lädt dein Browser die Karte von den Servern von OpenStreetMap, die deine IP-Adresse erhalten. Wir verwenden keine Profiling- oder Statistik-Cookies."],
  "Rifiuta i facoltativi": ["Reject optional", "Refuser les optionnels", "Optionale ablehnen"],
  "Salva le scelte": ["Save choices", "Enregistrer mes choix", "Auswahl speichern"],
  "Cookie e strumenti simili": ["Cookies and similar tools", "Cookies et outils similaires", "Cookies und ähnliche Technologien"],
  "Ultimo aggiornamento:": ["Last updated: ", "Dernière mise à jour : ", "Zuletzt aktualisiert: "],
  "Il sito non usa cookie di profilazione, pubblicità o statistiche. Usa solo strumenti tecnici necessari al funzionamento e, se lo permetti, carica la mappa da OpenStreetMap.": ["The site uses no profiling, advertising or analytics cookies. It only uses technical tools needed to work and, if you allow it, loads the map from OpenStreetMap.", "Le site n'utilise pas de cookies de profilage, de publicité ni de statistiques. Il utilise uniquement les outils techniques nécessaires à son fonctionnement et, si vous l'autorisez, charge la carte depuis OpenStreetMap.", "Die Website verwendet keine Profiling-, Werbe- oder Statistik-Cookies. Sie nutzt nur technisch notwendige Werkzeuge und lädt, wenn du es erlaubst, die Karte von OpenStreetMap."],
  "Strumenti tecnici (sempre attivi)": ["Technical tools (always on)", "Outils techniques (toujours actifs)", "Technische Werkzeuge (immer aktiv)"],
  "Non serve il consenso: senza questi strumenti il sito non funziona. Sono salvati solo nel tuo browser (localStorage).": ["No consent is needed: without these tools the site doesn't work. They're stored only in your browser (localStorage).", "Aucun consentement n'est nécessaire : sans ces outils, le site ne fonctionne pas. Ils sont enregistrés uniquement dans votre navigateur (localStorage).", "Keine Einwilligung nötig: Ohne diese Werkzeuge funktioniert die Website nicht. Sie werden nur in deinem Browser gespeichert (localStorage)."],
  "Nome": ["Name", "Nom", "Name"],
  "A cosa serve": ["Purpose", "Finalité", "Zweck"],
  "Durata": ["Duration", "Durée", "Dauer"],
  "Tiene attivo l'accesso degli artigiani alla loro bottega. Esiste solo per chi ha fatto l'accesso.": ["Keeps artisans signed in to their shop. It only exists for people who have signed in.", "Maintient la connexion des artisans à leur atelier. N'existe que pour ceux qui se sont connectés.", "Hält Handwerker in ihrer Werkstatt angemeldet. Existiert nur für angemeldete Nutzer."],
  "Fino all'uscita": ["Until you sign out", "Jusqu'à la déconnexion", "Bis zur Abmeldung"],
  "Ricorda i prodotti nel cestino": ["Remembers the products in your basket", "Mémorise les produits du panier", "Merkt sich die Produkte im Korb"],
  "Finché non lo svuoti": ["Until you empty it", "Jusqu'à ce que vous le vidiez", "Bis du ihn leerst"],
  "Ricorda l'ultima sezione aperta": ["Remembers the last section you opened", "Mémorise la dernière rubrique ouverte", "Merkt sich den zuletzt geöffneten Bereich"],
  "Finché non lo cancelli": ["Until you delete it", "Jusqu'à ce que vous le supprimiez", "Bis du es löschst"],
  "Ricorda le tue scelte su questa pagina": ["Remembers your choices on this page", "Mémorise vos choix sur cette page", "Merkt sich deine Auswahl auf dieser Seite"],
  "Ricorda la lingua che hai scelto": ["Remembers the language you chose", "Mémorise la langue choisie", "Merkt sich die gewählte Sprache"],
  "§ mesi": ["§ months", "§ mois", "§ Monate"],
  "Contenuti esterni (solo con il tuo consenso)": ["External content (only with your consent)", "Contenus externes (uniquement avec votre consentement)", "Externe Inhalte (nur mit deiner Einwilligung)"],
  "Servizio": ["Service", "Service", "Dienst"],
  "Cosa riceve": ["What it receives", "Ce qu'il reçoit", "Was er erhält"],
  "Mappa OpenStreetMap (OpenStreetMap Foundation, Regno Unito)": ["OpenStreetMap map (OpenStreetMap Foundation, United Kingdom)", "Carte OpenStreetMap (OpenStreetMap Foundation, Royaume-Uni)", "OpenStreetMap-Karte (OpenStreetMap Foundation, Vereinigtes Königreich)"],
  "Mostra le botteghe su una mappa con le strade": ["Shows the shops on a street map", "Affiche les ateliers sur une carte avec les rues", "Zeigt die Werkstätten auf einer Straßenkarte"],
  "Il tuo indirizzo IP e le zone di mappa visualizzate. Non installa cookie di profilazione.": ["Your IP address and the map areas you view. It sets no profiling cookies.", "Votre adresse IP et les zones de carte consultées. N'installe pas de cookies de profilage.", "Deine IP-Adresse und die angezeigten Kartenausschnitte. Es werden keine Profiling-Cookies gesetzt."],
  "Il sito usa inoltre fornitori tecnici per caratteri tipografici e librerie (Bunny.net, unpkg, jsDelivr) e per il database (Supabase). Ricevono l'indirizzo IP per consegnare i file, senza cookie di profilazione. I link verso Google Maps, WhatsApp e Instagram aprono quei servizi solo quando li tocchi: da lì valgono le loro regole sulla privacy.": ["The site also uses technical providers for fonts and libraries (Bunny.net, unpkg, jsDelivr) and for the database (Supabase). They receive your IP address to deliver the files, with no profiling cookies. Links to Google Maps, WhatsApp and Instagram only open those services when you tap them: from there, their own privacy rules apply.", "Le site fait aussi appel à des prestataires techniques pour les polices et bibliothèques (Bunny.net, unpkg, jsDelivr) et pour la base de données (Supabase). Ils reçoivent l'adresse IP pour livrer les fichiers, sans cookies de profilage. Les liens vers Google Maps, WhatsApp et Instagram n'ouvrent ces services que lorsque vous les touchez : à partir de là, leurs propres règles de confidentialité s'appliquent.", "Die Website nutzt außerdem technische Anbieter für Schriften und Bibliotheken (Bunny.net, unpkg, jsDelivr) und für die Datenbank (Supabase). Sie erhalten die IP-Adresse, um die Dateien auszuliefern, ohne Profiling-Cookies. Links zu Google Maps, WhatsApp und Instagram öffnen diese Dienste erst, wenn du sie antippst: Ab dort gelten deren Datenschutzregeln."],
  "Le tue scelte": ["Your choices", "Vos choix", "Deine Auswahl"],
  "Stato attuale: la mappa è <b>disattivata</b>.": ["Current status: the map is <b>off</b>.", "État actuel : la carte est <b>désactivée</b>.", "Aktueller Stand: Die Karte ist <b>ausgeschaltet</b>."],
  "Stato attuale: la mappa è <b>attivata</b>.": ["Current status: the map is <b>on</b>.", "État actuel : la carte est <b>activée</b>.", "Aktueller Stand: Die Karte ist <b>eingeschaltet</b>."],
  "Cambia le preferenze": ["Change preferences", "Modifier les préférences", "Einstellungen ändern"],
  "Puoi anche cancellare i dati salvati dalle impostazioni del tuo browser. Per saperne di più su come trattiamo i dati, leggi l'": ["You can also delete saved data from your browser settings. To learn more about how we handle data, read the ", "Vous pouvez aussi effacer les données enregistrées dans les réglages de votre navigateur. Pour en savoir plus sur la façon dont nous traitons les données, lisez la ", "Du kannst gespeicherte Daten auch in den Einstellungen deines Browsers löschen. Mehr dazu, wie wir mit Daten umgehen, steht in der "],
  "Le botteghe d'Italia": ["The shops of Italy", "Les ateliers d'Italie", "Die Werkstätten Italiens"],
  "Libere Botteghe · fatto a mano in Italia": ["Libere Botteghe · handmade in Italy", "Libere Botteghe · fait main en Italie", "Libere Botteghe · handgemacht in Italien"],
  "Prima di iniziare": ["Before you start", "Avant de commencer", "Bevor es losgeht"],
  "Il tuo mestiere": ["Your craft", "Votre métier", "Dein Handwerk"],
  "Il tuo nome": ["Your name", "Votre nom", "Dein Name"],
  "Racconta come lavori e cosa rende speciali i tuoi prodotti.": ["Tell people how you work and what makes your products special.", "Racontez comment vous travaillez et ce qui rend vos produits uniques.", "Erzähl, wie du arbeitest und was deine Produkte besonders macht."]
};

/* Frasi con una parte variabile: $1 è la parte che resta uguale (es. il nome dell'artigiano). */
window.LB_I18N_PATTERNS = [["^di (.+)$", ["by $1", "par $1", "von $1"]]];
