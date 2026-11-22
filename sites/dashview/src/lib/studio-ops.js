import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { applyReelChanges } from "@/lib/studio/reel-edit";
import { secrets } from "base44:runtime";

/**
 * הפעולות בצד השרת של מנוע הרילים, אותו דבר כמו בדשבורד המקורי:
 * designer (הערה למעצב שמשנה את הריל מיד), designer-undo, upload-reel (ריל מהסרטונים שלי).
 * ה-AI עובר דרך InvokeLLM של Base44, בלי מפתח משלך.
 */

const rows = (res) => (Array.isArray(res) ? res : (res?.items ?? []));
const RULES = "עברית מדוברת וחמה, בגוף ראשון, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים.";

async function ask(base44, prompt, schema) {
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
  return typeof result === "string" ? JSON.parse(result) : result;
}

/** הקול של העסק: מהשאלון (StudioProfile) ומהקול השמור (StudioVoice) */
async function voiceOf(base44) {
  const [p, v] = await Promise.all([
    base44.entities.StudioProfile.filter({}, { limit: 1 }).then(rows).catch(() => []),
    base44.entities.StudioVoice.filter({}, { limit: 1 }).then(rows).catch(() => []),
  ]);
  const prof = p[0], voice = v[0];
  return [
    prof ? `העסק: ${prof.business_name ?? ""}. ${prof.what_you_do ?? ""}. קהל: ${prof.audience ?? ""}. מה מוצע: ${prof.offer ?? ""}.` : "",
    voice ? `טון: ${voice.tone ?? ""}. מילים שלה: ${(voice.favorite_words ?? []).join(", ")}. לא אומרת: ${(voice.avoid_words ?? []).join(", ")}.` : "",
    RULES,
  ].filter(Boolean).join("\n");
}

const REQUEST_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          card: { type: ["integer", "null"] },
          action: { type: "string", enum: ["replace_clip", "edit_text", "remove_card", "reorder", "timing", "other"] },
          detail: { type: "string" },
        },
        required: ["action", "detail"],
      },
    },
  },
  required: ["reply", "changes"],
};

const UPLOAD_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    caption: { type: "string" },
    cards: { type: "array", items: { type: "object", properties: { headline: { type: "string" }, body: { type: "string" } }, required: ["headline", "body"] } },
  },
  required: ["title", "caption", "cards"],
};

async function designer(base44, { draftId, message }) {
  const draft = await base44.entities.StudioDraft.get(draftId);
  const data = draft.data ?? {};
  const chat = [...(data.chat ?? []), { role: "me", text: message, at: new Date().toISOString() }];
  const cards = (data.edit?.cards ?? []).map((c, i) => ({ n: i + 1, text: c.text, from: c.start, to: c.end }));
  const { reply, changes } = await ask(base44, `את עורכת הווידאו שלה. מבינה בקשה קצרה על ריל ומתרגמת אותה לשינויים מדויקים. עברית פשוטה, בלי אימוג'י.
הכרטיסים בריל (n, הטקסט, משנייה עד שנייה): ${JSON.stringify(cards)}
הבקשה שלה: "${message}"
changes: מה לשנות. card הוא מספר הכרטיס (n), "האחרון" הוא ${cards.length || "האחרון"}. action: replace_clip (להחליף סרטון), edit_text (לשנות טקסט, detail הוא הטקסט החדש), remove_card, reorder, timing (detail "מהיר" או "איטי"), other.
reply: משפט אחד קצר שמאשר מה הבנת.`, REQUEST_SCHEMA);
  const at = new Date().toISOString();
  if (!data.edit) {
    return { draft: await base44.entities.StudioDraft.update(draftId, { data: { ...data, chat: [...chat, { role: "designer", text: reply, at }] } }) };
  }
  // ספריית הקטעים: קטעים שכבר הועלו לרילס אחרים של אותה משתמשת
  const others = rows(await base44.entities.StudioDraft.filter({}, { sort: "-updated_date", limit: 100 }));
  const pool = others.flatMap((d) => d.data?.edit?.segments ?? []);
  const { kit, done, left } = applyReelChanges(data.edit, changes, pool, message);
  const text = done.length
    ? `${done.join(". ")}.${left.length ? " את השאר אני לא יכולה לשנות לבד." : ""}`
    : `${reply} את זה אני לא יכולה לשנות לבד עדיין.`;
  const requests = left.length ? [...(data.requests ?? []), { text: message, changes: left, status: "pending", at }] : data.requests;
  const history = done.length ? [data.edit, ...(data.edit_history ?? [])].slice(0, 6) : data.edit_history;
  const next = { ...data, edit: done.length ? kit : data.edit, edit_history: history, requests, chat: [...chat, { role: "designer", text, at }] };
  return { draft: await base44.entities.StudioDraft.update(draftId, { data: next }) };
}

