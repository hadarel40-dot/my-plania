"use client";
import { useEffect, useState } from "react";
import { HardDrive, Loader2, X } from "lucide-react";
import { useUploads } from "@/stores/upload-store";

interface DriveFile { id: string; name: string; size?: string; mimeType: string; videoMediaMetadata?: { durationMillis?: string } }

const mb = (b?: string | number) => `${Math.round((Number(b) || 0) / 1048576)}MB`;
const folderId = (link: string) => link.match(/folders\/([\w-]+)/)?.[1] ?? link.match(/[?&]id=([\w-]+)/)?.[1] ?? link.trim();

async function getToken(): Promise<string | null> {
  const res = await fetch("/api/studio/drive", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.configured ? data.token : null;
}

/**
 * ייבוא מדרייב (למנהלת, כשמוגדר חשבון שירות): הקובץ יורד מדרייב ישר לדפדפן, ונכנס לתור ההעלאה
 * הרגיל של העורך, כמו קובץ מהמכשיר: אותו כיווץ, אותה תצוגה, והמקור באיכות מלאה לייצוא.
 */
export function DriveImport() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getToken().then((t) => setAvailable(!!t)).catch(() => setAvailable(false));
    try { setLink(localStorage.getItem("drive-folder") ?? ""); } catch { /* מצב פרטי */ }
  }, []);
  if (!available) return null;

  const list = async () => {
    setBusy("list"); setError("");
    try {
      try { localStorage.setItem("drive-folder", link); } catch { /* מצב פרטי */ }
      const token = await getToken();
      if (!token) throw new Error("דרייב לא מחובר");
      const id = folderId(link);
      const q = ["trashed = false", "mimeType contains 'video/'", id ? `'${id.replace(/'/g, "")}' in parents` : ""].filter(Boolean).join(" and ");
      const params = new URLSearchParams({ q, pageSize: "100", orderBy: "modifiedTime desc", fields: "files(id,name,size,mimeType,videoMediaMetadata)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "דרייב לא החזיר קבצים");
      setFiles(body.files ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const take = async (f: DriveFile) => {
    setBusy(f.id); setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("דרייב לא מחובר");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`ההורדה מדרייב נכשלה (${res.status})`);
      const blob = await res.blob();
      useUploads.getState().enqueue([new File([blob], f.name, { type: f.mimeType || blob.type })]);
      setFiles((all) => all?.filter((x) => x.id !== f.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
        <HardDrive className="size-3.5" /> דרייב
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">ייבוא מדרייב</h3>
              <button type="button" aria-label="סגירה" onClick={() => setOpen(false)}><X className="size-4" /></button>
            </div>
            <input dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="קישור לתיקייה בדרייב (או ריק)"
              className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" />
            <button type="button" onClick={list} disabled={busy === "list"} className="mb-3 w-full rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
              {busy === "list" ? "טוענת..." : "להציג סרטונים"}
            </button>
            <p className="mb-2 text-[11px] text-zinc-400">הקובץ יורד מדרייב לדפדפן ואז עולה לפרויקט כמו קובץ מהטלפון. קבצים מעל 100MB לוקחים זמן, לפי מהירות האינטרנט.</p>
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            <ul className="space-y-1">
              {files?.length === 0 && <li className="text-xs text-zinc-400">אין סרטונים בתיקייה, או שהיא לא שותפה עם חשבון השירות.</li>}
              {files?.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{f.name} <span className="text-zinc-500">{mb(f.size)}</span></span>
                  <button type="button" onClick={() => take(f)} disabled={!!busy} className="shrink-0 rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700 disabled:opacity-50">
                    {busy === f.id ? <Loader2 className="size-3.5 animate-spin" /> : "להוסיף"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
