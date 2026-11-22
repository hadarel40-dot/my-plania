"use client";
import { useEffect, useState } from "react";
import { canShareFiles } from "@/lib/studio/share";

/** ההסבר ליד "לשלוח לאינסטגרם": בטלפון נפתח חלון השיתוף, במחשב הקבצים יורדים */
export function ShareHint() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => { setPhone(canShareFiles()); }, []);
  if (phone === null) return null;
  return (
    <p className="mt-2 text-[12px] text-[#6F675C]">
      {phone
        ? "נפתח חלון השיתוף. בוחרים אינסטגרם, מוסיפים מוזיקה, מדביקים את הכיתוב (כבר הועתק) ושומרים כטיוטה או מפרסמים."
        : "במחשב הקבצים יורדים. כדי לשלוח ישר לאינסטגרם, פותחים את הסטודיו בטלפון."}
    </p>
  );
}
