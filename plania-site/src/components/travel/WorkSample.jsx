import WorkSampleCard from '@/components/WorkSampleCard';

const SAMPLE_VIDEO =
  'https://media.base44.com/videos/public/6ac284b25278ab1689bc08f5/727272b77_ScreenRecording_10-18-202600-42-01_1.mov';

export default function WorkSample() {
  return (
    <WorkSampleCard
      badge="מסלול פרימיום"
      title="ניו יורק: מסלול ל־9 ימים"
      description="ביקור באוהל, מנהטן, שבת בקייפ מיי וקניות. כל יום מתוכנן עד הפרט האחרון, עם קישורים מוטמעים ללינה, מסעדות כשרות ואטרקציות."
      highlight="מוצר פרימיום: כולל קישורים מוטמעים לכל הזמנה ופירוט מלא של כל יום."
      video={SAMPLE_VIDEO}
    />
  );
}