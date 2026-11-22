"use client";
import { useState } from "react";
import type { Account } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { Btn, Panel, Tag, toast } from "./ui";

export interface Suggestion { kind: "favorite_word" | "avoid_word" | "rule"; value: string; reason: string }
const FIELD = { favorite_word: "favorite_words", avoid_word: "avoid_words", rule: "rules" } as const;
const KIND = { favorite_word: "מילה שלי", avoid_word: "להימנע", rule: "כלל" };

/** אחרי תיקון ידני: הצעות לעדכון פרופיל הקול. שום דבר לא משתנה עד שהיא מאשרת */
export function VoiceSuggestions({ account, suggestions, onDone }: { account: Account; suggestions: Suggestion[]; onDone?: () => void }) {
  const [left, setLeft] = useState(suggestions);
  const [busy, setBusy] = useState("");

  const decide = async (s: Suggestion, accept: boolean) => {
    setBusy(s.value);
    try {
      const { data: row } = await db().from("studio_voice").select("profile, pending").eq("account", account).maybeSingle();
      const pending = ((row?.pending as Suggestion[]) ?? []).filter((p) => p.value !== s.value);
      const profile = { ...((row?.profile as Record<string, unknown>) ?? {}) };
      if (accept) {
        const field = FIELD[s.kind];
        profile[field] = [...new Set([...((profile[field] as string[]) ?? []), s.value])];
      }
      const { error } = await db().from("studio_voice").upsert({ account, profile, pending });
      if (error) throw new Error(error.message);
      if (accept) toast("הפרופיל עודכן");
      const next = left.filter((x) => x !== s);
      setLeft(next);
      if (!next.length) onDone?.();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy("");
    }
  };

  if (!left.length) return null;
  return (
    <Panel title="ללמוד מהתיקון שלך?" tone="green">
      <p className="mb-3 text-sm text-[#6A6158]">מהשינויים שעשית עולה שאולי כדאי לעדכן את פרופיל הקול. רק מה שתאשרי נשמר.</p>
      <ul className="space-y-2">
        {left.map((s) => (
          <li key={s.kind + s.value} className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E3D9CC] pb-2">
            <span className="min-w-0">
              <Tag tone="green">{KIND[s.kind]}</Tag> <span className="font-semibold">{s.value}</span>
              <span className="block text-xs text-[#6A6158]">{s.reason}</span>
            </span>
            <span className="flex gap-1.5">
              <Btn variant="ghost" disabled={busy === s.value} onClick={() => decide(s, false)}>לא</Btn>
              <Btn variant="green" busy={busy === s.value} onClick={() => decide(s, true)}>לעדכן</Btn>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
