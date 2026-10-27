import type { Look } from "@/lib/editor/types";

export interface StylePreset {
  id: string;
  label: string;
  /** מתאר את הסגנון למודל אמיתי (מצורף ל-prompt) */
  promptHint: string;
  /** קירוב ויזואלי לדמו: CSS filter לפי עוצמה 0..1 ו-seed */
  mockLook: (strength: number, seed: number) => Look;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** מספר פסאודו-אקראי יציב מתוך seed, בטווח 0..1 */
const rand = (seed: number, salt: number) => {
  const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "cinematic",
    label: "קולנועי",
    promptHint: "cinematic teal and orange grade, anamorphic look",
    mockLook: (s, seed) => ({
      filter: `contrast(${lerp(1, 1.3, s)}) saturate(${lerp(1, 0.75, s)}) sepia(${lerp(0, 0.35, s)}) hue-rotate(${Math.round(lerp(-25, 25, rand(seed, 1)))}deg)`,
      zoom: lerp(1, 1.35, rand(seed, 2)),
      flip: false,
    }),
  },
  {
    id: "anime",
    label: "אנימה",
    promptHint: "anime style, cel shading, vibrant colors",
    mockLook: (s, seed) => ({
      filter: `saturate(${lerp(1, 2, s)}) contrast(${lerp(1, 1.2, s)}) brightness(${lerp(1, 1.1, s)}) hue-rotate(${Math.round(lerp(0, 25, rand(seed, 1)))}deg)`,
      zoom: 1,
      flip: rand(seed, 3) > 0.7,
    }),
  },
  {
    id: "vintage",
    label: "וינטג' 16mm",
    promptHint: "vintage 16mm film, grain, faded colors",
    mockLook: (s, seed) => ({
      filter: `sepia(${lerp(0, 0.7, s)}) contrast(${lerp(1, 0.85, s)}) brightness(${lerp(1, 0.92, s)}) blur(${(lerp(0, 0.6, s) * rand(seed, 1)).toFixed(2)}px)`,
      zoom: lerp(1, 1.06, rand(seed, 2)),
      flip: false,
    }),
  },
  {
    id: "neon",
    label: "ניאון",
    promptHint: "neon cyberpunk lighting, magenta and cyan glow",
    mockLook: (s, seed) => ({
      filter: `hue-rotate(${Math.round(lerp(120, 300, rand(seed, 1)))}deg) saturate(${lerp(1, 2.5, s)}) contrast(${lerp(1, 1.25, s)})`,
      zoom: lerp(1, 1.08, rand(seed, 2)),
      flip: false,
    }),
  },
  {
    id: "noir",
    label: "שחור-לבן",
    promptHint: "film noir, high contrast black and white",
    mockLook: (s, seed) => ({
      filter: `grayscale(${lerp(0.3, 1, s)}) contrast(${lerp(1, 1.5, s)}) brightness(${lerp(1, 0.9, rand(seed, 1))})`,
      zoom: lerp(1, 1.15, s * rand(seed, 2)),
      flip: false,
    }),
  },
];

export const styleById = (id: string) =>
  STYLE_PRESETS.find((s) => s.id === id) ?? STYLE_PRESETS[0];

/** הערכת עלות בספק אמיתי, לתצוגה לפני הרצה */
export const estimateCostUsd = (count: number, seconds: number) =>
  +(count * Math.max(1, seconds) * 0.08).toFixed(2);
