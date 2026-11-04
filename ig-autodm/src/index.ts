import type { Env } from "./types";
import { handleWebhook, verifySubscription } from "./webhook";
import { handleAdmin } from "./admin";
import { cleanup, processQueue } from "./sender";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/webhook") {
      if (request.method === "GET") return verifySubscription(url, env);
      if (request.method === "POST") return handleWebhook(request, env, ctx);
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return handleAdmin(request, env, url);
    if (url.pathname === "/") return Response.redirect(url.origin + "/admin", 302);
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "17 3 * * *") {
      ctx.waitUntil(cleanup(env));
    }
    ctx.waitUntil(processQueue(env).catch((e) => console.error("processQueue", e)));
  },
} satisfies ExportedHandler<Env>;
