// Libere Botteghe — anteprime di condivisione per ogni bottega.
// Quando un link /b/<id> viene condiviso su WhatsApp, Facebook o altri social,
// questa funzione risponde con nome, descrizione e foto della bottega,
// poi porta subito il visitatore alla pagina della bottega sul sito.
const SUPABASE_URL = "https://rvfwfpndvvpdwobkmxus.supabase.co";
const SUPABASE_KEY = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async (request) => {
  const url = new URL(request.url);
  const id = (url.pathname.split("/")[2] || "").trim();
  const site = url.origin;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.redirect(site + "/", 302);

  let d = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/botteghe?id=eq.${id}&select=data`, { headers: { apikey: SUPABASE_KEY } });
    if (r.ok) { const rows = await r.json(); d = (rows && rows[0] && rows[0].data) || null; }
  } catch (_) { /* in caso di errore mostriamo l'anteprima generale */ }

  const target = `${site}/#bottega-${id}`;
  const title = d && d.nome ? `${d.nome} · Libere Botteghe` : "Libere Botteghe";
  const desc = d
    ? [d.produttore ? `di ${d.produttore}` : "", d.paese || "", d.descrizione || "Cose fatte a mano, una diversa dall'altra."].filter(Boolean).join(" · ").slice(0, 220)
    : "Il mercato online degli artigiani e dei piccoli produttori italiani. Cose fatte a mano, una diversa dall'altra.";
  const img = d && d.coverV
    ? `${SUPABASE_URL}/storage/v1/object/public/foto/${id}/_cover.jpg?v=${encodeURIComponent(d.coverV)}`
    : `${site}/og.png`;

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Libere Botteghe">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(site + url.pathname)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
</head><body style="font-family:system-ui,sans-serif;padding:24px">
<script>location.replace(${JSON.stringify(target)})</script>
<p><a href="${esc(target)}">Apri ${esc(d && d.nome ? d.nome : "Libere Botteghe")}</a></p>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
};

export const config = { path: "/b/*" };
