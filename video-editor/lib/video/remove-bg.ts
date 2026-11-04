"use client";
import "@/lib/dispose-polyfill";
import type { MediaAsset } from "@/lib/editor/types";
import { logEvent, errorText } from "@/lib/telemetry";

/** הרקע החדש שמאחורי האדם */
export type NewBackground =
  | { kind: "blur" }
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string }
  | { kind: "image"; url: string };

/** המודל המדויק (מזהה גם שיער, בגדים ועור בנפרד); אם לא נטען, המודל הקטן */
const MODEL_HQ = "/models/selfie_multiclass_256x256.tflite";
const MODEL_LITE = "/models/selfie_segmenter.tflite";
const MODEL_CACHE = "ai-video-editor:models:v1";

/**
 * הסרת רקע מסרטון, כולו בתוך הדפדפן: כל פריים עובר דרך מודל שמזהה אנשים (MediaPipe,
 * חינמי, רץ במכשיר), הקצוות מחודדים לפי התמונה עצמה (guided filter: המסכה "נצמדת"
 * לקווי המתאר האמיתיים של השיער והכתפיים), והרקע מוחלף ברקע החדש. התוצאה היא סרטון חדש
 * (MP4) עם הסאונד המקורי, באותו אורך ובאותם זמנים, כך שהחיתוכים והכתוביות נשארים במקום.
 */
