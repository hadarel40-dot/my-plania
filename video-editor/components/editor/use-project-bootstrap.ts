"use client";
import { useEffect, useState } from "react";
import { useEditor } from "@/stores/editor-store";
import { setEngines } from "@/stores/editor-store";
import { setBackend, type ProjectBackend } from "@/lib/backend";
import { mockProvider } from "@/lib/ai/provider";
import { createFalProvider } from "@/lib/ai/fal-provider";
import { createServerJobsProvider } from "@/lib/ai/server-provider";
import { createFalTranscriber, mockTranscriber } from "@/lib/ai/transcriber";
import type { CloudConfig } from "@/lib/ai/fal-config";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * טעינת הפרויקט השמור, שמירה אוטומטית, ובחירת מנועי ה-AI לפי המצב (דמו / ענן)
 * ולפי מה שמוגדר בשרת.
 */
export function useProjectBootstrap(backend: ProjectBackend) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const aiMode = useEditor((s) => s.aiMode);
  const cloud = useEditor((s) => s.cloud);

  useEffect(() => {
    let cancelled = false;
    setBackend(backend);
    (async () => {
      try {
        const project = await backend.load();
        if (cancelled) return;
        if (project) useEditor.getState().hydrate(project);
        else useEditor.getState().newProject();
        useEditor.temporal.getState().clear();
        setReady(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "טעינת הפרויקט נכשלה");
      }
    })();
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: CloudConfig | null) => {
        if (cancelled || !c) return;
        useEditor.getState().setCloud(c);
        // אם הענן מוגדר, מתחילים בו
        if (c.video || c.transcribe) useEditor.getState().setAiMode("cloud");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [backend]);

  useEffect(() => {
    const useCloud = aiMode === "cloud" && cloud;
    // פרויקט בענן: וריאציות רצות כעבודות שרת. מקומי: הדפדפן קורא ל-fal דרך ה-proxy
    const videoProvider = !(useCloud && cloud.video)
      ? mockProvider
      : backend.projectId ? createServerJobsProvider(backend.projectId) : createFalProvider(cloud);
    setEngines(videoProvider, useCloud && cloud.transcribe ? createFalTranscriber(cloud) : mockTranscriber);
  }, [aiMode, cloud, backend]);

  // עבודות שרת שהתחילו בביקור קודם ממשיכות מכאן. לא תלוי במתג דמו/ענן: העבודה כבר שולמה
  useEffect(() => {
    if (!ready || !backend.projectId) return;
    useEditor.getState().resumePendingVariants(createServerJobsProvider(backend.projectId));
  }, [ready, backend]);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    const flush = async () => {
      clearTimeout(timer);
      if (!dirty) return;
      dirty = false;
      const { title, timeline, assets, variants } = useEditor.getState();
      const ok = await backend.save({ title, timeline, assets, variants }).catch(() => false);
      setSaveState(ok ? "saved" : "error");
    };
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.timeline === prev.timeline && s.assets === prev.assets && s.variants === prev.variants && s.title === prev.title) return;
      dirty = true;
      setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(flush, backend.kind === "cloud" ? 1200 : 600);
    });
    // יציאה מהעורך (מעבר לרשימת הפרויקטים / סגירת הלשונית) שומרת מיד את מה שעוד לא נשמר
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [ready, backend]);

  return { ready, loadError, saveState };
}
