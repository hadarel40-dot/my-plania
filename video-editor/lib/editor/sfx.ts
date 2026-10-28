import type { MediaAsset } from "./types";

/** ספריית אפקטי הסאונד המובנית (נוצרת ע"י scripts/make-sfx.sh, בלי זכויות יוצרים) */
export const SFX_LIBRARY = [
  { id: "pop", label: "פופ", emoji: "🫧", duration: 0.18 },
  { id: "whoosh", label: "ווש", emoji: "💨", duration: 0.63 },
  { id: "swipe", label: "החלקה", emoji: "👆", duration: 0.44 },
  { id: "click", label: "קליק", emoji: "🖱️", duration: 0.08 },
  { id: "ding", label: "דינג", emoji: "🔔", duration: 1.23 },
  { id: "notify", label: "התראה", emoji: "📱", duration: 0.73 },
  { id: "success", label: "הצלחה", emoji: "✅", duration: 1.04 },
  { id: "riser", label: "מתח עולה", emoji: "📈", duration: 1.15 },
  { id: "boom", label: "בום", emoji: "💥", duration: 1.04 },
  { id: "typing", label: "הקלדה", emoji: "⌨️", duration: 1.23 },
] as const;

export type SfxId = (typeof SFX_LIBRARY)[number]["id"];

/** נכס שמע עבור אפקט מהספרייה. המזהה קבוע, כך שכל שימוש חוזר מצביע על אותו נכס */
export function sfxAsset(id: SfxId): MediaAsset {
  const sfx = SFX_LIBRARY.find((s) => s.id === id)!;
  return {
    id: `sfx_${id}`,
    name: `${sfx.emoji} ${sfx.label}`,
    url: `/sfx/${id}.mp3`,
    thumbnailUrl: null,
    duration: sfx.duration,
    width: 0,
    height: 0,
    origin: "library",
    kind: "audio",
  };
}
