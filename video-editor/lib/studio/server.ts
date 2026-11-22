import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";
import { ACCOUNTS, DEFAULT_VOICE, type Account, type VoiceProfile } from "./config";

export class StudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** הסטודיו פתוח רק למנהלת. כל הקריאה למודל עוברת מכאן */
export async function requireStudioAdmin() {
  const { supabase, user } = await getUser();
  if (!user) throw new StudioError("צריך להתחבר", 401);
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new StudioError("הסטודיו פתוח רק למנהלת", 403);
  return { supabase, user };
}

export function todayIL(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

export async function getVoice(supabase: SupabaseClient, account: Account): Promise<VoiceProfile> {
  const { data } = await supabase.from("studio_voice").select("profile").eq("account", account).maybeSingle();
  const profile = { ...DEFAULT_VOICE };
  for (const [key, value] of Object.entries((data?.profile ?? {}) as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) continue;
    (profile as Record<string, unknown>)[key] = value;
  }
  return profile;
}

export function voiceBlock(v: VoiceProfile, account: Account) {
  const a = ACCOUNTS.find((x) => x.value === account)!;
  const list = (items?: string[]) => (items?.length ? items.join(", ") : "אין");
  return [
    `החשבון: ${a.label}. ${a.about}`,
    v.audience ? `קהל: ${v.audience}` : "",
    v.offer ? `מה מוכרים: ${v.offer}` : "",
    `טון: ${v.tone}`,
    `משפטים: ${v.sentence_style}`,
    `מילים וביטויים שלה (להשתמש בטבעיות, לא בכוח): ${list(v.favorite_words)}`,
    `מילים שהיא לא אומרת: ${list(v.avoid_words)}`,
    `כללים: ${list(v.rules)}`,
    v.learnings?.works.length ? `מה עבד אצלה בפועל (מהמספרים של אינסטגרם, ${v.learnings.posts} פוסטים): ${v.learnings.works.join(" | ")}` : "",
    v.learnings?.stop.length ? `מה לא עבד: ${v.learnings.stop.join(" | ")}` : "",
    v.learnings?.try_next.length ? `לנסות עכשיו: ${v.learnings.try_next.join(" | ")}` : "",
    "תמיד: עברית מדוברת, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות ובלי שפה שיווקית מנופחת.",
  ].filter(Boolean).join("\n");
}
