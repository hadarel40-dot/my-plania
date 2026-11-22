import { base44 } from "@/api/base44Client";
import { studioOp } from "@/lib/studio-ops";

/**
 * שכבת התאמה: מנוע הדשבורד נכתב מול Supabase (db().from("studio_drafts")...). כאן אותו ממשק בדיוק,
 * מעל ה-Entities של Base44, כדי שהקוד של המנוע יעבור בלי שינוי. כל משתמשת רואה רק את שלה (RLS).
 */
const TABLES: Record<string, string> = {
  studio_drafts: "StudioDraft",
  studio_items: "StudioItem",
  studio_voice: "StudioVoice",
  studio_suggestions: "StudioSuggestion",
  studio_feedback: "StudioFeedback",
};
const rows = (r: unknown) => (Array.isArray(r) ? r : ((r as { items?: unknown[] })?.items ?? [])) as Record<string, unknown>[];
const norm = (x: Record<string, unknown> | null | undefined) => (x ? { ...x, created_at: x.created_date, updated_at: x.updated_date } : x);
type Res = { data: any; error: { message: string } | null; count?: number };

class Query implements PromiseLike<Res> {
  private ent: any;
  private q: Record<string, any> = {};
  private sort?: string;
  private lim?: number;
  private op: "select" | "update" | "insert" | "delete" = "select";
  private payload: any = null;
  private one = false;
  private maybe = false;
  constructor(table: string) {
    const name = TABLES[table];
    this.ent = name ? (base44.entities as any)[name] : null;
  }
  select() { return this; }
  eq(k: string, v: unknown) { this.q[k] = v; return this; }
  neq(k: string, v: unknown) { this.q[k] = { ...(this.q[k] ?? {}), $ne: v }; return this; }
  in(k: string, v: unknown[]) { this.q[k] = { $in: v }; return this; }
  gte(k: string, v: unknown) { this.q[k] = { ...(this.q[k] ?? {}), $gte: v }; return this; }
  lte(k: string, v: unknown) { this.q[k] = { ...(this.q[k] ?? {}), $lte: v }; return this; }
  not(k: string, op: string, v: unknown) { if (op === "is" && v === null) this.q[k] = { $ne: null }; return this; }
  order(k: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.sort = `${o?.ascending === false ? "-" : ""}${k === "updated_at" ? "updated_date" : k === "created_at" ? "created_date" : k}`; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; this.maybe = true; return this; }
  update(p: unknown) { this.op = "update"; this.payload = p; return this; }
  insert(p: unknown) { this.op = "insert"; this.payload = p; return this; }
  upsert(p: unknown) { this.op = "insert"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }

  private async find() {
    if (typeof this.q.id === "string") return [await this.ent.get(this.q.id)].filter(Boolean);
    return rows(await this.ent.filter(this.q, { ...(this.sort ? { sort: this.sort } : {}), limit: this.lim ?? 500 }));
  }
  private async run(): Promise<Res> {
    try {
      if (!this.ent) throw new Error("טבלה לא מוכרת");
      if (this.op === "insert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const out = [];
        for (const p of list) out.push(norm(await this.ent.create(p)));
        return { data: this.one ? out[0] : out, error: null };
      }
      const found = await this.find();
      if (this.op === "update") {
        const out = [];
        for (const r of found) out.push(norm(await this.ent.update(r.id, this.payload)));
        return { data: this.one ? (out[0] ?? null) : out, error: this.one && !out[0] && !this.maybe ? { message: "לא נמצא" } : null };
      }
      if (this.op === "delete") {
        for (const r of found) await this.ent.delete(r.id);
        return { data: null, error: null };
      }
      const data = found.map(norm);
      return { data: this.one ? (data[0] ?? null) : data, error: this.one && !this.maybe && !data[0] ? { message: "לא נמצא" } : null, count: data.length };
    } catch (e) {
      return { data: null, error: { message: (e as Error)?.message ?? String(e) } };
    }
  }
  then<A = Res, B = never>(res?: ((v: Res) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(res, rej);
  }
}

/** קבצים: מעלים לאחסון של Base44. הכתובת שחוזרת היא ה"נתיב", והיא כבר כתובת צפייה */
const storage = {
  from: () => ({
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: p })), error: null }),
    createSignedUrl: async (p: string) => ({ data: { signedUrl: p }, error: null }),
    upload: async (_path: string, file: Blob) => {
      try {
        const res = await (base44.integrations as any).Core.UploadFile({ file });
        return { data: { path: res.file_url as string }, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error)?.message ?? "ההעלאה נכשלה" } };
      }
    },
  }),
};

const auth = {
  getUser: async () => ({ data: { user: await base44.auth.me().catch(() => null) } }),
};

export const db = () => ({ from: (table: string) => new Query(table), storage, auth });

/** פעולות בצד השרת (AI ועוד): עוברות לפונקציית שרת אחת */
export async function studioCall<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  return (await studioOp({ data: { op, body } })) as T;
}

export const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
export const formatDate = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00`)) : "");
export const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "אין נתון" : Number(v).toLocaleString("he-IL"));
export const editorHref = () => "/";
export const versionLabels = () => ({}) as Record<string, string>;
