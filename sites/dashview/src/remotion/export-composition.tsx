import "@/lib/dispose-polyfill";
import { MediaTagsContext, TimelineComposition, type CompositionProps } from "./timeline-composition";
import { MEDIA_TAGS as EXPORT_TAGS } from "./media-tags";

/** הקומפוזיציה לייצוא: אותה כמו בנגן, עם רכיבי מדיה שמתאימים לרינדור בתוך הדפדפן */
export function ExportComposition(props: CompositionProps) {
  return (
    <MediaTagsContext.Provider value={EXPORT_TAGS}>
      <TimelineComposition {...props} />
    </MediaTagsContext.Provider>
  );
}