async function designerUndo(base44, { draftId }) {
  const draft = await base44.entities.StudioDraft.get(draftId);
  const data = draft.data ?? {};
  const [prev, ...rest] = data.edit_history ?? [];
  if (!prev) throw new Error("אין שינוי לבטל");
  const chat = [...(data.chat ?? []), { role: "designer", text: "ביטלתי את השינוי האחרון.", at: new Date().toISOString() }];
  return { draft: await base44.entities.StudioDraft.update(draftId, { data: { ...data, edit: prev, edit_history: rest, chat } }) };
}

async function uploadReel(base44, input) {
  const talking = input.transcript.length > 0;
  const segments = input.clips.map((c) => {
    if (talking) return { path: c.path, seconds: +c.seconds.toFixed(2), width: c.w, height: c.h };
    const len = Math.min(c.seconds, 3);
    return { path: c.path, seconds: +len.toFixed(2), width: c.w, height: c.h, from: +Math.max(0, (c.seconds - len) / 2).toFixed(2) };
  });
  const total = segments.reduce((n, s) => n + s.seconds, 0);
  const cardCount = Math.max(1, Math.min(6, Math.round(total / 2.6)));
  const written = await ask(base44, `את מנהלת הסושיאל שלה.
${await voiceOf(base44)}

הרעיון של הריל (מה שהיא כתבה): ${input.idea || "לא כתבה, תסיקי מהדיבור"}
${talking ? `מה שהיא אומרת בסרטון: "${input.transcript.map((t) => t.text).join(" ")}"\ncards: רשימה ריקה (הכתוביות הן הדיבור עצמו).` : `אין דיבור בסרטונים. cards: בדיוק ${cardCount} כרטיסים לפי הסדר: headline עד 6 מילים שעוצר גלילה (הראשון הוא ההוק), body עד 7 מילים או ריק.`}
title: שם קצר לריל (עד 7 מילים).
caption: כיתוב לפוסט: שורה ראשונה שמושכת, 2-4 שורות קצרות, שאלה אחת בסוף, ושלושה האשטגים רלוונטיים בשורה אחרונה.`, UPLOAD_SCHEMA);
  const cards = talking
    ? input.transcript.map((t) => ({ text: t.text, headline: t.text, body: "", start: +t.start.toFixed(2), end: +t.end.toFixed(2) }))
    : (written.cards ?? []).slice(0, cardCount).map((c, i, all) => {
        const step = total / all.length;
        return { text: c.headline, headline: c.headline, body: c.body, start: +(i * step).toFixed(2), end: +((i + 1) * step).toFixed(2) };
      });
  // ברירת מחדל שקטה, כמו בתהליך השבועי: רשימה, כותרת קבועה או תיבה לבנה
  const first = cards[0]?.headline ?? "";
  const calm = talking ? "C" : /^\d/.test(first.trim()) ? "K" : input.content_type === "story" ? "I" : input.content_type === "value" ? (cards.length >= 4 ? "K" : "I") : "J";
  const title = written.title || input.idea || "ריל מהסרטונים שלי";
  const draft = await base44.entities.StudioDraft.create({
    idea: title, account: input.account, mode: "full", content_type: input.content_type,
    data: {
      content_type: input.content_type, caption: written.caption, chosen_variant: calm,
      edit: { segments, cards, ...(talking ? { sound: true } : {}) },
      reel_design: { transition: "cut", motion: "off" },
    },
  });
  await base44.entities.StudioItem.create({
    title: title.slice(0, 80), account: input.account, format: "reel", stage: "draft", planned_date: input.date,
    content_type: input.content_type, draft_id: draft.id, caption: written.caption,
    notes: talking ? "ריל מסרטון דיבור. הכתוביות מהדיבור." : "ריל מסרטונים שהועלו.",
  });
  return { draftId: draft.id, talking };
}

