"use client";
import { create } from "zustand";
import type { PlayerRef } from "@remotion/player";

/** מצב הניגון נפרד מהעורך: מתעדכן 30 פעם בשנייה ולא שייך להיסטוריית undo */
interface PlaybackState {
  player: PlayerRef | null;
  fps: number;
  currentTime: number;
  playing: boolean;
  setPlayer: (player: PlayerRef | null, fps: number) => void;
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  seek: (t: number) => void;
  toggle: () => void;
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  player: null,
  fps: 30,
  currentTime: 0,
  playing: false,
  setPlayer: (player, fps) => set({ player, fps }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPlaying: (playing) => set({ playing }),
  seek: (t) => {
    const { player, fps } = get();
    const time = Math.max(0, t);
    player?.seekTo(Math.round(time * fps));
    set({ currentTime: time });
  },
  toggle: () => get().player?.toggle(),
}));
