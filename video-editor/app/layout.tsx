import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FONTS_CSS } from "@/lib/editor/fonts";

export const metadata: Metadata = {
  title: "AI Video Editor",
  description: "עורך וידאו בענן עם וריאציות AI",
};

const DISPOSE_POLYFILL = `(function(){try{
if(typeof Symbol.dispose!=="symbol")Object.defineProperty(Symbol,"dispose",{value:Symbol.for("Symbol.dispose"),configurable:true});
if(typeof Symbol.asyncDispose!=="symbol")Object.defineProperty(Symbol,"asyncDispose",{value:Symbol.for("Symbol.asyncDispose"),configurable:true});
}catch(e){}})();`;

/**
 * בטלפון: בלי הגדלה של כל הדף (אחרת לחיצה על שדה טקסט או לחיצה כפולה מגדילה ומזיזה את
 * התצוגה). את אזור העריכה מגדילים ומקטינים עם הידית שבין הנגן לכלים.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#110f1c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        {/* חייב לרוץ לפני כל קוד אחר: ב-iPhone (Safari) אין Symbol.dispose, וכל ספרייה של מנוע
            הייצוא השלימה אותו בשם אחר, ולכן הייצוא נכשל ב-"Object not disposable". כאן כולן מקבלות אותו סמל */}
        <script dangerouslySetInnerHTML={{ __html: DISPOSE_POLYFILL }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href={FONTS_CSS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
