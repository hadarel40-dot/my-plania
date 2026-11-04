"use client";
import type { Caption } from "./types";
import { loadMyStyle } from "./my-style";

/** המילון שלי: תיקוני מילים שהתמלול טועה בהן, שחלים אוטומטית על כל תמלול חדש */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** מחליף מילה או ביטוי בטקסט, רק כמילה שלמה (גם עם ו/ה/ב/ל/ש בתחילתה) */
export function replaceInText(text: string, from: string, to: string) {
  if (!from.trim()) return text;
  const re = new RegExp(`(^|[\\s"'(״])((?:[והבלמשכ])?)${escape(from.trim())}(?=$|[\\s.,!?:;"')״])`, "g");
  return text.replace(re, (_m, pre: string, prefix: string) => `${pre}${prefix}${to.trim()}`);
}

/** התיקונים שנשמרו ("המילון שלי") חלים על כל תמלול חדש */
export function applyDictionary(captions: Caption[]): Caption[] {
  const dict = Object.entries(loadMyStyle().dictionary ?? {});
  if (!dict.length) return captions;
  return captions.map((c) => {
    let text = c.text;
    for (const [from, to] of dict) text = replaceInText(text, from, to);
    return text === c.text ? c : { ...c, text };
  });
}

/** מילים נכונות שכדאי ש-Gemini יכיר כשהוא מתמלל (שמות, מותגים...) */
export const dictionaryHints = () => [...new Set(Object.values(loadMyStyle().dictionary ?? {}))].slice(0, 60);
