// קריאות ל-Instagram API (Instagram Login). הטוקן נשמר ב-D1 ומתחדש אוטומטית
import type { Env } from "./types";
import { DAY } from "./types";
import { getSetting, setSetting } from "./db";

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
  /** שגיאות זמניות: עומס, הגבלת קצב, תקלה בשרת. כדאי לנסות שוב מאוחר יותר */
  get transient(): boolean {
    if (this.status === 429 || this.status >= 500 || this.status === 0) return true;
    return [1, 2, 4, 17, 32, 341, 613].includes(this.code ?? -1);
  }
  /** הטוקן פג או בוטל */
  get authProblem(): boolean {
    return this.code === 190 || this.status === 401;
  }
}

/**
 * הטוקן המחודש נשמר ב-D1. אם הכניסו טוקן חדש ב-secret (IG_ACCESS_TOKEN), הוא גובר על השמור
 */
export async function getToken(env: Env): Promise<string> {
  const envToken = env.IG_ACCESS_TOKEN || "";
  const seed = envToken.slice(-16);
  if (seed && (await getSetting(env, "ig_token_seed")) !== seed) {
    await setSetting(env, "ig_token_seed", seed);
    await setSetting(env, "ig_token", "");
    await setSetting(env, "ig_token_refreshed_at", "0");
    return envToken;
  }
  return (await getSetting(env, "ig_token")) || envToken;
}

async function graph<T>(
  env: Env,
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string>; json?: unknown; token?: string } = {},
): Promise<T> {
  const token = opts.token ?? (await getToken(env));
  if (!token) throw new GraphError("אין טוקן של אינסטגרם (IG_ACCESS_TOKEN)", 401, 190);
  const url = new URL(env.GRAPH_BASE.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    });
  } catch (e) {
    throw new GraphError(`אין חיבור לאינסטגרם: ${(e as Error).message}`, 0);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* לא JSON */
  }
  if (!res.ok || data?.error) {
    const err = data?.error ?? {};
    throw new GraphError(
      err.error_user_msg || err.message || `HTTP ${res.status}`,
      res.status,
      err.code,
      err.error_subcode,
    );
  }
  return data as T;
}

export interface Me {
  user_id: string;
  username: string;
}

export function getMe(env: Env): Promise<Me> {
  return graph<Me>(env, "GET", "/me", { query: { fields: "user_id,username" } });
}

export interface Media {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

export function listMedia(env: Env, after?: string) {
  return graph<{ data: Media[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    env,
    "GET",
    "/me/media",
    {
      query: {
        fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp",
        limit: "30",
        ...(after ? { after } : {}),
      },
    },
  );
}

export function getMedia(env: Env, id: string) {
  return graph<Media>(env, "GET", `/${encodeURIComponent(id)}`, {
    query: { fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp" },
  });
}

export function mediaThumb(m: Media): string {
  return m.thumbnail_url || m.media_url || "";
}

/** Private Reply עם כפתור. הודעה אחת בלבד, למי שכתב את התגובה */
export function sendPrivateReplyButton(env: Env, commentId: string, text: string, title: string, url: string) {
  return graph<{ message_id?: string }>(env, "POST", "/me/messages", {
    json: {
      recipient: { comment_id: commentId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: [{ type: "web_url", url, title }],
          },
        },
      },
    },
  });
}

/** גיבוי: Private Reply בטקסט רגיל עם הקישור בסוף */
export function sendPrivateReplyText(env: Env, commentId: string, text: string) {
  return graph<{ message_id?: string }>(env, "POST", "/me/messages", {
    json: { recipient: { comment_id: commentId }, message: { text } },
  });
}

/** תגובה פומבית מתחת לתגובה */
export function replyToComment(env: Env, commentId: string, message: string) {
  return graph<{ id: string }>(env, "POST", `/${encodeURIComponent(commentId)}/replies`, {
    query: { message },
  });
}

/** מנוי החשבון לקבלת התראות על תגובות */
export function subscribeComments(env: Env) {
  return graph<{ success: boolean }>(env, "POST", "/me/subscribed_apps", {
    query: { subscribed_fields: "comments" },
  });
}

export function getSubscriptions(env: Env) {
  return graph<{ data: { subscribed_fields?: string[] }[] }>(env, "GET", "/me/subscribed_apps");
}

/** טוקן ארוך תקף 60 יום. מחדשים אותו כל כמה ימים, והחידוש נותן עוד 60 יום */
export async function refreshTokenIfNeeded(env: Env, force = false): Promise<boolean> {
  const last = Number((await getSetting(env, "ig_token_refreshed_at")) || 0);
  if (!force && Date.now() - last < 5 * DAY) return false;
  const token = await getToken(env);
  if (!token) return false;
  const base = new URL(env.GRAPH_BASE).origin;
  const url = new URL(base + "/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    await setSetting(env, "ig_token_error", msg);
    throw new GraphError(msg, res.status, data?.error?.code);
  }
  await setSetting(env, "ig_token", data.access_token);
  await setSetting(env, "ig_token_refreshed_at", String(Date.now()));
  if (data.expires_in) await setSetting(env, "ig_token_expires_at", String(Date.now() + data.expires_in * 1000));
  await setSetting(env, "ig_token_error", "");
  return true;
}
