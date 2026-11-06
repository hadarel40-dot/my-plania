"use client";
import "@/lib/dispose-polyfill";
import type { MediaAsset } from "@/lib/editor/types";

/** קצב הדגימה של הקול המשופר (איכות של פודקאסט) */
const OUT_RATE = 44100;

export interface VoiceOptions {
  /** ניקוי רעשי רקע (מזגן, רחוב, זמזום) */
  denoise: boolean;
  /** קול פודקאסט: חום, בהירות ועוצמה אחידה */
  podcast: boolean;
}

export interface VoiceStats {
  /** כמה ירד רעש הרקע (dB) */
  noiseCutDb: number;
  ms: number;
}

/**
 * משפר את הקול של סרטון, כולו בדפדפן, ומחזיר קובץ שמע (WAV) באותו אורך ובאותם זמנים
 * כמו הסרטון, כך שכל חיתוך וכתובית נשארים במקום:
 *  1. ניקוי רעשים: לומד איך נשמע הרקע ברגעים השקטים, ומחסיר אותו מכל הסרטון
 *     (spectral subtraction), עם החלקה כדי שלא יישמעו "בועות".
 *  2. קול פודקאסט: מסנן רעמים נמוכים, מוריד "בוץ", מוסיף חום ובהירות, ודוחס (compressor)
 *     כך שכל המילים באותה עוצמה.
 *  3. עוצמה סופית אחידה (כמו ברילס ובפודקאסטים), בלי עיוות.
 */
export async function enhanceVoice(asset: Pick<MediaAsset, "url" | "name">, opts: VoiceOptions, onProgress: (p: number) => void = () => {}): Promise<{ file: File; stats: VoiceStats }> {
  const started = Date.now();
  const { samples, rate } = await decodeFull(asset.url);
  onProgress(0.15);
  let x = samples;
  let noiseCutDb = 0;
  if (opts.denoise) {
    const before = quietLevel(x, rate);
    x = await denoise(x, rate, (p) => onProgress(0.15 + p * 0.55));
    noiseCutDb = Math.max(0, 20 * Math.log10(before / Math.max(1e-6, quietLevel(x, rate))));
  }
  onProgress(0.72);
  x = await podcastChain(x, rate, opts.podcast);
  onProgress(0.9);
  normalize(x, OUT_RATE);
  const file = new File([wavFile(x, OUT_RATE)], asset.name.replace(/\.[^.]+$/, "") + " (קול נקי).wav", { type: "audio/wav" });
  onProgress(1);
  return { file, stats: { noiseCutDb: +noiseCutDb.toFixed(1), ms: Date.now() - started } };
}

/** כל פס הקול במונו, בקצב המקורי */
async function decodeFull(url: string): Promise<{ samples: Float32Array; rate: number }> {
  const { Input, BlobSource, UrlSource, ALL_FORMATS, AudioBufferSink } = await import("mediabunny");
  const source = url.startsWith("blob:") ? new BlobSource(await (await fetch(url)).blob()) : new UrlSource(url);
  const input = new Input({ source, formats: ALL_FORMATS });
  try {
    let track = null;
    for (const t of await input.getAudioTracks()) if (await t.canDecode()) { track = t; break; }
    if (!track) throw new Error("אין בסרטון פס קול");
    const duration = await input.computeDuration();
    const rate = track.sampleRate;
    const mono = new Float32Array(Math.ceil(duration * rate));
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      const offset = Math.max(0, Math.round(timestamp * rate));
      const chans = buffer.numberOfChannels;
      for (let c = 0; c < chans; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length && offset + i < mono.length; i++) mono[offset + i] += data[i] / chans;
      }
    }
    return { samples: mono, rate };
  } finally {
    input.dispose();
  }
}

/** עוצמת הרקע: ה-RMS של 10% החלונות השקטים ביותר */
function quietLevel(x: Float32Array, rate: number): number {
  const n = Math.round(rate * 0.05);
  const levels: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j++) s += x[j] * x[j];
    levels.push(Math.sqrt(s / n));
  }
  levels.sort((a, b) => a - b);
  return levels[Math.floor(levels.length * 0.1)] ?? 0;
}

/** FFT מרוכב במקום (radix-2), n חזקה של 2 */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/**
 * ניקוי רעשים (spectral subtraction): פרופיל הרעש נלמד מהחלונות השקטים ביותר, ובכל חלון
 * מורידים מכל תדר את הרעש שלו. רצפה של ‎-18dB ‏(לא מוחקים לגמרי, כדי שהקול יישאר טבעי)
 * והחלקה בזמן ובתדר נגד "בועות".
 */
