"use client";
import { Trash2 } from "lucide-react";

/** מחיקה דורשת אישור: היא מוחקת גם את הקבצים מ-Storage ואין ממנה חזרה */
export function DeleteButton({ title }: { title: string }) {
  return (
    <button
      title="מחק פרויקט"
      aria-label="מחק פרויקט"
      onClick={(e) => { if (!confirm(`למחוק את "${title}" ואת כל הקבצים שלו? אי אפשר לשחזר.`)) e.preventDefault(); }}
      className="rounded p-1 opacity-0 hover:bg-red-500/20 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
