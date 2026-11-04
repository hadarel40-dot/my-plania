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

/**
 * הסרת רקע מסרטון, כולו בתוך הדפדפן: כל פריים עובר דרך מודל שמזהה אנשים (MediaPipe,
 * חינמי, רץ במכשיר), והרקע מוחלף ברקע החדש. התוצאה היא סרטון חדש (MP4) עם הסאונד המקורי,
 * באותו אורך ובאותם זמנים, כך שהחיתוכים והכתוביות נשארים במקום.
 */
export async function removeBackground(asset: MediaAsset, bg: NewBackground, onProgress: (p: number) => void): Promise<File> {
  const started = Date.now();
  const { Input, Output, BlobSource, UrlSource, ALL_FORMATS, VideoSampleSink, EncodedPacketSink, CanvasSource, EncodedAudioPacketSource, BufferTarget, Mp4OutputFormat } = await import("mediabunny");
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");

  const source = asset.url.startsWith("blob:") ? new BlobSource(await (await fetch(asset.url)).blob()) : new UrlSource(asset.url);
  const input = new Input({ source, formats: ALL_FORMATS });
  const vision = await FilesetResolver.forVisionTasks("/mediapipe");
  const segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate: "GPU" },
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  }).catch(() => ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate: "CPU" },
    runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
  }));

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("אין וידאו בקובץ");
    const duration = await input.computeDuration();
    // עד 720p בצלע הקצרה: מהיר מספיק לטלפון, ונראה טוב ברילס
    const scale = Math.min(1, 720 / Math.min(track.displayWidth, track.displayHeight));
    const W = Math.round((track.displayWidth * scale) / 2) * 2;
    const H = Math.round((track.displayHeight * scale) / 2) * 2;

    const out = new OffscreenCanvas(W, H);
    const ctx = out.getContext("2d")!;
    const frame = new OffscreenCanvas(W, H);
    const fctx = frame.getContext("2d")!;
    // הזיהוי רץ על תמונה קטנה (מהיר), והמסכה מוגדלת בעדינות (קצוות רכים)
    const SW = 256, SH = Math.round((256 * H) / W);
    const small = new OffscreenCanvas(SW, SH);
    const sctx = small.getContext("2d")!;
    const mask = new OffscreenCanvas(SW, SH);
    const mctx = mask.getContext("2d")!;
    const maskData = mctx.createImageData(SW, SH);
    let prev: Float32Array | null = null;
    // רקע מטושטש בלי ctx.filter (שלא קיים בכל דפדפן): הקטנה מאוד והגדלה חזרה
    const tiny = new OffscreenCanvas(Math.max(8, Math.round(W / 24)), Math.max(8, Math.round(H / 24)));
    const tctx = tiny.getContext("2d")!;
    const image = bg.kind === "image" ? await createImageBitmap(await (await fetch(bg.url)).blob()) : null;

    const drawBackground = () => {
      if (bg.kind === "blur") {
        tctx.drawImage(frame, 0, 0, tiny.width, tiny.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(tiny, 0, 0, W, H);
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
    const videoSource = new CanvasSource(out as unknown as HTMLCanvasElement, { codec: "avc", bitrate: 4_000_000, keyFrameInterval: 1 });
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

    let n = 0;
    for await (const sample of new VideoSampleSink(track).samples()) {
      fctx.clearRect(0, 0, W, H);
      sample.drawWithFit(fctx, { fit: "fill" });
      const ts = sample.timestamp, dur = sample.duration;
      sample.close();

      sctx.drawImage(frame, 0, 0, SW, SH);
      const result = segmenter.segmentForVideo(small, Math.round(ts * 1000) + 1);
      const conf = result.confidenceMasks?.[0]?.getAsFloat32Array();
      // החלקה בין פריימים: פחות "הבהובים" בקצוות
      const cur = conf ? Float32Array.from(conf) : new Float32Array(SW * SH).fill(1);
      if (prev) for (let i = 0; i < cur.length; i++) cur[i] = cur[i] * 0.7 + prev[i] * 0.3;
      prev = cur;
      result.close();
      for (let i = 0; i < cur.length; i++) {
        // סף רך: מתחת ל-0.4 רקע, מעל 0.75 אדם, ובאמצע מעבר הדרגתי (פחות "שאריות" רקע בקצוות)
        const a = Math.min(1, Math.max(0, (cur[i] - 0.4) / 0.35));
        maskData.data[i * 4 + 3] = Math.round(a * 255);
      }
      mctx.putImageData(maskData, 0, 0);

      drawBackground();
      // האדם: הפריים, חתוך לפי המסכה
      fctx.globalCompositeOperation = "destination-in";
      fctx.imageSmoothingQuality = "high";
      fctx.drawImage(mask, 0, 0, W, H);
      fctx.globalCompositeOperation = "source-over";
      ctx.drawImage(frame, 0, 0);

      await videoSource.add(ts, dur);
      onProgress(Math.min(0.97, ts / duration));
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
    logEvent("remove_bg_done", { ms: Date.now() - started, frames: n, size: buffer.byteLength, bg: bg.kind, audio: !!audio });
    onProgress(1);
    return new File([buffer], asset.name.replace(/\.[^.]+$/, "") + " (רקע חדש).mp4", { type: "video/mp4" });
  } catch (e) {
    logEvent("remove_bg_failed", { ms: Date.now() - started, error: errorText(e) });
    throw e;
  } finally {
    segmenter.close();
    input.dispose();
  }
}
