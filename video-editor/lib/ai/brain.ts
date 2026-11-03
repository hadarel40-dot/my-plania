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

/** שגיאה שמוצגת למשתמש כמו שהיא (בעברית) */
export class BrainError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function askBrain<T extends z.ZodType>(req: BrainRequest<T>): Promise<z.infer<T>> {
  const provider = brainProvider();
  if (!provider) throw new BrainError("העריכה החכמה לא מחוברת (חסר GEMINI_API_KEY)", 404);
  return provider === "gemini" ? askGemini(req) : askClaude(req);
}

// ---------- Gemini

// GEMINI_API_BASE: רק לבדיקות (שרת מדומה)
const GEMINI_API = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta/models";

async function geminiCall(body: unknown): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch(`${GEMINI_API}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
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
    if (res.status === 429) throw new BrainError("המכסה החינמית היומית של Gemini נגמרה. אפשר לנסות שוב מחר (או בעוד כמה דקות)", 429);
    if (res.status === 400 && /API key/i.test(data?.error?.message ?? "")) throw new BrainError("המפתח של Gemini לא תקין", 500);
    if (res.status === 403) throw new BrainError("המפתח של Gemini לא מורשה (צריך מפתח מ-aistudio.google.com)", 500);
    throw Object.assign(new BrainError(`שגיאה מ-Gemini (${res.status})`), { gemini: data?.error });
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new BrainError("Gemini לא החזיר תשובה");
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
    const text = await geminiCall({
      system_instruction: { parts: [{ text: `${system}\n\nAnswer with a single JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}` }] },
      contents,
      tools: [{ google_search: {} }],
    });
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
