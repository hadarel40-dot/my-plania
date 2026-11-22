import { NextResponse } from "next/server";
import { z } from "zod";
import { BrainError } from "@/lib/ai/brain";
import { computeMeta } from "@/lib/editor/project-meta";
import type { Draft } from "@/lib/studio/config";
import { driveAccessToken, driveConfigured, driveProblem, driveEmail, driveThumb, listDriveMedia } from "@/lib/studio/drive";
import { adminStore, autoDraft, autoSuggest } from "@/lib/studio/auto";
import { matchMaterials, writeCarousel, writeHooks, writeScript } from "@/lib/studio/engine";
import { projectFromDraft } from "@/lib/studio/handoff";
import { advise, buildVoice, inspire, planToday, planWeek, preferencesBlock, type Feedback, researchTrends, suggestFromEdit, weeklyStats, writeReview } from "@/lib/studio/insights";
import { instagramConfigured, loadAccounts } from "@/lib/studio/instagram";
import { StudioError, getVoice, requireStudioAdmin, todayIL, voiceBlock } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const account = z.enum(["hadarelifergan", "plania.il"]);
const uuid = z.string().uuid();

/** כל פעולות הסטודיו: רק למנהלת, קלט מוגבל. שום פעולה כאן לא מפרסמת ולא משנה שלב של פריט */
export async function POST(request: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  try {
    const { supabase } = await requireStudioAdmin();
    const body = await request.json().catch(() => ({}));

    const loadDraft = async (id: string) => {
      const { data, error } = await supabase.from("studio_drafts").select("*").eq("id", id).single();
      if (error || !data) throw new StudioError("הטיוטה לא נמצאה", 404);
      return data as Draft;
    };
    // הקול שלה ומה שהיא אהבה ולא אהבה: כל כתיבה לומדת מהסימונים שלה
    const voiceWithPrefs = async (account: Draft["account"]) => {
      const { data: fb } = await supabase.from("studio_feedback").select("kind, text, verdict, reason").order("created_at", { ascending: false }).limit(60);
      return `${voiceBlock(await getVoice(supabase, account), account)}\n\n${preferencesBlock((fb ?? []) as Feedback[])}`;
    };
    const saveDraft = async (id: string, data: Draft["data"]) => {
      const { data: saved, error } = await supabase.from("studio_drafts").update({ data }).eq("id", id).select("*").single();
      if (error) throw new StudioError(error.message, 500);
      return saved as Draft;
    };

    switch (op) {
      case "hooks": {
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        const voice = await voiceWithPrefs(draft.account);
        const fresh = await writeHooks(draft, voice);
        // הוקים חדשים: נשמרים התבנית והחומרים, והתסריט הישן יורד
        return NextResponse.json({ draft: await saveDraft(draft.id, { template: draft.data.template, materials: draft.data.materials, ...fresh }) });
      }
      case "script": {
        const { draftId, hookIndex } = z.object({ draftId: uuid, hookIndex: z.number().int().min(0).max(2) }).parse(body);
        const draft = await loadDraft(draftId);
        const voice = await voiceWithPrefs(draft.account);
        return NextResponse.json({ draft: await saveDraft(draft.id, await writeScript(draft, voice, hookIndex)) });
      }
      case "carousel": {
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        const voice = await voiceWithPrefs(draft.account);
        const next = await writeCarousel(draft, voice);
        // הגרסה הקודמת נשמרת, כדי שאפשר יהיה לחזור אליה
        const prev = draft.data.carousel;
        if (prev) next.carousel_history = [prev, ...(draft.data.carousel_history ?? [])].slice(0, 5);
        return NextResponse.json({ draft: await saveDraft(draft.id, next) });
      }
      case "drive-match": {
        const { draftId, folder } = z.object({ draftId: uuid, folder: z.string().max(300).optional() }).parse(body);
        if (!driveConfigured()) throw new StudioError("דרייב עוד לא מחובר. ההוראות בעמוד הקול שלי, בחלק של דרייב.", 400);
        const draft = await loadDraft(draftId);
        const files = await listDriveMedia(folder, 80);
        if (!files.length) throw new StudioError("לא מצאתי סרטונים או תמונות בתיקייה. בדקי שהיא משותפת עם חשבון השירות.", 404);
        const thumbs = await Promise.all(files.map((f, i) => (i < 24 ? driveThumb(f) : Promise.resolve(null))));
        const materials = await matchMaterials(draft, files, thumbs);
        return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, materials }) });
      }
      case "drive-files": {
        const { folder } = z.object({ folder: z.string().max(300).optional() }).parse(body);
        if (!driveConfigured()) return NextResponse.json({ configured: false, files: [] });
        return NextResponse.json({ configured: true, email: driveEmail(), files: await listDriveMedia(folder, 150) });
      }
      case "advisor": {
        const { messages } = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).min(1).max(30) }).parse(body);
        const [{ data: items }, { data: trend }] = await Promise.all([
          supabase.from("studio_items").select("title, stage, planned_date, format, account").neq("stage", "published").order("planned_date", { nullsFirst: false }).limit(60),
          supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
        ]);
        const voices = (await Promise.all((["hadarelifergan", "plania.il"] as const).map(async (a) => voiceBlock(await getVoice(supabase, a), a)))).join("\n\n");
        const result = await advise({ messages, voices, board: JSON.stringify(items ?? []), trends: trend?.items ?? [] });
        return NextResponse.json(result);
      }
      case "status": {
        return NextResponse.json({
          ai: process.env.ANTHROPIC_API_KEY ? "claude" : process.env.GEMINI_API_KEY ? "gemini" : null,
          gemini: !!process.env.GEMINI_API_KEY,
          instagram: instagramConfigured(),
          drive: driveConfigured(),
          driveEmail: driveEmail(),
          driveProblem: driveProblem(),
          driveFolder: !!process.env.GOOGLE_DRIVE_FOLDER,
          cron: !!process.env.CRON_SECRET,
        });
      }
      case "suggest": {
        // הצעות חדשות (רעיון ושלושה הוקים). focus: מה היא מקדמת עכשיו
        const { focus, count } = z.object({ focus: z.string().max(800).optional(), count: z.number().int().min(1).max(6).optional() }).parse(body);
        return NextResponse.json(await autoSuggest(adminStore(supabase), count ?? 5, { force: true, focus }));
      }
      case "inspire": {
        // השראה: קישור (רילס, טיקטוק, כתבה), תמונה, או פריימים מסרטון שהעלתה
        const { url, note, images } = z.object({
          url: z.string().url().max(1000).optional(),
          note: z.string().max(1500).default(""),
          images: z.array(z.string().max(1_500_000).regex(/^data:image\/jpeg;base64,/)).max(4).default([]),
        }).parse(body);
        let pageText = "";
        const pics = [...images];
        if (url) {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            const page = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1)" }, cache: "no-store" });
            clearTimeout(t);
            const html = (await page.text()).slice(0, 400_000);
            const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ?? "";
            const unescape = (x: string) => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
            pageText = [meta("og:title"), meta("og:description") || meta("description")].map(unescape).filter(Boolean).join("\n").slice(0, 2000);
            const ogImage = unescape(meta("og:image"));
            if (ogImage && pics.length < 4) {
              const img = await fetch(ogImage, { cache: "no-store" });
              if (img.ok && /jpe?g/i.test(img.headers.get("content-type") ?? "")) {
                const buf = Buffer.from(await img.arrayBuffer());
                if (buf.length < 1_200_000) pics.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
              }
            }
          } catch {
            // אינסטגרם חוסם לפעמים קריאה מבחוץ. ממשיכים עם מה שיש (ההערה והתמונות)
          }
        }
        if (!pageText && !pics.length && !note.trim()) throw new StudioError("לא הצלחתי לקרוא את הקישור. אפשר להוסיף כמה מילים על מה אהבת בו, או צילום מסך ממנו.", 400);
        const [{ data: feedback }] = await Promise.all([supabase.from("studio_feedback").select("kind, text, verdict, reason").order("created_at", { ascending: false }).limit(60)]);
        const voices = (await Promise.all((["hadarelifergan", "plania.il"] as const).map(async (a) => voiceBlock(await getVoice(supabase, a), a)))).join("\n\n");
        const out = await inspire({ url: url ?? null, pageText, note, images: pics, voices, feedback: (feedback ?? []) as Feedback[] });
        const { data, error } = await supabase.from("studio_suggestions").insert(out.map((x) => ({ ...x, source_note: note || pageText.slice(0, 300) || null }))).select("*");
        if (error) throw new StudioError(error.message, 500);
        return NextResponse.json({ suggestions: data, readPage: !!pageText });
      }
      case "auto": {
        // הכפתור "להכין עכשיו": רעיונות אם חסרים, אחרת טיוטה אחת שמשובצת ביום פנוי
        const { step } = z.object({ step: z.enum(["ideas", "draft"]) }).parse(body);
        const store = adminStore(supabase);
        return NextResponse.json(step === "ideas" ? await autoSuggest(store) : await autoDraft(store));
      }
      case "to-editor": {
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        if (draft.project_id) {
          const { data: existing } = await supabase.from("projects").select("id").eq("id", draft.project_id).maybeSingle();
          if (existing) return NextResponse.json({ projectId: existing.id });
        }
        const project = projectFromDraft(draft);
        const { title, ...doc } = project;
        const { data, error } = await supabase.from("projects").insert({ title, doc, meta: computeMeta(project) }).select("id").single();
        if (error) throw new StudioError(error.message, 500);
        await supabase.from("studio_drafts").update({ project_id: data.id }).eq("id", draft.id);
        return NextResponse.json({ projectId: data.id });
      }
      case "plan-week": {
        const { focus } = z.object({ focus: z.string().max(800).default("") }).parse(body);
        const { data: trend } = await supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle();
        const { data: existing } = await supabase.from("studio_items").select("title").order("created_at", { ascending: false }).limit(40);
        const ideas = await planWeek({ focus, trends: trend?.items ?? [], existing: (existing ?? []).map((e) => e.title) });
        const { data: inserted, error } = await supabase.from("studio_items").insert(ideas.map((i) => ({
          title: i.title, account: i.account, niche: i.niche, format: i.format, stage: "idea", notes: `${i.idea}\n\nלמה: ${i.why}`,
        }))).select("*");
        if (error) throw new StudioError(error.message, 500);
        return NextResponse.json({ items: inserted });
      }
      case "trends": {
        const date = todayIL();
        const { data: current } = await supabase.from("studio_trends").select("status, updated_at").eq("date", date).maybeSingle();
        if (current?.status === "running" && Date.now() - new Date(current.updated_at).getTime() < 5 * 60_000) {
          throw new StudioError("החיפוש כבר רץ. עוד רגע הדוח יתעדכן.", 409);
        }
        await supabase.from("studio_trends").upsert({ date, status: "running", error: null });
        try {
          const { items, dropped } = await researchTrends();
          await supabase.from("studio_trends").upsert({ date, status: "done", items, dropped, error: null });
          return NextResponse.json({ ok: true, count: items.length, dropped });
        } catch (e) {
          await supabase.from("studio_trends").upsert({ date, status: "failed", error: (e as Error).message });
          throw e;
        }
      }
      case "today": {
        const { refresh } = z.object({ refresh: z.boolean().optional() }).parse(body);
        const date = todayIL();
        if (!refresh) {
          const { data } = await supabase.from("studio_daily").select("*").eq("date", date).maybeSingle();
          if (data) return NextResponse.json({ plan: data });
        }
        const [{ data: trend }, { data: items }] = await Promise.all([
          supabase.from("studio_trends").select("date, items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("studio_items").select("id, title, stage, planned_date").limit(300),
        ]);
        const rows = items ?? [];
        const board = rows.reduce<Record<string, number>>((m, i) => ({ ...m, [i.stage]: (m[i.stage] ?? 0) + 1 }), {});
        const week = todayIL(7);
        const recommendations = await planToday({
          trends: trend?.items ?? [],
          trendDate: trend?.date ?? null,
          board,
          planned: rows.filter((i) => i.planned_date && i.planned_date >= date && i.planned_date <= week),
          waiting: rows.filter((i) => i.stage === "review").slice(0, 5),
        });
        const { data: plan } = await supabase.from("studio_daily").upsert({ date, recommendations }).select("*").single();
        return NextResponse.json({ plan });
      }
      case "review": {
        const weekAgo = todayIL(-7);
        const [{ data: snaps }, { data: items }] = await Promise.all([
          supabase.from("studio_snapshots").select("date, account, followers").gte("date", weekAgo),
          supabase.from("studio_items").select("stage").limit(500),
        ]);
        const board = (items ?? []).reduce<Record<string, number>>((m, i) => ({ ...m, [i.stage]: (m[i.stage] ?? 0) + 1 }), {});
        const stats = await weeklyStats(weekAgo, snaps ?? [], board);
        const text = await writeReview(stats);
        const { data: review, error } = await supabase.from("studio_reviews").upsert({ week_start: weekAgo, body: text, stats }).select("*").single();
        if (error) throw new StudioError(error.message, 500);
        return NextResponse.json({ review });
      }
      case "voice-build": {
        const { account: acc, text } = z.object({ account, text: z.string().max(8000).default("") }).parse(body);
        const { data: row } = await supabase.from("studio_voice").select("profile").eq("account", acc).maybeSingle();
        const built = await buildVoice(acc, row?.profile && Object.keys(row.profile).length ? row.profile : null, text);
        const { error } = await supabase.from("studio_voice").upsert({ account: acc, profile: built.profile, samples: built.samples.slice(0, 25), built_at: new Date().toISOString() });
        if (error) throw new StudioError(error.message, 500);
        return NextResponse.json({ profile: built.profile, used: built.used, note: built.note });
      }
      case "voice-suggest": {
        const { account: acc, before, after } = z.object({ account, before: z.string().max(6000), after: z.string().max(6000) }).parse(body);
        if (!before.trim() || before.trim() === after.trim()) return NextResponse.json({ suggestions: [] });
        const suggestions = await suggestFromEdit(voiceBlock(await getVoice(supabase, acc), acc), before, after);
        if (suggestions.length) {
          const { data: row } = await supabase.from("studio_voice").select("pending").eq("account", acc).maybeSingle();
          await supabase.from("studio_voice").upsert({ account: acc, pending: [...((row?.pending as unknown[]) ?? []), ...suggestions].slice(-20) });
        }
        return NextResponse.json({ suggestions });
      }
      case "instagram": {
        if (!instagramConfigured()) return NextResponse.json({ configured: false, accounts: [] });
        const accounts = await loadAccounts({ limit: 30 });
        const date = todayIL();
        const ok = accounts.filter((a) => a.ok);
        if (ok.length) {
          await supabase.from("studio_snapshots").upsert(ok.map((a) => ({ date, account: a.profile.username, followers: a.profile.followers_count, media_count: a.profile.media_count })));
        }
        const { data: history } = await supabase.from("studio_snapshots").select("date, account, followers").order("date").limit(1000);
        return NextResponse.json({ configured: true, accounts, history: history ?? [] });
      }
      case "drive": {
        if (!driveConfigured()) return NextResponse.json({ configured: false });
        return NextResponse.json({ configured: true, token: await driveAccessToken(), email: driveEmail() });
      }
      default:
        return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof StudioError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof BrainError && e.status === 429) {
      return NextResponse.json({ error: "המכסה היומית החינמית של Gemini נגמרה להיום. היא מתחדשת מחר, ואז זה יעבוד שוב. (עם מפתח של Claude אין הגבלה כזו.)", detail: e.detail }, { status: 429 });
    }
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
    console.error("studio", op, e);
    return NextResponse.json({ error: (e as Error).message || "משהו השתבש" }, { status: 500 });
  }
}
