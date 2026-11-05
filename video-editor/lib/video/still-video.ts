"use client";
import "@/lib/dispose-polyfill";
import { ASPECT_SIZE, type Aspect } from "@/lib/editor/types";

/**
 * תמונה מהגלריה כסרטון קצר (10 שניות, תמונה קבועה), כדי שתשמש רקע בדיוק כמו סרטון:
 * נשמרת בענן, מתנגנת בלולאה, ונראית אותו דבר בנגן ובייצוא.
 */
export async function imageToVideo(file: File, aspect: Aspect | "own", seconds = 10): Promise<File> {
  const { Output, BufferTarget, Mp4OutputFormat, CanvasSource } = await import("mediabunny");
  const bitmap = await createImageBitmap(file);
  // "own": במידות של התמונה עצמה (צילום מסך נשאר שלם, בלי חיתוך)
  const { width: AW, height: AH } = aspect === "own" ? { width: bitmap.width, height: bitmap.height } : ASPECT_SIZE[aspect];
  const k = 1080 / Math.max(AW, AH);
  const W = Math.round((AW * k) / 2) * 2, H = Math.round((AH * k) / 2) * 2;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const s = Math.max(W / bitmap.width, H / bitmap.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (W - bitmap.width * s) / 2, (H - bitmap.height * s) / 2, bitmap.width * s, bitmap.height * s);
  bitmap.close();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const src = new CanvasSource(canvas as unknown as HTMLCanvasElement, { codec: "avc", bitrate: 2_500_000, keyFrameInterval: 1 });
  output.addVideoTrack(src, { frameRate: 2 });
  await output.start();
  // שני פריימים בשנייה מספיקים לתמונה קבועה (קובץ קטן מאוד)
  for (let t = 0; t < seconds; t += 0.5) await src.add(t, 0.5);
  await output.finalize();
  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer!;
  return new File([buffer], file.name.replace(/\.[^.]+$/, "") + " (רקע).mp4", { type: "video/mp4" });
}
