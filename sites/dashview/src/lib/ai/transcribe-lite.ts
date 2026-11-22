import { studioCall } from "@/lib/studio/client";

/**
 * תמלול מדיבור בדפדפן: מפענחים את הסאונד של כל סרטון ל-16kHz מונו, חותכים לקטעים של עד 50 שניות,
 * ושולחים כל קטע לשרת (Gemini). הזמנים חוזרים ביחס לריל כולו, לפי סדר הסרטונים.
 */
const RATE = 16000;
const CHUNK = 50;

export type Seg = { start: number; end: number; text: string };

async function decode(file: Blob): Promise<Float32Array | null> {
  try {
    const buf = await file.arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    void ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(audio.duration * RATE), RATE);
    const src = off.createBufferSource();
    src.buffer = audio; src.connect(off.destination); src.start();
    return (await off.startRendering()).getChannelData(0);
  } catch { return null; }
}

/** יש בכלל דיבור? בודקים את עוצמת הסאונד, כדי לא לשלוח שקט */
const loud = (s: Float32Array, a: number, b: number) => {
  let sum = 0, n = 0;
  for (let i = a; i < b; i += 40) { sum += s[i] * s[i]; n++; }
  return n > 0 && Math.sqrt(sum / n) > 0.01;
};

function wavBase64(s: Float32Array, a: number, b: number) {
  const n = Math.max(0, b - a);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, s[a + i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function transcribeFiles(files: { file: Blob; seconds: number }[], onStep: (s: string) => void): Promise<{ segments: Seg[]; missingKey: boolean }> {
  const out: Seg[] = [];
  let offset = 0;
  let missingKey = false;
  for (const [i, f] of files.entries()) {
    onStep(files.length > 1 ? `מקשיבה לסרטון ${i + 1} מתוך ${files.length}...` : "מקשיבה אם מדברים בסרטון...");
    const s = await decode(f.file);
    if (s) {
      for (let t = 0; t < s.length / RATE; t += CHUNK) {
        const a = Math.floor(t * RATE), b = Math.min(s.length, Math.floor((t + CHUNK) * RATE));
        if (!loud(s, a, b)) continue;
        const r = await studioCall<{ segments: Seg[]; missingKey?: boolean }>("transcribe", { audio: wavBase64(s, a, b), duration: (b - a) / RATE });
        if (r.missingKey) { missingKey = true; return { segments: [], missingKey }; }
        for (const x of r.segments) out.push({ start: +(offset + t + x.start).toFixed(2), end: +(offset + t + Math.min(x.end, (b - a) / RATE)).toFixed(2), text: x.text.trim() });
      }
    }
    offset += f.seconds;
  }
  return { segments: out, missingKey };
}
