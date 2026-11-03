import { NEUTRAL_LOOK, type Clip, type MediaAsset, type SavedProject } from "./types";
import { uid } from "./timeline-utils";

/** פרויקט חדש מתחיל ריק: בלי סרטונים, טקסטים או סאונד */
export const initialProject = (): SavedProject & { notes: string } => ({
  title: "פרויקט חדש",
  notes: "",
  timeline: { fps: 30, aspect: "9:16", clips: [], captions: [], overlays: [], audio: [] },
  assets: {},
  variants: {},
});

/**
 * פרויקטים שנשמרו לפני שנוספו מסלולי הטקסט והסאונד: משלימים שדות חסרים,
 * כדי שפרויקט ישן ייפתח בלי שגיאות.
 */
export function normalizeProject(project: SavedProject): SavedProject {
  // סרטוני הדוגמה של גרסאות קודמות יוצאים מהספרייה, אלא אם הם עדיין בשימוש בציר הזמן
  const used = new Set(project.timeline.clips.flatMap((c) => [c.sourceAssetId, c.assetId]));
  const assets = Object.fromEntries(
    Object.entries(project.assets).filter(([id, a]) => a.origin !== "sample" || used.has(id)),
  );
  return {
    ...project,
    notes: project.notes ?? "",
    assets,
    timeline: {
      ...project.timeline,
      captions: project.timeline.captions ?? [],
      overlays: project.timeline.overlays ?? [],
      audio: project.timeline.audio ?? [],
    },
    variants: project.variants ?? {},
  };
}

export function makeClip(asset: MediaAsset, length = asset.duration): Clip {
  return {
    id: uid("clip"),
    sourceAssetId: asset.id,
    assetId: asset.id,
    in: 0,
    out: Math.min(length, asset.duration),
    look: NEUTRAL_LOOK,
    activeVariantId: null,
  };
}