export async function removeBackground(
  asset: MediaAsset, bg: NewBackground, onProgress: (p: number) => void, onStage?: (s: string) => void,
  /** "best": תמיד המודל המדויק, בכל פריים (איטי יותר במכשירים חלשים) */
  quality: "auto" | "best" = "auto",
): Promise<File> {
  const started = Date.now();
  const { Input, Output, BlobSource, UrlSource, ALL_FORMATS, VideoSampleSink, EncodedPacketSink, CanvasSource, EncodedAudioPacketSource, BufferTarget, Mp4OutputFormat } = await import("mediabunny");
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");

  const source = asset.url.startsWith("blob:") ? new BlobSource(await (await fetch(asset.url)).blob()) : new UrlSource(asset.url);
  const input = new Input({ source, formats: ALL_FORMATS });
  onStage?.("טוען את מודל הזיהוי…");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe");
  const make = (buffer: Uint8Array, delegate: "GPU" | "CPU") => ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer: buffer, delegate },
    runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
  });
  type Seg = Awaited<ReturnType<typeof make>>;
  // שעון עולה לזיהוי (המודל דורש זמנים עולים, גם במדידת המהירות)
  let clock = 1;
  const probe = new OffscreenCanvas(256, 256);
  const pctx = probe.getContext("2d")!;
  pctx.fillStyle = "#8a8a8a"; pctx.fillRect(0, 0, 256, 256);
  pctx.fillStyle = "#3a2a20"; pctx.beginPath(); pctx.arc(128, 96, 48, 0, 7); pctx.fill(); pctx.fillRect(56, 150, 144, 106);
  /** כמה זמן לוקח זיהוי של פריים אחד במכשיר הזה (אחרי חימום) */
  const speed = (seg: Seg) => {
    const once = () => {
      const t0 = performance.now();
      const r = seg.segmentForVideo(probe, (clock += 40));
      r.confidenceMasks?.[0]?.getAsFloat32Array();
      r.close();
      return performance.now() - t0;
    };
    once(); once();
    // איטי מאוד כבר בפעם השלישית: לא ממשיכים למדוד
    const first = once();
    if (first > 300) return first;
    return (first + once() + once()) / 3;
  };
  /**
   * בוחרים את המודל לפי המכשיר: המדויק (שיער, בגדים) אם הוא מהיר מספיק, אפשר גם בכל פריים
   * שני; אחרת המודל המהיר. חידוד הקצוות לפי התמונה רץ בכל מקרה, בכל פריים.
   */
  let segmenter: Seg | null = null, multiclass = false, stride = 1, segSpeed = 0;
  const tried: Record<string, number> = {};
  try {
    const hq = await loadModel(MODEL_HQ, (p) => onProgress(p * 0.05));
    onStage?.("בודק את מהירות המכשיר…");
    for (const delegate of ["GPU", "CPU"] as const) {
      const seg = await make(hq, delegate).catch(() => null);
      if (!seg) continue;
      const ms = speed(seg);
      tried[`hq_${delegate}`] = Math.round(ms);
      if ((quality === "best" || ms <= 250) && (!segmenter || ms < segSpeed)) { segmenter?.close(); segmenter = seg; segSpeed = ms; multiclass = true; }
      else seg.close();
      if (segmenter && segSpeed <= 60) break;
    }
    stride = quality === "auto" && segSpeed > 70 ? 2 : 1;
  } catch (e) {
    logEvent("remove_bg_model_fallback", { error: errorText(e) });
  }
  if (!segmenter) {
    const lite = await loadModel(MODEL_LITE, () => undefined);
    for (const delegate of ["GPU", "CPU"] as const) {
      const seg = await make(lite, delegate).catch(() => null);
      if (!seg) continue;
      const ms = speed(seg);
      tried[`lite_${delegate}`] = Math.round(ms);
      if (!segmenter || ms < segSpeed) { segmenter?.close(); segmenter = seg; segSpeed = ms; } else seg.close();
    }
    if (!segmenter) throw new Error("זיהוי האדם לא נטען במכשיר הזה");
    stride = 1;
  }
  const seg: Seg = segmenter;
  onStage?.("מזהה את האדם ומחליף את הרקע…");

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("אין וידאו בקובץ");
    const duration = await input.computeDuration();
    // עד 1080p בצלע הקצרה: האיכות של הסרטון נשמרת
    const scale = Math.min(1, 1080 / Math.min(track.displayWidth, track.displayHeight));
    const W = Math.round((track.displayWidth * scale) / 2) * 2;
    const H = Math.round((track.displayHeight * scale) / 2) * 2;

    const out = new OffscreenCanvas(W, H);
    const ctx = out.getContext("2d")!;
    const frame = new OffscreenCanvas(W, H);
    const fctx = frame.getContext("2d")!;
    // הזיהוי: המודל עובד על 256x256, אז נותנים לו תמונה בגודל הזה
    const SW = 256, SH = 256;
    const small = new OffscreenCanvas(SW, SH);
    const sctx = small.getContext("2d")!;
    const lowMask = new OffscreenCanvas(SW, SH);
    const lctx = lowMask.getContext("2d")!;
    const lowData = lctx.createImageData(SW, SH);
    // חידוד הקצוות: ברזולוציה בינונית (מהיר מספיק לטלפון, ומדויק בהרבה מ-256)
    const gs = Math.min(1, 432 / Math.min(W, H));
    const GW = Math.round(W * gs), GH = Math.round(H * gs);
    const guide = new OffscreenCanvas(GW, GH);
    const gctx = guide.getContext("2d", { willReadFrequently: true })!;
    const gmask = new OffscreenCanvas(GW, GH);
    const gmctx = gmask.getContext("2d", { willReadFrequently: true })!;
    const alphaData = gmctx.createImageData(GW, GH);
    const filter = guidedFilter(GW, GH, Math.max(4, Math.round(GW / 70)), 2e-3);
    let prev: Float32Array | null = null;

    // רקע מטושטש בלי ctx.filter (שלא קיים בכל דפדפן): הקטנה מאוד והגדלה חזרה, פעמיים
    const tiny = new OffscreenCanvas(Math.max(8, Math.round(W / 28)), Math.max(8, Math.round(H / 28)));
    const tctx = tiny.getContext("2d")!;
    const mid = new OffscreenCanvas(Math.max(16, Math.round(W / 8)), Math.max(16, Math.round(H / 8)));
    const midctx = mid.getContext("2d")!;
    const image = bg.kind === "image" ? await createImageBitmap(await (await fetch(bg.url)).blob()) : null;

    const drawBackground = () => {
      if (bg.kind === "blur") {
        tctx.imageSmoothingQuality = "high";
        tctx.drawImage(frame, 0, 0, tiny.width, tiny.height);
        midctx.imageSmoothingQuality = "high";
        midctx.drawImage(tiny, 0, 0, mid.width, mid.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(mid, 0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        ctx.fillRect(0, 0, W, H);
      } else if (bg.kind === "color") {
        ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H);
      } else if (bg.kind === "gradient") {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else if (image) {
        const s = Math.max(W / image.width, H / image.height);
        ctx.drawImage(image, (W - image.width * s) / 2, (H - image.height * s) / 2, image.width * s, image.height * s);
      }
    };

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const bitrate = Math.min(10_000_000, Math.round(W * H * 6));
    const videoSource = new CanvasSource(out as unknown as HTMLCanvasElement, { codec: "avc", bitrate, keyFrameInterval: 1 });
    output.addVideoTrack(videoSource);
    // הסאונד המקורי עובר כמו שהוא (בלי קידוד מחדש), אם הוא בפורמט שמתאים ל-MP4
    let audio: { sink: InstanceType<typeof EncodedPacketSink>; src: InstanceType<typeof EncodedAudioPacketSource>; config: AudioDecoderConfig } | null = null;
    for (const t of await input.getAudioTracks()) {
      const config = await t.getDecoderConfig();
      if (t.codec === "aac" && config) {
        const src = new EncodedAudioPacketSource("aac");
        output.addAudioTrack(src);
        audio = { sink: new EncodedPacketSink(t), src, config };
        break;
      }
    }
    await output.start();

    const lum = new Float32Array(GW * GH);
    const p = new Float32Array(GW * GH);
    let n = 0, segMs = 0, refineMs = 0, encMs = 0;
    for await (const sample of new VideoSampleSink(track).samples()) {
      fctx.globalCompositeOperation = "source-over";
      fctx.clearRect(0, 0, W, H);
      sample.drawWithFit(fctx, { fit: "fill" });
      const ts = sample.timestamp, dur = sample.duration;
      sample.close();

      // 1. זיהוי האדם (הסתברות לכל נקודה). במכשיר איטי: בכל פריים שני, והמסכה הקודמת
      // משמשת בפריים שבאמצע (חידוד הקצוות לפי התמונה הנוכחית מיישר אותה)
      let tick = performance.now();
      if (n % stride === 0) {
      sctx.drawImage(frame, 0, 0, SW, SH);
      clock = Math.max(clock + 1, Math.round(ts * 1000) + 1);
      const result = seg.segmentForVideo(small, clock);
      const masks = result.confidenceMasks ?? [];
      const cur = new Float32Array(SW * SH);
      if (multiclass && masks[0]) {
        // במודל המדויק הערוץ הראשון הוא הרקע; כל השאר (שיער, פנים, גוף, בגדים) הם האדם
        const bgConf = masks[0].getAsFloat32Array();
        for (let i = 0; i < cur.length; i++) cur[i] = 1 - bgConf[i];
      } else if (masks[0]) cur.set(masks[0].getAsFloat32Array());
      else cur.fill(1);
      result.close();
      // 2. החלקה בין פריימים, רק במקומות שכמעט לא זזו (אחרת נשארת "רוח רפאים" בתנועה)
      if (prev) for (let i = 0; i < cur.length; i++) { if (Math.abs(cur[i] - prev[i]) < 0.35) cur[i] = cur[i] * 0.65 + prev[i] * 0.35; }
      prev = cur;
      for (let i = 0; i < cur.length; i++) lowData.data[i * 4 + 3] = Math.round(cur[i] * 255);
      lctx.putImageData(lowData, 0, 0);
      }

      segMs += performance.now() - tick; tick = performance.now();
      // 3. חידוד הקצוות לפי התמונה עצמה
      gctx.drawImage(frame, 0, 0, GW, GH);
      const px = gctx.getImageData(0, 0, GW, GH).data;
      for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255;
      gmctx.clearRect(0, 0, GW, GH);
      gmctx.imageSmoothingQuality = "high";
      gmctx.drawImage(lowMask, 0, 0, GW, GH);
      const mpx = gmctx.getImageData(0, 0, GW, GH).data;
      for (let i = 0; i < p.length; i++) p[i] = mpx[i * 4 + 3] / 255;
      const q = filter(lum, p);
      for (let i = 0; i < q.length; i++) {
        // מעבר רך אבל קצר: בלי הילה של רקע סביב האדם, ובלי קצוות "משוננים"
        const x = Math.min(1, Math.max(0, (q[i] - 0.3) / 0.45));
        alphaData.data[i * 4 + 3] = Math.round(x * x * (3 - 2 * x) * 255);
      }
      gmctx.putImageData(alphaData, 0, 0);

      // 4. הרכבה: רקע חדש, ומעליו האדם חתוך לפי המסכה
      drawBackground();
      fctx.globalCompositeOperation = "destination-in";
      fctx.imageSmoothingQuality = "high";
      fctx.drawImage(gmask, 0, 0, W, H);
      fctx.globalCompositeOperation = "source-over";
      ctx.drawImage(frame, 0, 0);

      refineMs += performance.now() - tick; tick = performance.now();
      await videoSource.add(ts, dur);
      encMs += performance.now() - tick;
      onProgress(0.05 + Math.min(0.92, (ts / duration) * 0.92));
      n++;
    }
    if (audio) {
      let first = true;
      for await (const packet of audio.sink.packets()) {
        await audio.src.add(packet, first ? { decoderConfig: audio.config } : undefined);
        first = false;
      }
    }
    await output.finalize();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer!;
    logEvent("remove_bg_done", { ms: Date.now() - started, frames: n, size: buffer.byteLength, bg: bg.kind, audio: !!audio, multiclass, stride, tried, quality, w: W, h: H, segMs: Math.round(segMs / Math.max(1, n)), refineMs: Math.round(refineMs / Math.max(1, n)), encMs: Math.round(encMs / Math.max(1, n)) });
    onProgress(1);
    return new File([buffer], asset.name.replace(/\.[^.]+$/, "") + " (רקע חדש).mp4", { type: "video/mp4" });
  } catch (e) {
    logEvent("remove_bg_failed", { ms: Date.now() - started, error: errorText(e) });
    throw e;
  } finally {
    seg.close();
    input.dispose();
  }
}

