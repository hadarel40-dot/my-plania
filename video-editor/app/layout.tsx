import type { Metadata } from "next";
import "./globals.css";
import { FONTS_CSS } from "@/lib/editor/fonts";

export const metadata: Metadata = {
  title: "AI Video Editor",
  description: "עורך וידאו בענן עם וריאציות AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href={FONTS_CSS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
