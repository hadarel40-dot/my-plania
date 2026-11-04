// מקבל Webhook של תגובות מאינסטגרם, מאמת חתימה, מזהה מילת מפתח ומכניס לתור
import type { Env } from "./types";
import { activeRulesForMedia, alreadyHandledUser, getAppSettings } from "./db";
import { matchesKeyword, normalize, parseKeywords } from "./match";
import { hmacHex, timingSafeEqual } from "./crypto";
import { processQueue } from "./sender";

/** שלב האימות של מטא כשמגדירים את ה-Webhook */
export function verifySubscription(url: URL, env: Env): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && env.WEBHOOK_VERIFY_TOKEN && timingSafeEqual(token, env.WEBHOOK_VERIFY_TOKEN)) {
    return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

interface CommentChange {
  field: string;
  value: {
    id?: string;
    text?: string;
    parent_id?: string;
    from?: { id?: string; username?: string; self_ig_scoped_id?: string };
    media?: { id?: string; media_product_type?: string };
  };
}

export async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const raw = await request.arrayBuffer();
  const signature = request.headers.get("X-Hub-Signature-256") ?? "";
  if (!env.META_APP_SECRET) return new Response("Not configured", { status: 500 });
  const expected = "sha256=" + (await hmacHex(env.META_APP_SECRET, raw));
  if (!timingSafeEqual(signature, expected)) return new Response("Bad signature", { status: 401 });

  let body: any;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const queued = await enqueueFromPayload(env, body);
  if (queued > 0) ctx.waitUntil(processQueue(env, 5).catch((e) => console.error("processQueue", e)));
  // עונים מהר: מטא שולחת שוב אם אין תשובה תוך כמה שניות
  return new Response("OK");
}

/** מחזיר כמה תגובות נכנסו לתור */
export async function enqueueFromPayload(env: Env, body: any): Promise<number> {
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return 0;
  const settings = await getAppSettings(env);
  if (!settings.enabled) return 0;

  let queued = 0;
  for (const entry of body.entry) {
    const accountId = String(entry?.id ?? "");
    for (const change of (entry?.changes ?? []) as CommentChange[]) {
      if (change?.field !== "comments") continue;
      const v = change.value ?? {};
      const commentId = v.id;
      const mediaId = v.media?.id;
      const userId = v.from?.id;
      const username = v.from?.username ?? "";
      if (!commentId || !mediaId || !userId) continue;
      // לא עונים לעצמנו (כולל התגובות הפומביות שהמערכת עצמה כותבת)
      if (userId === accountId) continue;

      if (settings.testMode) {
        const tester = normalize(settings.testUsername.replace(/^@/, ""));
        if (!tester || normalize(username) !== tester) continue;
      }

      const rules = await activeRulesForMedia(env, mediaId);
      const rule = rules.find((r) => matchesKeyword(v.text ?? "", parseKeywords(r.keywords)));
      if (!rule) continue;
      // הודעה אחת לכל אדם על כל ריל, גם אם הגיב כמה פעמים
      if (await alreadyHandledUser(env, rule.id, userId)) continue;

      const now = Date.now();
      const res = await env.DB.prepare(
        `INSERT OR IGNORE INTO comments
           (comment_id, rule_id, media_id, user_id, username, text, status, attempts, received_at, next_try_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      )
        .bind(commentId, rule.id, mediaId, userId, username, (v.text ?? "").slice(0, 300), now, now)
        .run();
      if (res.meta.changes > 0) queued++;
    }
  }
  return queued;
}
