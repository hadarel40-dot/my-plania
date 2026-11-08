import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Image } from '@/components/ui/image';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import PhoneTour from '@/components/travel/PhoneTour';
import PhoneVideo from '@/components/travel/PhoneVideo';
import MockupStage from '@/components/MockupStage';

export default function WorkSampleCard({ badge, title, description, highlight, video, images }) {
  const [openIndex, setOpenIndex] = useState(null);

  const step = (dir) => setOpenIndex((i) => (i + dir + images.length) % images.length);

  return (
    <div className="relative bg-[#faf6f1] border border-[#e0d6c8] p-5 pt-7 lg:p-8 lg:pt-10 shadow-[0_22px_44px_-28px_rgba(94,29,29,0.5)]">
      <span aria-hidden className="absolute inset-[6px] border border-[#5E1D1D]/10 pointer-events-none" />
      {badge && (
        <span className="absolute top-0 left-0 bg-[#B5848E] text-[#5E1D1D] text-xs font-bold px-3 py-1.5">
          {badge}
        </span>
      )}

      <h3 className="font-heading text-xl text-[#5E1D1D] mt-2">{title}</h3>
      <p className="text-[#2a2622] text-sm leading-relaxed mt-2">{description}</p>
      {highlight && (
        <p className="text-[#5E1D1D] text-sm font-bold leading-relaxed mt-2">{highlight}</p>
      )}

      {video && (
        <MockupStage className="mt-5">
          <div className="flex flex-col items-center px-3 py-8">
            <PhoneVideo src={video} className="w-[230px]" />
            <p className="text-center text-xs text-[#f0e8df]/75 mt-4">
              סרטון הדגמה · איך זה עובד בפועל
            </p>
          </div>
        </MockupStage>
      )}

      {images && images.length > 0 && (
        <MockupStage className="mt-5">
          <PhoneTour images={images} onOpen={setOpenIndex} />
        </MockupStage>
      )}

      {openIndex !== null && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
...
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 left-4 text-white"
            aria-label="סגירה"
          >
            <X className="w-7 h-7" />
          </button>

          <button
            type="button"
            onClick={() => step(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white z-10"
            aria-label="הקודם"
          >
            <ChevronRight className="w-9 h-9" />
          </button>

          <div className="h-[84vh] w-[88vw] max-w-[860px] my-auto">
            <Image
              src={images[openIndex]}
              alt={`צילום מסך ${openIndex + 1}`}
              className="h-full w-full shadow-[0_30px_90px_rgba(0,0,0,0.95)] ring-1 ring-white/15"
              fittingType="fit"
            />
          </div>

          <button
            type="button"
            onClick={() => step(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white z-10"
            aria-label="הבא"
          >
            <ChevronLeft className="w-9 h-9" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}