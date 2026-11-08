import WorkSampleCard from '@/components/WorkSampleCard';
import SiteWorkSample from './SiteWorkSample';

const GALLERY = [
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/0198fa805_IMG_7198.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/c3da8a57a_IMG_7202.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/53befd7ec_IMG_7199.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/d24bc06e5_IMG_7200.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/8b15d7c22_IMG_7201.png',
  'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/a88753303_IMG_7197.png',
];

export default function WorkSample() {
  return (
    <>
    <WorkSampleCard
      badge="אפליקציה"
      title="אפליקציה למאמנת תהליכי הרזיה"
      description="אזור אישי ללקוחות עם התוכנית השבועית, שיעורים, מתכונים מסוננים לפי העדפות, צ׳אט עם המאמנת, מעקב התקדמות ומנוי. הכול מעוצב במיתוג ובצבעים של העסק."
      highlight="הלקוחות מקבלות הכול במקום אחד, בלי לחפש בין הודעות בוואטסאפ."
      images={GALLERY}
    />
    <SiteWorkSample />
    </>
  );
}