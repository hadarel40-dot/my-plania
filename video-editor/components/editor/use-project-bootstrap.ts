"use client";
import { useEffect, useState } from "react";
import { useEditor } from "@/stores/editor-store";
import { setEngines } from "@/stores/editor-store";
import { loadProject, saveProject } from "@/lib/persistence";
import { mockProvider } from "@/lib/ai/provider";
import { createFalProvider } from "@/lib/ai/fal-provider";
import { createFalTranscriber, mockTranscriber } from "@/lib/ai/transcriber";
import type { CloudConfig } from "@/lib/ai/fal-config";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * טעינת הפרויקט השמור, שמירה אוטומטית, ובחירת מנועי ה-AI לפי המצב (דמו / ענן)
 * ולפי מה שמוגדר בשרת.
 */
export function useProjectBootstrap() {
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const aiMode = useEditor((s) => s.aiMode);
  const cloud = useEditor((s) => s.cloud);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const project = await loadProject();
      if (cancelled) return;
      if (project) {
        useEditor.getState().hydrate(project);
        useEditor.temporal.getState().clear();
      }
      setReady(true);
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
  }, []);

  useEffect(() => {
    const useCloud = aiMode === "cloud" && cloud;
    setEngines(
      useCloud && cloud.video ? createFalProvider(cloud) : mockProvider,
      useCloud && cloud.transcribe ? createFalTranscriber(cloud) : mockTranscriber,
    );
  }, [aiMode, cloud]);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.timeline === prev.timeline && s.assets === prev.assets && s.variants === prev.variants && s.title === prev.title) return;
      setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { title, timeline, assets, variants } = useEditor.getState();
        setSaveState(saveProject({ title, timeline, assets, variants }) ? "saved" : "error");
      }, 600);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [ready]);

  return { ready, saveState };
}
