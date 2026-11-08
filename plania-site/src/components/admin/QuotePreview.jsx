import { Image } from '@/components/ui/image';

const LOGO = 'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/69c9d343d_logo.png';
const WHATSAPP_URL = 'https://wa.me/972539306048';

export default function QuotePreview({ name, price, deposit, delivery, brief }) {
  return (
    <div dir="rtl" className="bg-[#f0e8df] p-4">
      <div className="bg-[#faf6f1] border border-[#e5e7eb]">
        <div className="bg-[#5E1D1D] text-white px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-heading text-lg">Plania’s</p>
            <p className="text-[11px] text-[#f0d9d9]">תכנון חכם לבית, לטיולים ולעסקים</p>
          </div>
          <Image src={LOGO} alt="Plania’s" className="w-16 h-16" fittingType="fit" />
        </div>

        <div className="px-5 py-5">
          <p className="font-heading text-xl text-[#5E1D1D]">הצעת מחיר, {name || 'שלום'}</p>
          <p className="text-xs text-[#6a6158] mt-1 leading-relaxed">
            הנה סיכום ההצעה והבריף. אפשר לאשר בלחיצה על הכפתור בסוף המייל.
          </p>

          <div className="mt-4 bg-[#f0e8df] px-4 py-4">
            <p className="text-[11px] text-[#6a6158]">מחיר</p>
            <p className="font-heading text-3xl text-[#5E1D1D]">{price}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <p className="text-[11px] text-[#6a6158]">מקדמה</p>
              <p className="font-heading text-lg">{deposit}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#6a6158]">זמן אספקה</p>
              <p className="font-heading text-lg">{delivery}</p>
            </div>
          </div>

          <p className="text-sm font-bold text-[#5E1D1D] mt-5 mb-2">הבריף</p>
          <div className="bg-[#f0e8df] px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
            {brief}
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-[#5E1D1D] mb-3">העבודה מתחילה רק אחרי אישור ההצעה ותשלום המקדמה.</p>
            <span className="inline-block bg-[#5E1D1D] text-white text-sm font-bold px-6 py-3">
              לצפייה ואישור ההצעה
            </span>
            <p className="text-[11px] text-[#6a6158] mt-2">
              שאלות?{' '}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                אפשר לכתוב לי בוואטסאפ
              </a>
            </p>
          </div>
        </div>

        <div className="bg-[#5E1D1D] text-white px-5 py-4">
          <p className="text-sm font-bold">הדראל איפרגן</p>
          <p className="text-xs text-[#f0d9d9] mt-1">053-9306048 · planiasmartplan@gmail.com</p>
          <p className="text-xs text-[#f0d9d9] mt-1">hadarelifergan.com</p>
        </div>
      </div>
    </div>
  );
}