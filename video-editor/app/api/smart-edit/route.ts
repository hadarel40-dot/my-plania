import { NextResponse } from "next/server";
import { SmartPlanSchema, type SmartPlanRequest } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError, withUserKey } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ההוראות שהיוצרת כתבה לעורך גוברות על ברירות המחדל */
const notesBlock = (notes?: string) =>
  notes?.trim() ? `\n\nThe creator's instructions for this edit (follow them; they override the defaults above):\n${notes.trim().slice(0, 2000)}` : "";

const SYSTEM = `You are an expert editor of short-form vertical videos (Instagram Reels, TikTok) for a Hebrew-speaking creator.
You receive the transcript of a raw video as numbered segments with timestamps, and return an edit plan.

How to decide:
- remove_segments: each segment is a sentence or phrase of the speech, in order. Read the whole transcript first and understand what she is saying, like a human editor. Cut false starts and stumbles, a sentence that is said again right after (keep the last, cleanest and most complete take), mistakes she corrected, filler and off-topic asides. Keep everything that carries the message. Cutting is the most valuable thing you do, but never cut so much that the story stops making sense; if the recording is already clean, return an empty list.
- hook: the line on screen during the first seconds. It must make a viewer stop scrolling and must be true to what the video actually says. Up to 7 words, in the language spoken in the video, natural spoken style, no hashtags.
- emojis: 2-5 moments where an emoji adds energy or meaning (a number, money, a surprise, a tip, a feeling). Use segment numbers from the input that you are keeping.
- moments: like a human editor of explainer and talking videos, mark where an on-screen animation should pop, on segments you keep. Rate every one with importance 1-3 (3 = the key point of the video). Mark generously (about one every 2-3 seconds of speech); the app shows only the most important ones by the creator's setting.
  - keyword: the 1-3 word core of a key point or a punchline, exactly as said or a tighter version ("חינם", "בלי מאמץ", "הטעות הכי נפוצה").
  - number: a number, price, percent or amount that is said ("₪99", "3 דקות", "50%"). Write it with digits.
  - step: when the speaker moves to the next item in a list or the next step ("טיפ 1", "שלב 2", "סוד 3"); number them in order.
  - emoji: a single emoji for a strong feeling or reaction (surprise, laugh, love, warning).
  Do not mark filler; at most two moments in the same segment, on different words.
- template, caption_style, accent, color_style: pick what fits the content and mood (a calm explanation, a list of tips, a before/after, a high-energy rant).
- cta: a short call to action for the end that fits the content (for example to follow or comment), or an empty string when it would feel forced.
- title: a short project name.
- inserts: when the creator also uploaded extra files (screenshots, photos, short clips without speech), you get each one as an image. Look at every image carefully and read any text in it (a customer message, a price, a result, an app screen, a product). Like a human editor, place each one exactly where the speech talks about it or where it proves or illustrates what is being said, and in a way that serves the goal of the video. Use each file at most once, do not overlap them, and skip a file only if it has nothing to do with the video. seconds: long enough to read it (a screenshot with text 3-5s, a photo 2-3s, a clip up to its length). layout: "full" for screenshots and anything that must be read or seen big, "top" when her face and reaction matter while showing it, "pip" for a small side reference.
- If the creator states a goal (to sell, to teach, to tell a story, to get follows, to invite), every decision serves it: what to cut, the hook, which moment to open with, the cta.
- summary: one or two plain Hebrew sentences for the creator saying what you changed and why (including where you put the extra files). Neutral gender forms.`;

/** בונה תוכנית עריכה מהתמלול בעזרת המוח (Gemini או Claude). המפתח נשאר בשרת */
export const POST = withUserKey(async (request: Request) => {
  if (!brainProvider()) return NextResponse.json({ error: "העריכה החכמה לא מחוברת" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SmartPlanRequest | null;
  const segments = body?.segments?.slice(0, 600) ?? [];
  if (!segments.length) return NextResponse.json({ error: "אין תמלול" }, { status: 400 });
  // קבצים נוספים: רק תמונות JPEG/PNG קטנות (data URL), עד 12
  const inserts = (body?.inserts ?? []).slice(0, 12).map((f) => ({
    ...f, image: typeof f.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(f.image) && f.image.length < 600_000 ? f.image : null,
  }));
  const transcript = segments
    .map((s, i) => `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${String(s.text).slice(0, 300)}`)
    .join("\n");
  try {
    const plan = await askBrain({
      system: SYSTEM,
      schema: SmartPlanSchema,
      parts: [
        { text: `Video length: ${body!.duration.toFixed(1)}s. Background music: ${body!.hasMusic ? "yes" : "no"}.\n\nTranscript segments:\n${transcript}${notesBlock(body!.notes)}` },
        ...inserts.flatMap((f, i) => [
          { text: `Extra file ${i}: ${f.kind === "image" ? "image / screenshot" : `video clip without speech, ${f.seconds.toFixed(1)}s`} ("${String(f.name).slice(0, 60)}")${f.image ? "" : " (no preview)"}` },
          ...(f.image ? [{ image: f.image }] : []),
        ]),
      ],
    });
    // מקטעים שלא קיימים מסוננים, כדי שתשובה שגויה לא תמחק משהו אחר
    plan.remove_segments = plan.remove_segments.filter((i) => i >= 0 && i < segments.length);
    plan.emojis = plan.emojis.filter((e) => e.segment >= 0 && e.segment < segments.length).slice(0, 6);
    const removed = new Set(plan.remove_segments);
    const usedInserts = new Set<number>();
    plan.inserts = (plan.inserts ?? []).filter((x) => x.insert >= 0 && x.insert < inserts.length && x.segment >= 0 && x.segment < segments.length && !usedInserts.has(x.insert) && usedInserts.add(x.insert));
    plan.moments = plan.moments.filter((m) => m.segment >= 0 && m.segment < segments.length && !removed.has(m.segment) && m.text.trim()).slice(0, 60);
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
});
