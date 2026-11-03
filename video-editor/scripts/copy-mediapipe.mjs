// מעתיק את קבצי ה-wasm של MediaPipe (זיהוי פנים) ל-public, כדי שהאתר יגיש אותם בעצמו
// בלי תלות ב-CDN חיצוני. רץ אוטומטית לפני build ו-dev.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/@mediapipe/tasks-vision/wasm";
const to = "public/mediapipe";
if (!existsSync(from)) {
  console.warn("copy-mediapipe: @mediapipe/tasks-vision is not installed, skipping");
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log("copy-mediapipe: copied wasm to", to);
}
