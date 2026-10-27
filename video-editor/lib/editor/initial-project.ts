import { NEUTRAL_LOOK, type Clip, type MediaAsset, type SavedProject } from "./types";
import { uid } from "./timeline-utils";

const SAMPLES: MediaAsset[] = [1, 2, 3].map((n) => ({
  id: `sample_${n}`,
  name: `דוגמה ${n}.mp4`,
  url: `/samples/clip-${n}.mp4`,
  thumbnailUrl: `/samples/clip-${n}.jpg`,
  duration: 6,
  width: 720,
  height: 1280,
  origin: "sample",
}));

export const initialProject = (): SavedProject => ({
  title: "פרויקט חדש",
  timeline: {
    fps: 30,
    aspect: "9:16",
    clips: [makeClip(SAMPLES[0], 4), makeClip(SAMPLES[1], 5), makeClip(SAMPLES[2], 4)],
    captions: [],
  },
  assets: Object.fromEntries(SAMPLES.map((a) => [a.id, a])),
  variants: {},
});

export function makeClip(asset: MediaAsset, length = asset.duration): Clip {
  return {
    id: uid("clip"),
    sourceAssetId: asset.id,
    assetId: asset.id,
    in: 0,
    out: Math.min(length, asset.duration),
    look: NEUTRAL_LOOK,
    activeVariantId: null,
  };
}
