import type { ReelEditKit } from "./config";

/**
 * שינויים בריל שקורים מיד, בלי עיבוד: הריל נבנה בדשבורד בזמן אמת מהערכה (קטעים וכרטיסים),
 * אז מספיק לשנות את הערכה. החלפת סרטון לוקחת קטע אחר מהספרייה (קטעים שכבר הועלו לרילס אחרים).
 */
export type ReelChange = { card: number | null; action: "replace_clip" | "edit_text" | "remove_card" | "reorder" | "timing" | "other"; detail: string };
export type Segment = ReelEditKit["segments"][number];

const starts = (segs: Segment[]) => segs.reduce<number[]>((acc, s, i) => [...acc, i ? acc[i - 1] + segs[i - 1].seconds : 0], []);

/** הקטע שהכי חופף לכרטיס */
function segmentOfCard(kit: ReelEditKit, cardIndex: number) {
  const c = kit.cards[cardIndex];
  const st = starts(kit.segments);
  let best = -1, overlap = 0;
  kit.segments.forEach((s, i) => {
    const o = Math.min(c.end, st[i] + s.seconds) - Math.max(c.start, st[i]);
    if (o > overlap) { overlap = o; best = i; }
  });
  return best;
}

export function applyReelChanges(kit: ReelEditKit, changes: ReelChange[], pool: Segment[], message: string) {
  let k: ReelEditKit = { segments: [...kit.segments], cards: kit.cards.map((c) => ({ ...c })) };
  const done: string[] = [];
  const left: ReelChange[] = [];
  const used = new Set(k.segments.map((s) => s.path));
  const cardIdx = (n: number | null) => (n == null ? -1 : Math.max(0, Math.min(k.cards.length - 1, n - 1)));

  for (const ch of changes) {
    if (ch.action === "edit_text" && ch.card != null && ch.detail.trim()) {
      const i = cardIdx(ch.card);
      k.cards[i] = { ...k.cards[i], text: ch.detail.trim(), headline: ch.detail.trim(), body: "" };
      done.push(`שיניתי את הטקסט בכרטיס ${i + 1}`);
    } else if (ch.action === "replace_clip" && ch.card != null) {
      const si = segmentOfCard(k, cardIdx(ch.card));
      const cur = k.segments[si];
      if (si < 0 || !cur) { left.push(ch); continue; }
      const vertical = cur.height >= cur.width;
      // מעדיפים קטע באותו כיוון, שלא נמצא כבר בריל, ושארוך מספיק
      const pick = pool
        .filter((p) => !used.has(p.path) && p.seconds >= cur.seconds - 0.05)
        .sort((a, b) => Number((b.height >= b.width) === vertical) - Number((a.height >= a.width) === vertical) || Math.abs(a.seconds - cur.seconds) - Math.abs(b.seconds - cur.seconds))[0];
      if (!pick) { left.push(ch); continue; }
      used.add(pick.path);
      k.segments[si] = { ...pick, seconds: Math.min(pick.seconds, cur.seconds) };
      done.push(`החלפתי את הסרטון בכרטיס ${cardIdx(ch.card) + 1}`);
    } else if (ch.action === "remove_card" && ch.card != null && k.cards.length > 1) {
      const i = cardIdx(ch.card);
      const c = k.cards[i];
      // מורידים את הכרטיס ואת הקטעים שכולם בתוכו, ומקדמים את מה שאחריו
      const st = starts(k.segments);
      const drop = new Set(k.segments.map((s, j) => (st[j] >= c.start - 0.05 && st[j] + s.seconds <= c.end + 0.05 ? j : -1)).filter((j) => j >= 0));
      const cut = [...drop].reduce((n, j) => n + k.segments[j].seconds, 0);
      k = {
        segments: k.segments.filter((_, j) => !drop.has(j)),
        cards: k.cards.filter((_, j) => j !== i).map((x) => (x.start >= c.end - 0.05 ? { ...x, start: +(x.start - cut).toFixed(2), end: +(x.end - cut).toFixed(2) } : x)),
      };
      done.push(`הורדתי את כרטיס ${i + 1}`);
    } else if (ch.action === "timing") {
      const text = `${ch.detail} ${message}`;
      const faster = /מהיר|קצר|לקצר|זריז|קצב/.test(text) && !/איטי|לאט|ארוך/.test(text);
      if (!faster) { left.push(ch); continue; }
      // קצב מהיר יותר: כל קטע מתקצר, והכרטיסים מתכווצים איתו
      const f = 0.8;
      k = {
        segments: k.segments.map((s) => ({ ...s, seconds: +(s.seconds * f).toFixed(2) })),
        cards: k.cards.map((c) => ({ ...c, start: +(c.start * f).toFixed(2), end: +(c.end * f).toFixed(2) })),
      };
      done.push("הקצב עכשיו מהיר יותר");
    } else {
      left.push(ch);
    }
  }
  return { kit: k, done, left };
}