const UploadInput = z.object({
  account: z.string().min(1).max(80),
  idea: z.string().max(600).default(""),
  content_type: z.enum(["story", "viral", "value", "trust"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clips: z.array(z.object({ path: z.string().max(1000), w: z.number(), h: z.number(), seconds: z.number().positive() })).min(1).max(20),
  transcript: z.array(z.object({ start: z.number(), end: z.number(), text: z.string().max(400) })).max(300).default([]),
});

const TRANSCRIBE_SYSTEM = `You are a professional Hebrew transcriber making captions for a creator's video. The speaker is usually Israeli, speaking casual spoken Hebrew, sometimes with English words, brand names or slang.
Listen to the WHOLE audio and write down every single word that is spoken, from the very first word to the very last one, exactly as said (verbatim). Never summarize, never skip a sentence, never stop before the end of the audio, never translate, never invent words that were not said. Hebrew is written in Hebrew letters with normal spelling; English words stay in English letters. Skip music, noise and breathing.
Return the speech as segments: one segment per sentence or phrase (up to about 12 words), split where the speaker pauses. Each segment has start and end in seconds from the start of this audio (two decimals), as precise as you can. Segments are in order and do not overlap. If there is no speech at all, return an empty list.`;

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"];

/** רוב האותיות בתמלול צריכות להיות בעברית או באנגלית */
function looksRight(segments) {
  const letters = segments.map((s) => s.text).join("").replace(/[^\p{L}]/gu, "");
  if (!letters.length) return true;
  return letters.replace(/[^\u05d0-\u05eaA-Za-z]/g, "").length / letters.length > 0.8;
}

async function geminiTranscribe(key, audio, duration, extra = "") {
  const body = {
    system_instruction: { parts: [{ text: TRANSCRIBE_SYSTEM + extra }] },
    contents: [{ role: "user", parts: [{ text: `Audio length: ${duration.toFixed(1)}s.` }, { inline_data: { mime_type: "audio/wav", data: audio } }] }],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      response_schema: {
        type: "OBJECT",
        properties: { segments: { type: "ARRAY", items: { type: "OBJECT", properties: { start: { type: "NUMBER" }, end: { type: "NUMBER" }, text: { type: "STRING" } }, required: ["start", "end", "text"] } } },
        required: ["segments"],
      },
    },
  };
  let last = "";
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (r.status === 404 || r.status === 429 || r.status >= 500) { last = `${model}: ${r.status}`; continue; }
    if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? "מפתח Gemini לא תקין" : `שגיאה בתמלול (${r.status})`);
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try { return JSON.parse(text).segments ?? []; } catch { last = `${model}: bad json`; }
  }
  throw new Error(/429/.test(last) ? "נגמרה המכסה של Gemini להיום" : "התמלול לא הצליח");
}

async function transcribe(input) {
  const key = secrets.get("GEMINI_API_KEY");
  if (!key) return { segments: [], missingKey: true };
  let segments = await geminiTranscribe(key, input.audio, input.duration);
  if (!looksRight(segments)) {
    segments = await geminiTranscribe(key, input.audio, input.duration, "\nIMPORTANT: Hebrew must be written in Hebrew letters (א-ת). Never output Armenian, Cyrillic or other scripts.");
    if (!looksRight(segments)) return { segments: [] };
  }
  const max = input.duration + 0.5;
  return {
    segments: segments
      .filter((s) => typeof s.text === "string" && s.text.trim() && s.end > s.start && s.start < max)
      .sort((a, b) => a.start - b.start),
  };
}

export const studioOp = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ op: z.string(), body: z.record(z.string(), z.any()).default({}) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const { op, body } = data;
    if (op === "designer") return designer(base44, z.object({ draftId: z.string(), message: z.string().min(2).max(800) }).parse(body));
    if (op === "designer-undo") return designerUndo(base44, z.object({ draftId: z.string() }).parse(body));
    if (op === "transcribe") return transcribe(z.object({ audio: z.string().min(10).max(4_200_000), duration: z.number().positive().max(120) }).parse(body));
    if (op === "upload-reel") return uploadReel(base44, UploadInput.parse(body));
    throw new Error("פעולה לא מוכרת");
  });
