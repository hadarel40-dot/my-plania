"use client";
import { useEffect, useState } from "react";
import { SAFE, type ScreenCard } from "@/lib/studio/config";

/** מסגרת 1080x1920 מוקטנת, עם האזור הבטוח של אינסטגרם והכרטיסים איפה שהם יעמדו */
export function SafeZonePreview({ cards, width = 180 }: { cards: ScreenCard[]; width?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (cards.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % cards.length), 1800);
    return () => clearInterval(t);
  }, [cards.length]);
  const s = width / SAFE.width;
  const card = cards[i % Math.max(1, cards.length)];
  return (
    <figure>
      <div className="relative overflow-hidden border border-[#2A2622]/40 bg-[#2A2622]/90" style={{ width, height: SAFE.height * s }} dir="ltr">
        <div className="absolute border border-dashed border-[#F4EEE4]/60" style={{ left: 0, top: SAFE.top * s, width: (SAFE.width - SAFE.right) * s, height: (SAFE.bottom - SAFE.top) * s }} />
        <div className="absolute bg-[#F4EEE4]/15" style={{ right: 0, top: 0, width: SAFE.right * s, height: SAFE.height * s }} />
        <div className="absolute bg-[#F4EEE4]/15" style={{ left: 0, top: SAFE.bottom * s, width: SAFE.width * s, height: (SAFE.height - SAFE.bottom) * s }} />
        {card && (
          <div dir="rtl" className="s-serif absolute flex items-center justify-center bg-[#F4EEE4] px-1 text-center leading-tight text-[#1F1B16]"
            style={{ left: SAFE.cardX * s, top: card.y * s, width: SAFE.cardW * s, minHeight: 90 * s, fontSize: Math.max(9, 64 * s) }}>
            {card.text}
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-[10px] text-[#6F675C]">המקווקו הוא האזור הבטוח. האזורים הבהירים מוסתרים על ידי הממשק של אינסטגרם.</figcaption>
    </figure>
  );
}
