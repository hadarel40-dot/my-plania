import { Audio as MediaAudio, Video as MediaVideo } from "@remotion/media";
import { MediaTagsContext, TimelineComposition, type CompositionProps, type MediaTags } from "./timeline-composition";

const EXPORT_TAGS: MediaTags = {
  mode: "media",
  Video: MediaVideo as unknown as MediaTags["Video"],
  Audio: MediaAudio as unknown as MediaTags["Audio"],
};

/** הקומפוזיציה לייצוא: אותה כמו בנגן, עם רכיבי מדיה שמתאימים לרינדור בתוך הדפדפן */
export function ExportComposition(props: CompositionProps) {
  return (
    <MediaTagsContext.Provider value={EXPORT_TAGS}>
      <TimelineComposition {...props} />
    </MediaTagsContext.Provider>
  );
}
