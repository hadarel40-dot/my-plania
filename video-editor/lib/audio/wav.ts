import { ANALYSIS_RATE } from "./decode";

/** קטע מגל המונו (16kHz) כקובץ WAV של 16 ביט, מקודד base64 (לשליחה למודל שמבין סאונד) */
export function wavBase64(samples: Float32Array, from: number, to: number): string {
  const a = Math.max(0, Math.floor(from * ANALYSIS_RATE));
  const b = Math.min(samples.length, Math.ceil(to * ANALYSIS_RATE));
  const n = Math.max(0, b - a);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, ANALYSIS_RATE, true); v.setUint32(28, ANALYSIS_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[a + i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  // המרה ל-base64 בחלקים, כדי לא לחרוג מאורך הארגומנטים של String.fromCharCode
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
