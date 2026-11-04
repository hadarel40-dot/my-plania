import "@/lib/dispose-polyfill";
import { Audio as MediaAudio, Video as MediaVideo } from "@remotion/media";
import type { MediaTags } from "./timeline-composition";

/** רכיבי המדיה המדויקים (WebCodecs): לייצוא, וגם לתצוגה המקדימה כשהדפדפן תומך */
export const MEDIA_TAGS: MediaTags = {
  mode: "media",
  Video: MediaVideo as unknown as MediaTags["Video"],
  Audio: MediaAudio as unknown as MediaTags["Audio"],
};
