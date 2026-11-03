"use client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/env";

/**
 * רושם אירוע ביומן client_events (שלבי העלאה, שגיאות), כדי שאפשר יהיה לאבחן
 * תקלות שקורות רק בטלפון. לא חוסם, ושגיאה ברישום לא משפיעה על העורך.
 */
export function logEvent(event: string, detail: Record<string, unknown> = {}) {
  if (!supabaseEnabled) return;
  try {
    void getSupabaseBrowser()
      .from("client_events")
      .insert({ event, detail, user_agent: navigator.userAgent.slice(0, 400) })
      .then(() => undefined, () => undefined);
  } catch { /* ignore */ }
}

export const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 500);
