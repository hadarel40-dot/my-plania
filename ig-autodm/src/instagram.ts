// קריאות ל-Graph API של מטא (graph.facebook.com), לאפליקציות שנוצרו עם "Unified login" או Facebook Login.
// החיבור נעשה מדף הניהול (כפתור "חיבור החשבון"), והטוקנים נשמרים ב-D1. טוקן של system user וטוקן של דף לא פגים.
import type { Env } from "./types";
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

export interface Connection {
  token: string; // טוקן המשתמש / system user
  igId: string; // מזהה חשבון האינסטגרם העסקי
  igUsername: string;
  pageId: string; // דף הפייסבוק המקושר (אם יש)
  pageToken: string;
}

export async function getConnection(env: Env): Promise<Connection> {
  const [token, igId, igUsername, pageId, pageToken] = await Promise.all(
    ["token", "ig_id", "ig_username", "page_id", "page_token"].map((k) => getSetting(env, k)),
  );
  return {
    token: token || env.IG_ACCESS_TOKEN || "",
    igId: igId || env.IG_USER_ID || "",
    igUsername: igUsername || "",
    pageId: pageId || "",
    pageToken: pageToken || "",
  };
}

function base(env: Env) {
  return (env.GRAPH_BASE || "https://graph.facebook.com/v23.0").replace(/\/$/, "");
}

