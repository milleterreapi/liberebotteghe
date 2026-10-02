// Cloudflare Pages: l'assistente usa lo stesso codice di Netlify (netlify/functions/chat.mjs).
import chat from "../../netlify/functions/chat.mjs";
export const onRequest = (ctx) => chat(ctx.request, { env: ctx.env });
