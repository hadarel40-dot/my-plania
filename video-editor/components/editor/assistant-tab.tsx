"use client";
import { brainHeaders } from "@/lib/ai/my-key";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Loader2, SendHorizontal, Undo2 } from "lucide-react";
import { beginGesture, undo } from "@/stores/editor-store";
import { chatContext, localReply, runActions } from "@/lib/editor/chat";
import type { ChatReply } from "@/lib/ai/edit-chat";
import { errorText, logEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; text: string; done?: string[]; undoable?: boolean }

/** השיחה נשמרת בזמן העבודה (גם כשסוגרים ופותחים את המגירה) */
const useChat = create<{ messages: Msg[]; busy: boolean }>(() => ({ messages: [], busy: false }));

const SUGGESTIONS = [
  "יותר קצר", "יותר אנרגטי", "מוזיקה אחרת, משהו שמח", "בלי מוזיקה", "כתוביות בצהוב עם הדגשה ורודה",
  "כתוביות גדולות יותר באמצע המסך", "תחליפי את משפט הפתיחה למשהו שמושך", "גוון קולנועי", "הרבה אנימציות", "להסיר רקע",
];

export async function sendChat(text: string) {
  const message = text.trim();
  if (!message || useChat.getState().busy) return;
  const history = useChat.getState().messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
  useChat.setState((s) => ({ messages: [...s.messages, { role: "user", text: message }], busy: true }));
  let out: ChatReply;
  try {
    const res = await fetch("/api/edit-chat", {
      method: "POST", headers: brainHeaders(),
      body: JSON.stringify({ message, context: chatContext(), history }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    out = (await res.json()) as ChatReply;
    if (!Array.isArray(out.actions)) throw new Error("bad reply");
  } catch (e) {
    logEvent("chat_fallback", { error: errorText(e) });
    out = localReply(message);
  }
  // כל מה שהעוזר עשה בבקשה אחת הוא צעד אחד ב"ביטול"
  const end = beginGesture();
  let done: string[] = [];
  try { done = await runActions(out.actions); } finally { end(); }
  logEvent("chat_done", { actions: out.actions.map((a) => a.type), done: done.length });
  useChat.setState((s) => ({
    busy: false,
    messages: [...s.messages.map((m) => ({ ...m, undoable: false })), { role: "assistant", text: out.reply, done, undoable: done.length > 0 }],
  }));
}

/**
 * עוזר העריכה: כותבים מה רוצים לשנות, במילים פשוטות (כמו לעורך אנושי),
 * והעורך עושה את זה. כל בקשה אפשר לבטל בלחיצה.
 */
export function AssistantTab() {
  const { messages, busy } = useChat();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length, busy]);
  const send = (t: string) => { setText(""); void sendChat(t); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!messages.length && (
          <div className="space-y-2 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 p-3">
            <p className="text-sm font-semibold">💬 מה לשנות בסרטון?</p>
            <p className="text-xs leading-relaxed text-zinc-300">כותבים (או מכתיבים במיקרופון של המקלדת) כמו לעורכת אמיתית, והעורך עושה את זה. למשל: &quot;תקצרי ל-20 שניות&quot;, &quot;תשימי מוזיקה רגועה&quot;, &quot;הכתוביות בוורוד ויותר גדולות&quot;, &quot;תמחקי את מה שאמרתי בשנייה 5 עד 8&quot;.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed", m.role === "user" ? "ms-auto bg-violet-600 text-white" : "me-auto bg-zinc-800 text-zinc-100")}>
            {m.text}
            {!!m.done?.length && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-emerald-300">{m.done.map((d, k) => <li key={k}>✓ {d}</li>)}</ul>
            )}
            {m.undoable && (
              <button onClick={() => { undo(); useChat.setState((s) => ({ messages: s.messages.map((x, k) => (k === i ? { ...x, undoable: false, done: [...(x.done ?? []), "בוטל"] } : x)) })); }}
                className="mt-1.5 flex items-center gap-1 rounded-full border border-zinc-600 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-red-400 hover:text-white">
                <Undo2 className="size-3" /> ביטול
              </button>
            )}
          </div>
        ))}
        {busy && <div className="me-auto flex items-center gap-1.5 rounded-2xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300"><Loader2 className="size-3.5 animate-spin" /> עובד על זה…</div>}
      </div>

      <div data-hscroll className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2 md:flex-wrap md:overflow-visible">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}
            className="flex-none whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-violet-400 disabled:opacity-40">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-zinc-800 p-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} dir="auto" placeholder="מה לשנות בסרטון?"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base focus:border-violet-500 focus:outline-none md:text-sm" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="שליחה"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-l from-violet-600 to-fuchsia-600 disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4 -scale-x-100" />}
        </button>
      </form>
    </div>
  );
}