/** הורדת המודל פעם אחת (עם התקדמות), ושמירה בדפדפן לפעמים הבאות */
async function loadModel(url: string, onProgress: (p: number) => void): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try { cache = await caches.open(MODEL_CACHE); } catch { /* בלי Cache API */ }
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) { onProgress(1); return new Uint8Array(await hit.arrayBuffer()); }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`המודל לא נטען (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (total) onProgress(got / total);
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const part of parts) { buf.set(part, o); o += part.length; }
  if (buf.length < 1000) throw new Error("המודל לא נטען");
  await cache?.put(url, new Response(buf.slice(), { headers: { "content-type": "application/octet-stream" } })).catch(() => undefined);
  return buf;
}

/**
 * Guided filter (He et al.): מיישר את המסכה לפי קווי המתאר של התמונה. מחזיר פונקציה
 * שמשתמשת באותם מערכים בכל פריים (בלי הקצאות חדשות).
 */
export function guidedFilter(w: number, h: number, r: number, eps: number) {
  const n = w * h;
  const meanI = new Float32Array(n), meanP = new Float32Array(n), corrI = new Float32Array(n), corrIP = new Float32Array(n);
  const a = new Float32Array(n), b = new Float32Array(n), tmp = new Float32Array(n), ii = new Float32Array(n), ip = new Float32Array(n);
  const q = new Float32Array(n);
  const box = (src: Float32Array, dst: Float32Array) => {
    // ממוצע בחלון (2r+1)² בשני מעברים: שורות ואז עמודות, עם סכום רץ
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let s = 0, c = 0;
      for (let x = 0; x <= Math.min(r, w - 1); x++) { s += src[row + x]; c++; }
      for (let x = 0; x < w; x++) {
        tmp[row + x] = s / c;
        const add = x + r + 1, rem = x - r;
        if (add < w) { s += src[row + add]; c++; }
        if (rem >= 0) { s -= src[row + rem]; c--; }
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let y = 0; y <= Math.min(r, h - 1); y++) { s += tmp[y * w + x]; c++; }
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = s / c;
        const add = y + r + 1, rem = y - r;
        if (add < h) { s += tmp[add * w + x]; c++; }
        if (rem >= 0) { s -= tmp[rem * w + x]; c--; }
      }
    }
  };
  return (I: Float32Array, p: Float32Array) => {
    for (let i = 0; i < n; i++) { ii[i] = I[i] * I[i]; ip[i] = I[i] * p[i]; }
    box(I, meanI); box(p, meanP); box(ii, corrI); box(ip, corrIP);
    for (let i = 0; i < n; i++) {
      const varI = corrI[i] - meanI[i] * meanI[i];
      const cov = corrIP[i] - meanI[i] * meanP[i];
      a[i] = cov / (varI + eps);
      b[i] = meanP[i] - a[i] * meanI[i];
    }
    box(a, ii); box(b, ip);
    for (let i = 0; i < n; i++) q[i] = ii[i] * I[i] + ip[i];
    return q;
  };
}
