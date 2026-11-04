import { NextResponse } from "next/server";
import { askBrain, brainProvider, BrainError } from "@/lib/ai/brain";
import { CHAT_SYSTEM, ChatReplySchema, type ChatRequest } from "@/lib/ai/edit-chat";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** עוזר העריכה: בקשה בעברית חופשית → פעולות בעורך + תשובה קצרה */
export async function POST(request: Request) {
  if (!brainProvider()) return NextResponse.json({ error: "צריך לחבר את העריכה החכמה" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const message = (body?.message ?? "").trim().slice(0, 1500);
  if (!message) return NextResponse.json({ error: "מה לשנות?" }, { status: 400 });
  const history = (body?.history ?? []).slice(-8).map((h) => `${h.role === "user" ? "Creator" : "Assistant"}: ${h.text.slice(0, 400)}`).join("\n");
  try {
    const out = await askBrain({
      system: CHAT_SYSTEM,
      schema: ChatReplySchema,
      budgetMs: 40_000,
      parts: [{ text: `Current video:\n${(body?.context ?? "").slice(0, 6000)}\n\n${history ? `Conversation so far:\n${history}\n\n` : ""}Creator's request: ${message}` }],
    });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
}
