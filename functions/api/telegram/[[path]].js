// Cloudflare Pages: /api/telegram (messaggi), /api/telegram/notify (avvisi), /api/telegram/setup (collegamento)
import { handle } from "../../../bot/telegram.mjs";
export const onRequest = (ctx) => {
  const sub = Array.isArray(ctx.params.path) ? ctx.params.path[0] || "" : String(ctx.params.path || "");
  return handle(ctx.request, ctx.env, sub, (p) => ctx.waitUntil(p));
};
