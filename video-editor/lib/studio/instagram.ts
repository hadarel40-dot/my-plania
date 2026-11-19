import "server-only";

/**
 * אינסטגרם: קריאה בלבד. אין כאן שום קוד שמפרסם.
 * INSTAGRAM_ACCESS_TOKENS: טוקן אחד או שניים (מופרדים בפסיק), אחד לכל חשבון, מ-Instagram API with
 * Instagram Login, עם ההרשאות instagram_business_basic ו-instagram_business_manage_insights.
 */
const IG = "https://graph.instagram.com/v21.0";
const PROFILE_FIELDS = "id,username,name,profile_picture_url,followers_count,follows_count,media_count";
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url";

export interface IgInsights { reach?: number; saved?: number; shares?: number; views?: number }
export interface IgMedia {
  id: string; caption?: string; media_type: string; media_product_type?: string; permalink: string; timestamp: string;
  like_count?: number; comments_count?: number; thumbnail_url?: string; media_url?: string; insights?: IgInsights | null;
}
export interface IgProfile { id: string; username: string; name?: string; profile_picture_url?: string; followers_count: number; follows_count?: number; media_count: number }
export interface IgAccount { profile: IgProfile; media: IgMedia[]; insightsAvailable: boolean; insightsError: string }

const tokens = () => (process.env.INSTAGRAM_ACCESS_TOKENS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
export const instagramConfigured = () => tokens().length > 0;

async function igGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) throw new Error(body?.error?.message ?? `Instagram ${res.status}`);
  return body as T;
}

async function insightsFor(post: IgMedia, token: string): Promise<IgInsights> {
  const metrics = post.media_product_type === "REELS" ? "reach,saved,shares,views" : "reach,saved,shares";
  const body = await igGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
    `${IG}/${post.id}/insights?metric=${metrics}&access_token=${encodeURIComponent(token)}`,
  );
  const out: Record<string, number> = {};
  for (const m of body.data ?? []) out[m.name] = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0);
  return out;
}

async function loadOne(token: string, limit: number, insights: boolean): Promise<IgAccount> {
  const t = encodeURIComponent(token);
  const profile = await igGet<IgProfile>(`${IG}/me?fields=${PROFILE_FIELDS}&access_token=${t}`);
  const { data: media = [] } = await igGet<{ data: IgMedia[] }>(`${IG}/${profile.id}/media?fields=${MEDIA_FIELDS}&limit=${limit}&access_token=${t}`).catch(() => ({ data: [] as IgMedia[] }));
  let available = insights;
  let insightsError = "";
  if (insights) {
    // ההרשאה לתובנות חסרה: עוצרים בסירוב הראשון ואומרים את זה
    for (const post of media) {
      if (!available) break;
      try {
        post.insights = await insightsFor(post, token);
      } catch (e) {
        post.insights = null;
        const msg = (e as Error).message;
        if (/permission|scope|oauth|authoriz/i.test(msg)) { available = false; insightsError = msg; }
      }
    }
  }
  return { profile, media, insightsAvailable: available, insightsError };
}

/** כל החשבונות המחוברים. חשבון שנכשל מוחזר עם השגיאה שלו */
export async function loadAccounts({ limit = 30, insights = true } = {}) {
  return Promise.all(tokens().map(async (token) => {
    try {
      return { ok: true as const, ...(await loadOne(token, limit, insights)) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }));
}

export async function loadAccount(username: string, opts?: { limit?: number; insights?: boolean }) {
  const all = await loadAccounts(opts);
  return all.find((a) => a.ok && a.profile.username === username) as (IgAccount & { ok: true }) | undefined;
}
