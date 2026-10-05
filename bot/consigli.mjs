// Libere Botteghe — cosa manca a una bottega per farsi trovare (usato dal resoconto e dal bot).
const isExp = (p) => p && p.tipo === "esperienza";
export function todo(d) {
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
/* numero WhatsApp per i link wa.me (come nel sito) */
export function waNum(s) { let d = String(s || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length <= 10 && !String(s).trim().startsWith("+")) d = "39" + d; return d; }
