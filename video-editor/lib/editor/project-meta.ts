import type { Aspect, SavedProject } from "./types";
import { timelineDuration } from "./timeline-utils";

/** מה שלוח הפרויקטים מציג על כל כרטיס */
export interface ProjectMeta {
  thumbnail: string | null;
  clipCount: number;
  duration: number;
  aspect: Aspect;
  captionCount: number;
  variantCount: number;
}

/**
 * תמונה ממוזערת: של הקליפ הראשון בציר הזמן. נשמרת רק אם היא כתובת קבועה
 * (קובץ סטטי או data URL קטן), לא כתובת חתומה שתפוג.
 */
export function computeMeta(project: SavedProject): ProjectMeta {
  const first = project.timeline.clips[0];
  const thumb = first ? project.assets[first.sourceAssetId]?.thumbnailUrl ?? null : null;
  const stable = thumb && (thumb.startsWith("data:") || thumb.startsWith("/")) ? thumb : null;
  return {
    thumbnail: stable,
    clipCount: project.timeline.clips.length,
    duration: Math.round(timelineDuration(project.timeline) * 10) / 10,
    aspect: project.timeline.aspect,
    captionCount: project.timeline.captions.length,
    variantCount: Object.values(project.variants).filter((v) => v.status === "succeeded").length,
  };
}
