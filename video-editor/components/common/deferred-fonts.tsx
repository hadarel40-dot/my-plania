"use client";
import { useEffect } from "react";
import { loadFontCss } from "@/lib/font-css";

/** טוען קבצי גופנים אחרי שהדף מוצג */
export function DeferredFonts({ hrefs }: { hrefs: string[] }) {
  useEffect(() => { hrefs.forEach((h) => void loadFontCss(h)); }, [hrefs.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
