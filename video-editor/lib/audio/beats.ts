import { ANALYSIS_RATE } from "./decode";

const HOP = 128; // 8ms
const FRAME = 512;

/**
 * מוצא את הביטים במוזיקה (בשניות). שלבים: עוצמת "התקפות" (עלייה חדה באנרגיה),
 * מציאת הטמפו לפי חזרתיות (אוטוקורלציה בטווח 70-180 BPM), ואז ההיסט של הרשת
 * שהכי מתיישב על ההתקפות.
 */
export function detectBeats(samples: Float32Array): { bpm: number; beats: number[] } {
  const frames = Math.floor((samples.length - FRAME) / HOP);
  if (frames < 50) return { bpm: 0, beats: [] };

  // אנרגיה לכל חלון, ואז רק העליות (onset strength)
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const o = f * HOP;
    for (let i = 0; i < FRAME; i++) sum += samples[o + i] * samples[o + i];
    energy[f] = Math.log1p(sum * 100);
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  // מחסירים ממוצע נע, כדי שקטע רועש לא ייראה כמו ביט אחד ארוך
  const win = 32;
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let m = 0, n = 0;
    for (let k = Math.max(0, f - win); k < Math.min(frames, f + win); k++) { m += onset[k]; n++; }
    env[f] = Math.max(0, onset[f] - m / n);
  }

  const fps = ANALYSIS_RATE / HOP;
  const minLag = Math.round((60 / 180) * fps);
  const maxLag = Math.round((60 / 70) * fps);
  let bestLag = 0, bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += env[f] * env[f - lag];
    // העדפה קלה לטמפו סביב 120, כדי לא ליפול על חצי או כפול
    const bpm = (60 * fps) / lag;
    s *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.2, 2));
    if (s > bestScore) { bestScore = s; bestLag = lag; }
  }
  if (!bestLag) return { bpm: 0, beats: [] };

  // טמפו מדויק יותר מהשלם הקרוב: אינטרפולציה פרבולית סביב השיא
  const ac = (lag: number) => { let v = 0; for (let f = lag; f < frames; f++) v += env[f] * env[f - lag]; return v; };
  const [y0, y1, y2] = [ac(bestLag - 1), ac(bestLag), ac(bestLag + 1)];
  const denom = y0 - 2 * y1 + y2;
  const period = bestLag + (denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0);

  let bestOffset = 0, bestSum = -1;
  for (let off = 0; off < bestLag; off++) {
    let s = 0;
    for (let f = off; f < frames; f += period) s += env[Math.round(f)];
    if (s > bestSum) { bestSum = s; bestOffset = off; }
  }
  // כל ביט ברשת "נצמד" להתקפה החזקה בסביבתו (עד 40ms), כדי לא להיסחף לאורך השיר
  const snap = Math.round(0.04 * fps);
  const beats: number[] = [];
  for (let g = bestOffset; g < frames; g += period) {
    const c = Math.round(g);
    let best = c;
    for (let f = Math.max(0, c - snap); f <= Math.min(frames - 1, c + snap); f++) if (env[f] > env[best]) best = f;
    beats.push(+((best * HOP + FRAME / 2) / ANALYSIS_RATE).toFixed(3));
  }
  return { bpm: Math.round((60 * fps) / period), beats };
}
