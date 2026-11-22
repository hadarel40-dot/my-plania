import type { MediaAsset } from "@/lib/editor/types";
/** בגרסה של Base44 אין שמירת מקור בטלפון: מייצאים מהקבצים כמו שהם */
export async function withOriginals(assets: Record<string, MediaAsset>) {
  return { assets, release: () => {} };
}
