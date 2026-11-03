import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * ה"מוח" של העורך: מודל שפה שמקבל טקסט ותמונות ומחזיר JSON לפי סכמה.
 * Gemini של גוגל (חינמי, GEMINI_API_KEY) קודם; Claude (ANTHROPIC_API_KEY) אם הוגדר במקום.
 * נקרא רק מהשרת.
 */
export type BrainProvider = "gemini" | "claude";

export function brainProvider(): BrainProvider | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

export const BRAIN_NAMES: Record<BrainProvider, string> = { gemini: "Gemini", claude: "Claude" };

export type BrainPart = { text: string } | { image: string /* data:image/jpeg;base64,... */ };

export interface BrainRequest<T extends z.ZodType> {
  system: string;
  parts: BrainPart[];
  schema: T;
  /** חיפוש ברשת (טרנדים) */
  search?: boolean;
}

/** שגיאה שמוצגת למשתמש כמו שהיא (בעברית). detail: ההודעה המקורית מהשירות, לאבחון */
export class BrainError extends Error {
  constructor(message: string, public status = 502, public detail?: string) { super(message); }
}

export async function askBrain<T extends z.ZodType>(req: BrainRequest<T>): Promise<z.infer<T>> {
  const provider = brainProvider();
  if (!provider) throw new BrainError("העריכה החכמה לא מחוברת (חסר GEMINI_API_KEY)", 404);
  return provider === "gemini" ? askGemini(req) : askClaude(req);
}

// ---------- Gemini

// GEMINI_API_BASE: רק לבדיקות (שרת מדומה)
const GEMINI_API = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * גרסאות Gemini לפי סדר. אם גרסה אחת לא כלולה במכסה החינמית של המפתח (429 עם limit 0)
 * או לא קיימת (404), עוברים לבאה בתור.
 */
const GEMINI_MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite",
];

async function geminiCall(body: unknown): Promise<string> {
  let last: BrainError | null = null;
  for (const model of [...new Set(GEMINI_MODELS)]) {
    try {
      return await geminiModelCall(model, body);
    } catch (e) {
      if (!(e instanceof BrainError) || (e.status !== 429 && e.status !== 404)) throw e;
      last = e;
    }
  }
  throw last ?? new BrainError("Gemini לא זמין כרגע");
}

