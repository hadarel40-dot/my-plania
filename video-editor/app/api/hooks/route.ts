import { NextResponse } from "next/server";
import { HooksSchema, type HooksRequest } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError, withUserKey } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You write the opening line (hook) that appears on screen in the first 2 seconds of an Instagram Reel by a Hebrew-speaking creator in Israel.
Write exactly 3 hooks in natural spoken Hebrew, each at most 8 words, each in a different style:
1. curiosity (makes people need to see the end),
2. bold or surprising statement,
3. a direct question or "you" line to the viewer.
Use neutral gender forms or plural when addressing viewers. Be specific to this video's content; no generic filler, no hashtags, at most one emoji per hook.
Do not repeat the current hook.`;

/** שלוש הצעות למשפט פתיחה, לפי התוכן של הסרטון */
export const POST = withUserKey(async (request: Request) => {
  if (!brainProvider()) return NextResponse.json({ error: "צריך לחבר את העריכה החכמה" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as HooksRequest | null;
  const context = (body?.context ?? "").trim().slice(0, 3000);
  try {
    const { hooks } = await askBrain({
      system: SYSTEM,
      schema: HooksSchema,
      parts: [{ text: `About the video:\n${context || "(no details)"}\n\nCurrent hook: ${body?.current || "(none)"}` }],
    });
    return NextResponse.json({ hooks: hooks.map((h) => h.trim()).filter(Boolean).slice(0, 3) });
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
});