async function denoise(x: Float32Array, rate: number, onProgress: (p: number) => void): Promise<Float32Array> {
  const N = rate > 32000 ? 2048 : 1024, H = N / 4, bins = N / 2 + 1;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.max(1, Math.ceil((x.length - N) / H) + 1);
  const re = new Float64Array(N), im = new Float64Array(N);

  // 1. פרופיל הרעש: ממוצע הספקטרום ב-12% החלונות השקטים ביותר
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = 0; i < N; i++) { const v = x[f * H + i] ?? 0; s += v * v; }
    energy[f] = s;
  }
  const order = Array.from({ length: frames }, (_, i) => i).sort((a, b) => energy[a] - energy[b]);
  const quiet = order.slice(0, Math.max(3, Math.floor(frames * 0.12)));
  const median = energy[order[Math.floor(frames / 2)]] || 1e-12;
  const quietMean = quiet.reduce((s, f) => s + energy[f], 0) / quiet.length;
  // בלי רגעים שקטים באמת (מדברים כל הזמן): ניקוי עדין יותר, כדי לא לפגוע בקול
  const strength = quietMean > median * 0.25 ? 0.8 : 2;
  const noise = new Float64Array(bins);
  for (const f of quiet) {
    for (let i = 0; i < N; i++) { re[i] = (x[f * H + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) noise[k] += (re[k] * re[k] + im[k] * im[k]) / quiet.length;
  }

  // 2. החסרה, חלון אחרי חלון, והרכבה מחדש (overlap-add)
  const out = new Float64Array(x.length + N);
  const norm = new Float64Array(x.length + N);
  const prev = new Float64Array(bins).fill(1);
  const gain = new Float64Array(bins);
  const FLOOR = 0.1;
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = (x[o + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) {
      const p = re[k] * re[k] + im[k] * im[k] + 1e-12;
      const g = Math.sqrt(Math.max(0, 1 - (strength * noise[k]) / p));
      // החלקה בזמן: הגבר עולה מהר (מילה מתחילה) ויורד לאט (בלי "בועות")
      gain[k] = Math.max(FLOOR, g > prev[k] ? g : 0.6 * prev[k] + 0.4 * g);
    }
    // החלקה קלה בין תדרים שכנים
    for (let k = 1; k < bins - 1; k++) prev[k] = 0.25 * gain[k - 1] + 0.5 * gain[k] + 0.25 * gain[k + 1];
    prev[0] = gain[0]; prev[bins - 1] = gain[bins - 1];
    for (let k = 0; k < bins; k++) {
      re[k] *= prev[k]; im[k] *= prev[k];
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
    if (f % 400 === 0) { onProgress(f / frames); await new Promise((r) => setTimeout(r, 0)); }
  }
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  return y;
}

/** שרשרת "קול פודקאסט" (או רק המרה לקצב היציאה) */
async function podcastChain(x: Float32Array, rate: number, podcast: boolean): Promise<Float32Array> {
  const length = Math.ceil((x.length * OUT_RATE) / rate);
  const ctx = new OfflineAudioContext(1, length, OUT_RATE);
  const buf = ctx.createBuffer(1, x.length, rate);
  buf.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  let node: AudioNode = src;
  if (podcast) {
    const filter = (type: BiquadFilterType, freq: number, gain = 0, q = 0.8) => {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.gain.value = gain; f.Q.value = q;
      node.connect(f); node = f;
    };
    filter("highpass", 75, 0, 0.7); // רעמים ורעידות
    filter("lowshelf", 140, 2.5); // חום
    filter("peaking", 320, -3, 1.1); // "בוץ" / קול של חדר
    filter("peaking", 3200, 3, 0.9); // בהירות ונוכחות של המילים
    filter("highshelf", 9000, 2); // אוויר
  }
  node.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  const y = rendered.getChannelData(0).slice();
  if (podcast) dynamics(y, OUT_RATE);
  return y;
}

/**
 * דינמיקה של פודקאסט: דחיסה עדינה של הדיבור (כל המילים באותה עוצמה) ו"שער" רך
 * שמוריד את הרקע ברווחים שבין המילים. (הדוחס של הדפדפן מעלה אוטומטית גם את הרעש,
 * ולכן הדינמיקה כתובה כאן.)
 */
function dynamics(x: Float32Array, rate: number) {
  const n = Math.round(rate * 0.05);
  const lv: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j++) s += x[j] * x[j];
    lv.push(Math.sqrt(s / n));
  }
  if (!lv.length) return;
  lv.sort((a, b) => a - b);
  const noise = lv[Math.floor(lv.length * 0.1)] + 1e-7;
  const speech = lv[Math.floor(lv.length * 0.85)] + 1e-7;
  // סף הדחיסה: קצת מעל עוצמת הדיבור הרגילה; סף השער: בין הרעש לדיבור
  const T = speech * 1.1, ratio = 3;
  const G = Math.min(speech * 0.35, Math.max(noise * 3, speech * 0.08));
  const envA = Math.exp(-1 / (0.005 * rate)), envR = Math.exp(-1 / (0.12 * rate));
  const gOpen = Math.exp(-1 / (0.003 * rate)), gClose = Math.exp(-1 / (0.09 * rate));
  let env = 0, g = 1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]) * 1.4142;
    env = a > env ? envA * env + (1 - envA) * a : envR * env + (1 - envR) * a;
    let target = 1;
    if (env > T) target = Math.pow(T / env, 1 - 1 / ratio);
    else if (env < G) target = Math.max(0.1, Math.pow(env / G, 1.5));
    g = target > g ? gOpen * g + (1 - gOpen) * target : gClose * g + (1 - gClose) * target;
    x[i] *= g;
  }
}

/** עוצמת הדיבור לרמה אחידה (בערך ‎-16 LUFS), והגבלת שיאים בלי עיוות */
function normalize(x: Float32Array, rate: number) {
  const n = Math.round(rate * 0.4);
  const levels: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j++) s += x[j] * x[j];
    levels.push(Math.sqrt(s / n));
  }
  levels.sort((a, b) => a - b);
  // עוצמת הדיבור: החלונות החזקים (בלי השקטים שביניהם)
  const speech = levels[Math.floor(levels.length * 0.8)] ?? 0;
  if (speech < 1e-5) return;
  const g = Math.min(12, 0.16 / speech);
  for (let i = 0; i < x.length; i++) {
    const v = x[i] * g;
    // מגביל רך: מעל 0.8 מתעגל בעדינות, אף פעם לא מעל 1
    const a = Math.abs(v);
    x[i] = a <= 0.8 ? v : Math.sign(v) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
  }
}

/** קובץ WAV מונו 16 ביט */
function wavFile(x: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
  return buf;
}