async function geminiModelCall(model: string, body: unknown): Promise<string> {
  const key = process.env.GEMINI_API_KEY!.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  const send = (auth: Record<string, string>) => fetch(`${GEMINI_API}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  let res: Response;
  try {
    res = await send({ "x-goog-api-key": key });
    // מפתחות מהסוג החדש (מתחילים ב-AQ.) אולי נשלחים כ-Bearer: אם הדרך הרגילה נדחתה, מנסים גם אותה
    if ((res.status === 401 || res.status === 403) && key.startsWith("AQ.")) {
      res = await send({ authorization: `Bearer ${key}` });
    }
  } catch {
    throw new BrainError("Gemini לא ענה בזמן, נסו שוב", 504);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null) as {
    error?: { message?: string; status?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null;
  if (!res.ok) {
    const detail = `${model}: ${res.status} ${data?.error?.message ?? ""}`.slice(0, 400);
    console.warn("gemini error", detail);
    if (res.status === 429) throw new BrainError("המכסה החינמית של Gemini נגמרה לבינתיים. אפשר לנסות שוב בעוד כמה דקות (או מחר)", 429, detail);
    if (res.status === 404) throw new BrainError("הגרסה הזאת של Gemini לא זמינה", 404, detail);
    if (res.status === 400 && /API key/i.test(data?.error?.message ?? "")) throw new BrainError("המפתח של Gemini לא תקין", 500, detail);
    if (res.status === 401 || res.status === 403) throw new BrainError("המפתח של Gemini לא מורשה (צריך מפתח מ-aistudio.google.com)", 500, detail);
    throw Object.assign(new BrainError(`שגיאה מ-Gemini (${res.status})`, 502, detail), { gemini: data?.error });
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new BrainError("Gemini לא החזיר תשובה", 502, `${model}: empty, finish ${data?.candidates?.[0]?.finishReason ?? "?"}`);
  return text;
}

const toGeminiParts = (parts: BrainPart[]) =>
  parts.map((p) => "text" in p
    ? { text: p.text }
    : { inline_data: { mime_type: "image/jpeg", data: p.image.split(",")[1] } });

/** חילוץ JSON מתשובה חופשית (לפעמים עטוף ב-```json) */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

async function askGemini<T extends z.ZodType>({ system, parts, schema, search }: BrainRequest<T>): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
  const contents = [{ role: "user", parts: toGeminiParts(parts) }];

  if (search) {
    // חיפוש בגוגל לא עובד יחד עם פלט מובנה: מבקשים JSON בטקסט, ואם הוא לא תקין, ממירים בקריאה שנייה
    let text: string;
    try {
      text = await geminiCall({
        system_instruction: { parts: [{ text: `${system}\n\nAnswer with a single JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}` }] },
        contents,
        tools: [{ google_search: {} }],
      });
    } catch (e) {
      // חיפוש בגוגל לא תמיד כלול במכסה החינמית: אז עונים מהידע של המודל, בלי חיפוש
      if (!(e instanceof BrainError) || (e.status !== 429 && e.status !== 404 && e.status !== 502)) throw e;
      return askGemini({ system: `${system}\n\n(Web search is unavailable right now: answer from what you know about recent trends, and prefer patterns that stay popular.)`, parts, schema });
    }
    try {
      return schema.parse(extractJson(text));
    } catch {
      return structure(schema, jsonSchema, `Convert this answer to JSON that matches the schema. Keep the content and language.\n\n${text}`);
    }
  }

  try {
    const text = await geminiCall({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: jsonSchema },
    });
    return schema.parse(extractJson(text));
  } catch (e) {
    if (e instanceof BrainError && !(e as { gemini?: unknown }).gemini) throw e;
    // גרסה שלא מכירה responseJsonSchema, או JSON שלא עבר בדיקה: ניסיון נוסף עם הסכמה בתוך ההוראות
    const text = await geminiCall({
      system_instruction: { parts: [{ text: `${system}\n\nAnswer with a single JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}` }] },
      contents,
      generationConfig: { responseMimeType: "application/json" },
    });
    try {
      return schema.parse(extractJson(text));
    } catch {
      throw new BrainError("Gemini החזיר תשובה לא תקינה, נסו שוב");
    }
  }
}

async function structure<T extends z.ZodType>(schema: T, jsonSchema: unknown, prompt: string): Promise<z.infer<T>> {
  const text = await geminiCall({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: jsonSchema },
  });
  try {
    return schema.parse(extractJson(text));
  } catch {
    throw new BrainError("Gemini החזיר תשובה לא תקינה, נסו שוב");
  }
}

// ---------- Claude

async function askClaude<T extends z.ZodType>({ system, parts, schema, search }: BrainRequest<T>): Promise<z.infer<T>> {
  const client = new Anthropic({ timeout: 55_000, maxRetries: search ? 0 : 1 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = parts.map((p) => "text" in p
    ? { type: "text", text: p.text }
    : { type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.image.split(",")[1] } });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  try {
    // חיפוש ברשת יכול לעצור באמצע (pause_turn); ממשיכים מאותה נקודה, עד 3 פעמים
    for (let i = 0; i < 4; i++) {
      const response = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        ...(search ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 4 }] } : {}),
        output_config: { effort: search ? "low" : "medium", format: betaZodOutputFormat(schema) },
        system,
        messages,
      });
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal" || !response.parsed_output) break;
      return response.parsed_output as z.infer<T>;
    }
    throw new BrainError("לא התקבלה תשובה מ-Claude");
  } catch (e) {
    if (e instanceof BrainError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new BrainError("המפתח של Claude לא תקין", 500);
    if (e instanceof Anthropic.RateLimitError) throw new BrainError("יותר מדי בקשות, נסו שוב בעוד דקה", 429);
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new BrainError("Claude לא ענה בזמן, נסו שוב", 504);
    if (e instanceof Anthropic.APIError) throw new BrainError(`שגיאה מ-Claude (${e.status ?? "רשת"})`);
    throw e;
  }
}
