// Cloudflare Pages: usa la stessa funzione SEO di Netlify (netlify/edge-functions/seo.js).
// Le pagine pronte restano nella cache di Cloudflare per un minuto, come su Netlify.
import seo from "../netlify/edge-functions/seo.js";

const PAGES = ["/", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi", "/privacy", "/termini", "/cookie", "/la-mia-bottega", "/gestione", "/preferite", "/sitemap.xml"];
const isSeo = (p) => PAGES.includes(p) || p.startsWith("/b/");

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method !== "GET" && request.method !== "HEAD") return ctx.next();
  if (!isSeo(path)) return ctx.next();

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(url.toString(), { method: "GET" });
  if (cache) { const hit = await cache.match(key);
    if (hit) { const h = new Headers(hit.headers); if (!h.get("content-type")?.includes("xml")) h.set("cache-control", "public, max-age=0, must-revalidate"); return new Response(request.method === "HEAD" ? null : hit.body, { status: hit.status, headers: h }); } }

  const asset = async (p) => {
    let r = await env.ASSETS.fetch(new Request(new URL(p, url)));
    for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get("location"); i++)
      r = await env.ASSETS.fetch(new Request(new URL(r.headers.get("location"), url)));
    return r;
  };
  const res = await seo(request, { next: () => asset("/"), asset });

  const headers = new Headers(res.headers);
  const shared = headers.get("netlify-cdn-cache-control");
  headers.delete("netlify-cdn-cache-control"); headers.delete("netlify-vary");
  if (!headers.get("content-type")?.includes("xml")) headers.set("cache-control", "public, max-age=0, must-revalidate");
  const out = new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers });
  if (cache && shared && res.status < 500) {
    const copy = out.clone(); const ch = new Headers(copy.headers); ch.set("cache-control", "public, max-age=60");
    ctx.waitUntil(cache.put(key, new Response(copy.body, { status: copy.status, headers: ch })));
  }
  return out;
}