async function graph<T>(
  env: Env,
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string>; json?: unknown; token: string | null },
): Promise<T> {
  // null = בקשה בלי טוקן (החלפת קוד בטוקן). מחרוזת ריקה = החשבון לא מחובר
  if (opts.token === "") throw new GraphError("החשבון עוד לא מחובר. לוחצים 'חיבור החשבון' בדף הניהול", 401, 190);
  const url = new URL(base(env) + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    });
  } catch (e) {
    throw new GraphError(`אין חיבור למטא: ${(e as Error).message}`, 0);
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

async function requireIg(env: Env): Promise<Connection> {
  const c = await getConnection(env);
  if (!c.token || !c.igId) throw new GraphError("החשבון עוד לא מחובר. לוחצים 'חיבור החשבון' בדף הניהול", 401, 190);
  return c;
}

// ---------- חיבור החשבון (OAuth) ----------

export function oauthDialogUrl(env: Env, redirectUri: string, state: string): string {
  const u = new URL("https://www.facebook.com/" + base(env).split("/").pop() + "/dialog/oauth");
  u.searchParams.set("client_id", env.META_APP_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  if (env.META_LOGIN_CONFIG_ID) {
    u.searchParams.set("config_id", env.META_LOGIN_CONFIG_ID);
    u.searchParams.set("override_default_response_type", "true");
  } else {
    u.searchParams.set(
      "scope",
      "instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management",
    );
  }
  return u.toString();
}

/** מחליף את הקוד מהחזרה מפייסבוק בטוקן, מוצא את חשבון האינסטגרם ושומר הכול */
export async function completeOAuth(env: Env, code: string, redirectUri: string): Promise<Connection> {
  const ex = await graph<{ access_token: string }>(env, "GET", "/oauth/access_token", {
    token: null,
    query: {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
  });
  let token = ex.access_token;
  // טוקן משתמש רגיל קצר-מועד: מחליפים בטוקן ארוך. טוקן של system user כבר לא פג, ושם ההחלפה פשוט נכשלת
  try {
    const long = await graph<{ access_token: string }>(env, "GET", "/oauth/access_token", {
      token: null,
      query: {
        grant_type: "fb_exchange_token",
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        fb_exchange_token: token,
      },
    });
    if (long.access_token) token = long.access_token;
  } catch {
    /* system user token */
  }
  const conn = await discover(env, token);
  await saveConnection(env, conn);
  return conn;
}

async function discover(env: Env, token: string): Promise<Connection> {
  const conn: Connection = { token, igId: "", igUsername: "", pageId: "", pageToken: "" };
  // דרך 1: דף פייסבוק שמקושר לחשבון האינסטגרם
  try {
    const pages = await graph<{
      data: { id: string; access_token?: string; instagram_business_account?: { id: string; username?: string } }[];
    }>(env, "GET", "/me/accounts", {
      token,
      query: { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100" },
    });
    const p = pages.data.find((d) => d.instagram_business_account?.id);
    if (p) {
      conn.pageId = p.id;
      conn.pageToken = p.access_token ?? "";
      conn.igId = p.instagram_business_account!.id;
      conn.igUsername = p.instagram_business_account!.username ?? "";
    }
  } catch {
    /* ננסה את הדרך השנייה */
  }
  // דרך 2: Unified login, חשבון אינסטגרם שהוקצה ישירות
  if (!conn.igId) {
    const res = await graph<{ data: { id: string; username?: string }[] }>(env, "GET", "/me/assigned_instagram_accounts", {
      token,
      query: { fields: "id,username" },
    }).catch((e: GraphError) => {
      throw new GraphError(
        `לא נמצא חשבון אינסטגרם עסקי שמחובר לאפליקציה (${e.message}). ייתכן שחסרה ההרשאה business_management`,
        e.status,
        e.code,
      );
    });
    const a = res.data[0];
    if (!a) throw new GraphError("לא נמצא חשבון אינסטגרם עסקי. בחלון החיבור צריך לסמן את חשבון האינסטגרם", 400);
    conn.igId = a.id;
    conn.igUsername = a.username ?? "";
  }
  if (!conn.igUsername) {
    const me = await graph<{ username: string }>(env, "GET", `/${conn.igId}`, { token, query: { fields: "username" } });
    conn.igUsername = me.username;
  }
  return conn;
}

async function saveConnection(env: Env, c: Connection) {
  await setSetting(env, "token", c.token);
  await setSetting(env, "ig_id", c.igId);
  await setSetting(env, "ig_username", c.igUsername);
  await setSetting(env, "page_id", c.pageId);
  await setSetting(env, "page_token", c.pageToken);
  await setSetting(env, "ig_token_error", "");
}

// ---------- חשבון ופוסטים ----------

export async function getMe(env: Env): Promise<{ username: string }> {
  const c = await requireIg(env);
  return graph(env, "GET", `/${c.igId}`, { token: c.token, query: { fields: "username" } });
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

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";

export async function listMedia(env: Env, after?: string) {
  const c = await requireIg(env);
  return graph<{ data: Media[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    env,
    "GET",
    `/${c.igId}/media`,
    { token: c.token, query: { fields: MEDIA_FIELDS, limit: "30", ...(after ? { after } : {}) } },
  );
}

export async function getMedia(env: Env, id: string) {
  const c = await requireIg(env);
  return graph<Media>(env, "GET", `/${encodeURIComponent(id)}`, { token: c.token, query: { fields: MEDIA_FIELDS } });
}

export function mediaThumb(m: Media): string {
  return m.thumbnail_url || m.media_url || "";
}

// ---------- הודעות ----------

/**
 * Private Reply: הודעה אחת למי שכתב את התגובה. יש שתי כתובות אפשריות לשליחה:
 * דרך הדף המקושר (טוקן של הדף), או ישירות דרך חשבון האינסטגרם. מנסים לפי הסדר
 */
async function sendPrivateReply(env: Env, commentId: string, message: unknown) {
  const c = await requireIg(env);
  const routes: { path: string; token: string }[] = [];
  if (c.pageId && c.pageToken) routes.push({ path: `/${c.pageId}/messages`, token: c.pageToken });
  routes.push({ path: `/${c.igId}/messages`, token: c.token });
  let last: GraphError | null = null;
  for (const r of routes) {
    try {
      return await graph<{ message_id?: string }>(env, "POST", r.path, {
        token: r.token,
        json: { recipient: { comment_id: commentId }, message },
      });
    } catch (e) {
      if (!(e instanceof GraphError) || e.transient) throw e;
      last = e;
    }
  }
  throw last!;
}

export function sendPrivateReplyButton(env: Env, commentId: string, text: string, title: string, url: string) {
  return sendPrivateReply(env, commentId, {
    attachment: {
      type: "template",
      payload: { template_type: "button", text, buttons: [{ type: "web_url", url, title }] },
    },
  });
}

/** גיבוי: Private Reply בטקסט רגיל עם הקישור בסוף */
export function sendPrivateReplyText(env: Env, commentId: string, text: string) {
  return sendPrivateReply(env, commentId, { text });
}

/** תגובה פומבית מתחת לתגובה */
export async function replyToComment(env: Env, commentId: string, message: string) {
  const c = await requireIg(env);
  return graph<{ id: string }>(env, "POST", `/${encodeURIComponent(commentId)}/replies`, {
    token: c.pageToken || c.token,
    query: { message },
  });
}

// ---------- Webhook ----------

/** מנוי לקבלת התראות. דרך הדף (אם יש), ובנוסף דרך חשבון האינסטגרם */
export async function subscribeComments(env: Env): Promise<void> {
  const c = await requireIg(env);
  const errors: string[] = [];
  let ok = false;
  if (c.pageId && c.pageToken) {
    try {
      await graph(env, "POST", `/${c.pageId}/subscribed_apps`, { token: c.pageToken, query: { subscribed_fields: "feed" } });
      ok = true;
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  try {
    await graph(env, "POST", `/${c.igId}/subscribed_apps`, { token: c.token, query: { subscribed_fields: "comments" } });
    ok = true;
  } catch (e) {
    errors.push((e as Error).message);
  }
  if (!ok) throw new GraphError(errors.join(" / "), 400);
}
