import type { Look } from "./types";

/** סגנונות צבע לקליפ. עוצמה 0..1, כאשר 0 הוא המקור */
export interface ClipStyle {
  id: string;
  label: string;
  look: (strength: number) => Look;
}

const lerp = (a: number, b: number, t: number) => +(a + (b - a) * t).toFixed(3);
const make = (filter: string): Look => ({ filter, zoom: 1, flip: false });

export const CLIP_STYLES: ClipStyle[] = [
  { id: "none", label: "מקורי", look: () => make("none") },
  { id: "cinematic", label: "קולנועי", look: (s) => make(`contrast(${lerp(1, 1.25, s)}) saturate(${lerp(1, 0.8, s)}) sepia(${lerp(0, 0.25, s)}) hue-rotate(${lerp(0, -10, s)}deg)`) },
  { id: "vivid", label: "צבעוני", look: (s) => make(`saturate(${lerp(1, 1.7, s)}) contrast(${lerp(1, 1.1, s)})`) },
  { id: "warm", label: "חם", look: (s) => make(`sepia(${lerp(0, 0.35, s)}) saturate(${lerp(1, 1.3, s)}) hue-rotate(${lerp(0, -12, s)}deg)`) },
  { id: "cold", label: "קר", look: (s) => make(`saturate(${lerp(1, 0.9, s)}) hue-rotate(${lerp(0, 20, s)}deg) brightness(${lerp(1, 1.05, s)})`) },
  { id: "vintage", label: "וינטג'", look: (s) => make(`sepia(${lerp(0, 0.6, s)}) contrast(${lerp(1, 0.85, s)}) brightness(${lerp(1, 0.95, s)})`) },
  { id: "matte", label: "מט", look: (s) => make(`contrast(${lerp(1, 0.8, s)}) brightness(${lerp(1, 1.08, s)}) saturate(${lerp(1, 0.85, s)})`) },
  { id: "bw", label: "שחור-לבן", look: (s) => make(`grayscale(${lerp(0, 1, s)}) contrast(${lerp(1, 1.2, s)})`) },
  { id: "noir", label: "נואר", look: (s) => make(`grayscale(${lerp(0, 1, s)}) contrast(${lerp(1, 1.6, s)}) brightness(${lerp(1, 0.85, s)})`) },
];

/** מזהה את הסגנון והעוצמה מתוך ה-look השמור, כדי שהממשק יציג את הבחירה הנוכחית */
export function detectStyle(look: Look): { id: string; strength: number } {
  if (!look.filter || look.filter === "none") return { id: "none", strength: 0.7 };
  for (const style of CLIP_STYLES.slice(1)) {
    for (let i = 1; i <= 20; i++) {
      if (style.look(i / 20).filter === look.filter) return { id: style.id, strength: i / 20 };
    }
  }
  return { id: "custom", strength: 0.7 };
}
