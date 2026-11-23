import type { BrandKit } from "@/lib/studio/brand";
import { TEMPLATES } from "@/lib/studio/templates";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BrainError } from "@/lib/ai/brain";
import { computeMeta } from "@/lib/editor/project-meta";
import type { Draft, TrendItem } from "@/lib/studio/config";
import { driveAccessToken, driveConfigured, driveProblem, driveEmail, driveThumb, listDriveMedia } from "@/lib/studio/drive";
import { adminStore, autoDraft, autoSuggest } from "@/lib/studio/auto";
import { carouselIdeas, editCarouselByChat, understandReelRequest, matchMaterials, writeCarousel, hookLab, pickDriveClips, REWRITES, rewriteText, writeHooks, writeScript, writeUploadReel } from "@/lib/studio/engine";
import { projectFromDraft } from "@/lib/studio/handoff";
import { applyReelChanges, type Segment } from "@/lib/studio/reel-edit";
import { advise, buildVoice, inspire, planToday, planWeek, preferencesBlock, type Feedback, researchTrends, suggestFromEdit, weekOptions, weeklyStats, writeReview } from "@/lib/studio/insights";
import { instagramConfigured, loadAccounts } from "@/lib/studio/instagram";
import { learnFromPosts, matchPublished, saveLearnings } from "@/lib/studio/learn";
import { StudioError, getVoice, requireStudioAdmin, todayIL, voiceBlock } from "@/lib/studio/server";

