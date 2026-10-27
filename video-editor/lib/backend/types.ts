import type { MediaAsset, SavedProject } from "@/lib/editor/types";

/** איפה הפרויקט והקבצים נשמרים: בדפדפן (local) או ב-Supabase (cloud) */
export interface ProjectBackend {
  kind: "local" | "cloud";
  load(): Promise<SavedProject | null>;
  save(project: SavedProject): Promise<boolean>;
  /** שומר קובץ שהועלה. מחזיר שדות להוספה לנכס (למשל storagePath) */
  storeFile(assetId: string, file: File, onProgress?: (percent: number) => void): Promise<Partial<MediaAsset>>;
  /** כתובת שמודל בענן יכול לקרוא, או null כדי שהקובץ יעלה ל-fal */
  remoteUrlFor(asset: MediaAsset): Promise<string | null>;
}
