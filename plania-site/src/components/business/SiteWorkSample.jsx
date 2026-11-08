import PhoneVideo from '@/components/travel/PhoneVideo';
import PhoneCarousel from '@/components/PhoneCarousel';
import MockupStage from '@/components/MockupStage';

// The uploaded videos, in this order: home page, kitchen 3D view, gallery.
const VIDEOS = [
  'https://base44.app/api/apps/6ac284b25278ab1689bc08f5/files/mp/public/6ac284b25278ab1689bc08f5/a7b7991c0_173303cb8_RPReplay_Final1793904327.mov',
  'https://base44.app/api/apps/6ac284b25278ab1689bc08f5/files/mp/public/6ac284b25278ab1689bc08f5/c70b7efdf_7d8706c25_RPReplay_Final1793904327.mov',
  'https://base44.app/api/apps/6ac284b25278ab1689bc08f5/files/mp/public/6ac284b25278ab1689bc08f5/2d5670a09_a2e5dd596_RPReplay_Final1793904327.mov',
];
const LABELS = ['עמוד הבית', 'תצוגת מטבח תלת־ממדית', 'גלריית עבודות'];

export default function SiteWorkSample() {
  if (VIDEOS.length === 0) return null;

  return (
    <div className="relative bg-[#faf6f1] border border-[#e0d6c8] p-5 pt-7 lg:p-8 lg:pt-10 mt-6 shadow-[0_22px_44px_-28px_rgba(94,29,29,0.5)]">
      <span aria-hidden className="absolute inset-[6px] border border-[#5E1D1D]/10 pointer-events-none" />
      <span className="absolute top-0 left-0 bg-[#B5848E] text-[#5E1D1D] text-xs font-bold px-3 py-1.5">
        אתר
      </span>

      <h3 className="font-heading text-xl text-[#5E1D1D] mt-2">אתר לנגר: סדנה קטנה, עבודה לבד</h3>
      <p className="text-[#2a2622] text-sm leading-relaxed mt-2">
        אתר תדמית לנגר עם עמוד בית, גלריית עבודות ותצוגה תלת־ממדית של מטבח שאפשר לסובב עם האצבע. מעוצב במיתוג ובצבעים של העסק.
      </p>

      <MockupStage className="mt-5">
        <PhoneCarousel
          items={VIDEOS}
          width={190}
          step={108}
          renderPhone={(src) => <PhoneVideo src={`${src}#t=0.1`} className="w-[190px]" />}
          caption={(index) => `${LABELS[index] || ''} · לחצו על הצדדים או החליקו לצפייה בשאר`}
        />
      </MockupStage>
    </div>
  );
}
