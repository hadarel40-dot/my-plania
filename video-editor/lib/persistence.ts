import type { SavedProject } from "@/lib/editor/types";

/**
 * שמירה מקומית: ה"מתכון" ב-localStorage, וקבצי הווידאו שהועלו ב-IndexedDB.
 * כשמוגדר Supabase משתמשים במקום זה ב-lib/backend/cloud.ts.
 */

const PROJECT_KEY = "ai-video-editor:project:v1";
const DB_NAME = "ai-video-editor";
const FILES = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FILES);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(FILES, mode).objectStore(FILES));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveFile = (assetId: string, file: Blob) =>
  withStore("readwrite", (s) => s.put(file, assetId)).catch(() => undefined);

const loadFile = (assetId: string) =>
  withStore<Blob | undefined>("readonly", (s) => s.get(assetId)).catch(() => undefined);

const clearFiles = () => withStore("readwrite", (s) => s.clear()).catch(() => undefined);

/** מכין פרויקט לשמירה: בלי כתובות זמניות ובלי jobs שעדיין רצים */
export function toStorable(project: SavedProject): SavedProject {
  // כתובות blob: וכתובות חתומות לא שורדות רענון; הן נבנות מחדש בטעינה
  const assets = Object.fromEntries(Object.entries(project.assets).map(([id, a]) =>
    [id, a.url.startsWith("blob:") || a.storagePath ? { ...a, url: "" } : a]));
  // jobs שרצים בדפדפן לא ימשיכו אחרי רענון, אז לא שומרים אותם. עבודות שרת (jobId) ממשיכות
  const variants = Object.fromEntries(Object.entries(project.variants).filter(([, v]) =>
    v.status === "succeeded" || v.status === "failed" || !!v.jobId));
  return { ...project, assets, variants };
}

export function saveProject(project: SavedProject) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(toStorable(project)));
    return true;
  } catch {
    return false;
  }
}

export async function loadProject(): Promise<SavedProject | null> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PROJECT_KEY); } catch { /* חסום בדפדפן */ }
  if (!raw) return null;

  let project: SavedProject;
  try { project = JSON.parse(raw); } catch { return null; }

  for (const asset of Object.values(project.assets)) {
    if (asset.url) continue;
    const blob = await loadFile(asset.id);
    if (blob) asset.url = URL.createObjectURL(blob);
    else if (asset.remoteUrl) asset.url = asset.remoteUrl;
  }
  // נכס שהקובץ שלו אבד לא נטען; הקליפים שלו יוצגו כ"מדיה חסרה"
  project.assets = Object.fromEntries(Object.entries(project.assets).filter(([, a]) => a.url));
  return project;
}

export async function clearProject() {
  try { localStorage.removeItem(PROJECT_KEY); } catch { /* ignore */ }
  await clearFiles();
}
