/* Libere Botteghe — traduzioni (it, en, fr, de).
   Il sito è scritto in italiano; questo file traduce la pagina mentre viene mostrata.
   Il dizionario è nel file i18n-dict.js (caricato solo per inglese, francese e tedesco):
   chiave = testo italiano esatto, valore = [inglese, francese, tedesco].
   Nelle chiavi i numeri diventano «§»: "§ botteghe" vale per "3 botteghe", "12 botteghe"… */
(function(){
  "use strict";
  var LANGS = ["it","en","fr","de"];
  var NAMES = {it:"Italiano", en:"English", fr:"Français", de:"Deutsch"};
  function pick(){
    try { var u = new URLSearchParams(location.search).get("lang"); if (LANGS.indexOf(u) >= 0) return u; } catch(e){}
    try { var s = localStorage.getItem("lb-lang"); if (LANGS.indexOf(s) >= 0) return s; } catch(e){}
    if (/bot|crawler|spider|slurp|googlebot|bingbot|duckduck|yandex|baidu|facebookexternalhit|lighthouse/i.test(navigator.userAgent || "")) return "it";
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++){ var c = String(list[i]).slice(0,2).toLowerCase(); if (LANGS.indexOf(c) >= 0) return c; }
    return "en";
  }
  var lang = pick();
  var LOCALE = {it:"it-IT", en:"en-GB", fr:"fr-FR", de:"de-DE"}[lang];
  var IX = {en:0, fr:1, de:2}[lang];
  document.documentElement.lang = lang;
  /* il dizionario serve solo a chi non legge in italiano: per gli italiani non si scarica */
  if (IX != null && !window.LB_I18N_DICT) { try { document.write('<script src="/i18n-dict.js"><\/script>'); } catch(e){} }

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
    try { var u = new URL(location.href); if (u.searchParams.has("lang")){ u.searchParams.delete("lang"); location.replace(u.toString()); return; } } catch(e){}
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
