import WorkSampleCard from '@/components/WorkSampleCard';

const VIDEO =
  'https://media.base44.com/videos/public/6ac284b25278ab1689bc08f5/294db0a32_copy_984997A7-B179-4138-B2C4-77684493E621.mov';

const GALLERY = [
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/4de7c12f9_IMG_7203.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/7ea7292bf_IMG_7207.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/7af2867fe_IMG_7206.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/f308162ae_IMG_7205.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/57cc49412_IMG_7204.png',
];

export default function WorkSample() {
  return (
    <WorkSampleCard
      badge="Plania"
      title="Plania: תכנון ארוחות לשבוע שלם"
      description="לוח שבועי עם התפריט של כל יום, אינדקס ארוחות כולל ייבוא מתכון מרילס באינסטגרם, רשימת קניות שנבנית לבד עם תקציב, ומדריך. נבנה מאפס, כולל עיצוב ומיתוג."
      highlight="כל השבוע מתוכנן מראש, ורשימת הקניות מחכה בטלפון."
      video={VIDEO}
      images={GALLERY}
    />
  );
}