/** הגרסה הרגועה כברירת מחדל (כמו בתהליך השבועי): רשימה ממוספרת, הוק קבוע, או קופסה לבנה */
function calmVariant(type: string, cards: { headline: string }[]) {
  if (/^\s*\d/.test(cards[0]?.headline ?? "")) return "K";
  if (type === "story") return "I";
  if (type === "value") return cards.length >= 4 ? "K" : "I";
  return "J";
}

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
    const brandOf = async (account: Draft["account"]) => {
      const { data } = await supabase.from("studio_voice").select("profile").eq("account", account).maybeSingle();
      return ((data?.profile as { brand?: BrandKit } | undefined)?.brand) ?? null;
    };
    const saveDraft = async (id: string, data: Draft["data"]) => {
      const { data: saved, error } = await supabase.from("studio_drafts").update({ data }).eq("id", id).select("*").single();
      if (error) throw new StudioError(error.message, 500);
      // סנכרון: הכיתוב וההוק בלוח תמיד כמו בטיוטה
      const caption = data.carousel?.caption ?? data.caption;
      const hook = data.carousel?.slides[0]?.headline ?? data.hooks?.[data.chosen ?? 0]?.spoken;
      if (caption || hook) await supabase.from("studio_items").update({ ...(caption ? { caption } : {}), ...(hook ? { hook } : {}) }).eq("draft_id", id);
      return saved as Draft;
    };

    switch (op) {
      case "hook-lab": {
        // חמש פתיחות חלופיות לשער של קרוסלה או לכרטיס הראשון של ריל
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        const car = draft.data.carousel;
        const cards = draft.data.edit?.cards ?? [];
        if (!car && !cards.length) throw new StudioError("אין עדיין פתיחה להחליף", 400);
        const hooks = await hookLab({
          voice: await voiceWithPrefs(draft.account), idea: draft.idea, format: car ? "carousel" : "reel",
          current: car ? `${car.slides[0]?.headline ?? ""} ${car.slides[0]?.body ?? ""}` : cards[0].text,
          rest: car ? car.slides.slice(1).map((x) => x.headline).join(" | ") : cards.slice(1).map((x) => x.text).join(" | "),
        });
        return NextResponse.json({ hooks });
      }
      case "rewrite": {
        // שכתוב מהיר של שקופית או כרטיס: קצר יותר, חד יותר, אישי יותר, פשוט יותר
        const input = z.object({ account, headline: z.string().max(400), body: z.string().max(1200).default(""), how: z.enum(Object.keys(REWRITES) as [keyof typeof REWRITES, ...(keyof typeof REWRITES)[]]) }).parse(body);
        return NextResponse.json(await rewriteText({ voice: await voiceWithPrefs(input.account), headline: input.headline, body: input.body, how: input.how }));
      }
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
        const next = await writeCarousel(draft, voice, await brandOf(draft.account));
        // הגרסה הקודמת נשמרת, כדי שאפשר יהיה לחזור אליה
        const prev = draft.data.carousel;
        if (prev) next.carousel_history = [prev, ...(draft.data.carousel_history ?? [])].slice(0, 5);
        return NextResponse.json({ draft: await saveDraft(draft.id, next) });
      }
      case "carousel-ideas": {
        const { account: acc, count } = z.object({ account, count: z.number().int().min(1).max(7) }).parse(body);
        const [{ data: trend }, { data: drafts }] = await Promise.all([
          supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("studio_drafts").select("idea").eq("account", acc).order("updated_at", { ascending: false }).limit(80),
        ]);
        const ideas = await carouselIdeas(acc, await voiceWithPrefs(acc), count, (drafts ?? []).map((d) => d.idea as string),
          ((trend?.items ?? []) as TrendItem[]).filter((t) => t.account === acc).map((t) => ({ title: t.title, reel_idea: t.reel_idea })),
          TEMPLATES.filter((t) => t.kind === "carousel").map((t) => ({ id: t.id, name: t.name })));
        return NextResponse.json({ ideas });
      }
      case "designer": {
        // צ'אט עם המעצב: קרוסלה משתנה מיד (עם חזרה אחורה), בריל הבקשה נשמרת לעיבוד הבא
        const { draftId, message } = z.object({ draftId: uuid, message: z.string().min(2).max(800) }).parse(body);
        const draft = await loadDraft(draftId);
        const chat = [...(draft.data.chat ?? []), { role: "me" as const, text: message, at: new Date().toISOString() }];
        if (draft.mode === "carousel") {
          const { carousel, reply } = await editCarouselByChat(draft, await voiceWithPrefs(draft.account), message);
          const history = draft.data.carousel ? [draft.data.carousel, ...(draft.data.carousel_history ?? [])].slice(0, 5) : draft.data.carousel_history;
          return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, carousel, carousel_history: history, chat: [...chat, { role: "designer", text: reply, at: new Date().toISOString() }] }) });
        }
        const { reply, changes } = await understandReelRequest(draft, message);
        if (draft.data.edit) {
          // ריל מהסטודיו: השינויים קורים מיד בערכה, והנגן מראה אותם. מה שאי אפשר לבד נשאר בתור
          const { data: others } = await supabase.from("studio_drafts").select("data->edit->segments").not("data->edit", "is", null).limit(200);
          const pool = (others ?? []).flatMap((r) => ((r as { segments?: Segment[] }).segments ?? []));
          const { kit, done, left } = applyReelChanges(draft.data.edit, changes, pool, message);
          const at = new Date().toISOString();
          const text = done.length
            ? `${done.join(". ")}.${left.length ? " את השאר אני לא יכולה לשנות לבד, אז זה בתור לעיבוד הבא." : ""}`
            : `${reply} את זה אני לא יכולה לשנות לבד, אז זה בתור לעיבוד הבא.`;
          const requests = left.length ? [...(draft.data.requests ?? []), { text: message, changes: left, status: "pending" as const, at }] : draft.data.requests;
          const history = done.length ? [draft.data.edit, ...(draft.data.edit_history ?? [])].slice(0, 6) : draft.data.edit_history;
          return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, edit: done.length ? kit : draft.data.edit, edit_history: history, requests, chat: [...chat, { role: "designer", text, at }] }) });
        }
        const requests = [...(draft.data.requests ?? []), { text: message, changes, status: "pending" as const, at: new Date().toISOString() }];
        return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, requests, chat: [...chat, { role: "designer", text: reply, at: new Date().toISOString() }] }) });
      }
      case "upload-reel": {
        // ריל מסרטונים שהיא העלתה: כתוביות מהדיבור, או כרטיסים שנכתבים לפי הרעיון
        const input = z.object({
          account, idea: z.string().max(600).default(""), content_type: z.enum(["story", "viral", "value", "trust"]),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          clips: z.array(z.object({ path: z.string().max(300), w: z.number(), h: z.number(), seconds: z.number().positive() })).min(1).max(20),
          transcript: z.array(z.object({ start: z.number(), end: z.number(), text: z.string().max(400) })).max(300).default([]),
          // מתכנון מחדש: ההוק והכותרת שנבחרו, ופריט קיים בלוח שהריל מתחבר אליו
          hook: z.string().max(200).optional(), title: z.string().max(120).optional(), itemId: uuid.optional(), notes: z.string().max(400).optional(),
          goal: z.enum(["grow", "authority", "sell", "launch"]).optional(),
        }).parse(body);
        const talking = input.transcript.length > 0;
        // בלי דיבור: מכל סרטון לוקחים את האמצע, עד 3 שניות, כדי שהריל יזוז. עם דיבור: הסרטונים כמו שהם
        const segments = input.clips.map((c) => {
          if (talking) return { path: c.path, seconds: +c.seconds.toFixed(2), width: c.w, height: c.h };
          const len = Math.min(c.seconds, 3);
          return { path: c.path, seconds: +len.toFixed(2), width: c.w, height: c.h, from: +Math.max(0, (c.seconds - len) / 2).toFixed(2) };
        });
        const total = segments.reduce((n, s) => n + s.seconds, 0);
        const cardCount = Math.max(1, Math.min(6, Math.round(total / 2.6)));
        const written = await writeUploadReel({
          voice: await voiceWithPrefs(input.account), idea: input.idea,
          transcript: talking ? input.transcript.map((t) => t.text).join(" ") : null, cardCount, hook: input.hook, goal: input.goal,
        });
        const title = (input.title || written.title || input.idea || "ריל מהסרטונים שלי").slice(0, 80);
        const cards = talking
          ? input.transcript.map((t) => ({ text: t.text, headline: t.text, body: "", start: +t.start.toFixed(2), end: +t.end.toFixed(2) }))
          : written.cards.slice(0, cardCount).map((c, i, all) => {
              const step = total / all.length;
              return { text: c.headline, headline: c.headline, body: c.body, start: +(i * step).toFixed(2), end: +((i + 1) * step).toFixed(2) };
            });
        const niche = input.account === "plania.il" ? "meals" : "business";
        const { data: dr, error } = await supabase.from("studio_drafts").insert({
          idea: input.title || written.title || input.idea || "ריל מהסרטונים שלי", account: input.account, niche, mode: "full", facts: "",
          data: {
            content_type: input.content_type, caption: written.caption, chosen_variant: talking ? "C" : calmVariant(input.content_type, cards),
            ...(input.goal ? { goal: input.goal } : {}),
            edit: { segments, cards, ...(talking ? { sound: true } : {}) },
            reel_design: talking ? { transition: "cut" } : { transition: "cut", motion: "off" },
          },
        }).select("id").single();
        if (error || !dr) throw new StudioError(error?.message ?? "לא נשמר", 500);
        if (input.itemId) {
          // פריט שכבר בלוח (מתכנון מחדש): מחברים אליו את הריל, בלי לשנות את היום או השלב שהיא קבעה מעבר לטיוטה
          await supabase.from("studio_items").update({ draft_id: dr.id, stage: "draft", caption: written.caption }).eq("id", input.itemId).in("stage", ["idea", "draft"]);
        } else {
          await supabase.from("studio_items").insert({
            title, account: input.account, niche, format: "reel", stage: "draft", hook: input.hook ?? "",
            planned_date: input.date, content_type: input.content_type, draft_id: dr.id, caption: written.caption,
            notes: input.notes ?? (talking ? "ריל מסרטון דיבור שהיא העלתה. הכתוביות מהדיבור." : "ריל מסרטונים שהיא העלתה."),
          });
        }
        return NextResponse.json({ draftId: dr.id, talking });
      }
      case "designer-undo": {
        // לבטל את השינוי האחרון של המעצב בריל
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        const [prev, ...rest] = draft.data.edit_history ?? [];
        if (!prev) throw new StudioError("אין שינוי לבטל", 400);
        const chat = [...(draft.data.chat ?? []), { role: "designer" as const, text: "ביטלתי את השינוי האחרון.", at: new Date().toISOString() }];
        return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, edit: prev, edit_history: rest, chat }) });
      }
      case "drive-match": {
        const { draftId, folder } = z.object({ draftId: uuid, folder: z.string().max(300).optional() }).parse(body);
        if (!driveConfigured()) throw new StudioError("דרייב עוד לא מחובר. ההוראות בעמוד הקול שלי, בחלק של דרייב.", 400);
        const draft = await loadDraft(draftId);
        const files = await listDriveMedia(folder, 80);
        if (!files.length) throw new StudioError("לא מצאתי סרטונים או תמונות בתיקייה. בדקי שהיא משותפת עם חשבון השירות.", 404);
        // יותר תמונות ממוזערות, כדי שהבחירה תהיה לפי מה שרואים ולא רק לפי שם הקובץ
        const thumbs = await Promise.all(files.map((f, i) => (i < 40 ? driveThumb(f) : Promise.resolve(null))));
        const materials = await matchMaterials(draft, files, thumbs);
        return NextResponse.json({ draft: await saveDraft(draft.id, { ...draft.data, materials }) });
      }
      case "drive-pick": {
        // ריל מהדרייב: בוחרים סרטונים מהארכיון שמתאימים לרעיון. ההורדה וההעלאה קורות בדפדפן
        const input = z.object({ idea: z.string().max(800), hook: z.string().max(200).default(""), count: z.number().int().min(1).max(6).default(4), exclude: z.array(z.string().max(100)).max(60).default([]) }).parse(body);
        if (!driveConfigured()) throw new StudioError("דרייב עוד לא מחובר", 400);
        // סרטונים גדולים מדי לא נבחרים: הם יורדים לדפדפן (גם בטלפון)
        const files = (await listDriveMedia(null, 150)).filter((f) => f.mimeType.startsWith("video/") && Number(f.size ?? 0) < 120_000_000).slice(0, 100);
        const thumbs = await Promise.all(files.map((f, i) => (i < 40 && f.mimeType.startsWith("video/") ? driveThumb(f) : Promise.resolve(null))));
        const chosen = await pickDriveClips({ ...input, files, thumbs });
        if (!chosen.length) throw new StudioError("לא מצאתי סרטונים בדרייב", 404);
        return NextResponse.json({ files: chosen.map((f) => ({
          id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size ?? 0),
          w: Number(f.videoMediaMetadata?.width ?? 0), h: Number(f.videoMediaMetadata?.height ?? 0), seconds: Number(f.videoMediaMetadata?.durationMillis ?? 0) / 1000,
        })) });
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
        // תמונה ממוזערת ברשימת הפרויקטים: השער של הריל
        const meta = computeMeta(project);
        const coverPath = draft.data.video?.cover;
        if (coverPath && !meta.thumbnail) {
          const { data: signed } = await supabase.storage.from("media").createSignedUrl(coverPath, 365 * 24 * 3600);
          if (signed?.signedUrl) meta.thumbnail = signed.signedUrl;
        }
        const { data, error } = await supabase.from("projects").insert({ title, doc, meta }).select("id").single();
        if (error) throw new StudioError(error.message, 500);
        await supabase.from("studio_drafts").update({ project_id: data.id }).eq("id", draft.id);
        return NextResponse.json({ projectId: data.id });
      }
      case "week-options": {
        const { account: acc, dates, goal } = z.object({ account, dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(7), goal: z.enum(["grow", "authority", "sell", "launch"]).optional() }).parse(body);
        const [{ data: trend }, { data: existing }, { data: fb }] = await Promise.all([
          supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("studio_items").select("title").eq("account", acc).order("created_at", { ascending: false }).limit(60),
          supabase.from("studio_feedback").select("kind, text, verdict, reason").order("created_at", { ascending: false }).limit(60),
        ]);
        const days = await weekOptions({
          account: acc, dates, goal, voice: voiceBlock(await getVoice(supabase, acc), acc),
          trends: ((trend?.items ?? []) as TrendItem[]).filter((t) => t.account === acc),
          existing: (existing ?? []).map((e) => e.title as string), feedback: (fb ?? []) as Feedback[],
          templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
        });
        return NextResponse.json({ days });
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
        const { error } = await supabase.from("studio_voice").upsert({ account: acc, profile: { ...built.profile, ...(row?.profile?.brand ? { brand: row.profile.brand } : {}), ...(row?.profile?.learnings ? { learnings: row.profile.learnings } : {}) }, samples: built.samples.slice(0, 25), built_at: new Date().toISOString() });
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
      case "learn": {
        // מחבר כל פוסט שפורסם לפריט שלו, מעדכן מספרים, ולומד. לא משנה שלב של שום פריט
        const { account: acc } = z.object({ account }).parse(body);
        if (!instagramConfigured()) return NextResponse.json({ connected: false });
        const rows = await matchPublished(supabase, acc);
        if (!rows.connected) return NextResponse.json({ connected: false });
        const learnings = await learnFromPosts(rows);
        if (learnings) await saveLearnings(supabase, acc, learnings);
        return NextResponse.json({
          connected: true, baseline: rows.baseline, insightsAvailable: rows.insightsAvailable,
          linked: rows.linked.map(({ item, draft, post, matchedNow }) => ({ itemId: item.id, title: item.title, format: item.format, content_type: item.content_type || draft.data.content_type || null, draftId: draft.id, chosen_variant: draft.data.chosen_variant ?? null, edit: !!draft.data.edit, post, matchedNow })),
          learnings: learnings ?? (await getVoice(supabase, acc)).learnings ?? null,
        });
      }
      case "unlink": {
        // "לא זה": הפוסט מתנתק מהפריט ולא יחובר אליו שוב
        const { draftId } = z.object({ draftId: uuid }).parse(body);
        const draft = await loadDraft(draftId);
        const media = draft.data.published?.media_id;
        const { published: _drop, ...rest } = draft.data; // eslint-disable-line @typescript-eslint/no-unused-vars
        await supabase.from("studio_drafts").update({ data: { ...rest, published_reject: [...(draft.data.published_reject ?? []), ...(media ? [media] : [])] } }).eq("id", draftId);
        await supabase.from("studio_items").update({ ig_permalink: "" }).eq("draft_id", draftId);
        return NextResponse.json({ ok: true });
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
