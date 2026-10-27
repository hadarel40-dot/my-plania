"use client";
import type { ProjectBackend } from "./types";
import { localBackend } from "./local";

let current: ProjectBackend = localBackend;

/** ה-backend הפעיל. העורך קובע אותו כשהוא עולה, ושאר הקוד קורא ממנו */
export const getBackend = () => current;
export const setBackend = (backend: ProjectBackend) => { current = backend; };

export type { ProjectBackend };
