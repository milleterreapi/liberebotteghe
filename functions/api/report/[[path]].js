// /api/report (POST, dal database ogni lunedì), /api/report/preview, /api/report/test
import { handleReport } from "../../../bot/report.mjs";
export const onRequest = (ctx) => {
  const sub = Array.isArray(ctx.params.path) ? ctx.params.path[0] || "" : String(ctx.params.path || "");
  return handleReport(ctx.request, ctx.env, sub, (p) => ctx.waitUntil(p));
};
