"use client";
import { loadProject, saveFile, saveProject } from "@/lib/persistence";
import type { ProjectBackend } from "./types";

/** שמירה בדפדפן בלבד: localStorage לפרויקט, IndexedDB לקבצים */
export const localBackend: ProjectBackend = {
  kind: "local",
  load: loadProject,
  save: async (project) => saveProject(project),
  storeFile: async (assetId, file, onProgress) => {
    await saveFile(assetId, file);
    onProgress?.(100);
    return {};
  },
  remoteUrlFor: async () => null,
};
