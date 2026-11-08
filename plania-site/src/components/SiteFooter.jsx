import { Instagram, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { waLink } from '@/lib/products';
import WhatsAppIcon from './icons/WhatsAppIcon';
import { LOGO_URL } from '@/lib/brand';

export default function SiteFooter({ flush = false }) {
  return (
    <footer className={`${flush ? 'mt-0' : 'mt-12'} pt-10 pb-28 lg:pb-12 snap-end border-t-[6px] border-[#5E1D1D] text-[#5E1D1D]`}>
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://www.instagram.com/hadarelifergan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 border-[#5E1D1D] text-[#5E1D1D] font-bold text-sm transition-colors hover:bg-[#5E1D1D] hover:text-[#f0e8df]"
          >
            <Instagram className="w-4 h-4" />
            אינסטגרם
          </a>
          <a
            href={waLink('היי הדראל, יש לי שאלה')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 border-[#5E1D1D] text-[#5E1D1D] font-bold text-sm transition-colors hover:bg-[#5E1D1D] hover:text-[#f0e8df]"
          >
            <WhatsAppIcon className="w-4 h-4" />
            וואטסאפ
          </a>
        </div>
        <nav aria-label="מידע משפטי" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-0 text-xs text-[#5E1D1D]/80">
          <Link to="/privacy" className="py-3 underline-offset-4 hover:underline">מדיניות פרטיות</Link>
          <Link to="/terms" className="py-3 underline-offset-4 hover:underline">תנאי שימוש</Link>
          <Link to="/accessibility" className="py-3 underline-offset-4 hover:underline">הצהרת נגישות</Link>
        </nav>
        <div className="flex items-center justify-center gap-2 text-xs text-[#5E1D1D]/65">
          <span>נבנה על ידי</span>
          <span
            role="img"
            aria-label="PLANIA'S"
            className="relative block h-6 overflow-hidden"
            style={{ aspectRatio: '383 / 98' }}
          >
            <img
              src={LOGO_URL}
              alt=""
              className="absolute max-w-none"
              style={{ width: '130.55%', left: '-17.23%', top: '-196.94%' }}
            />
          </span>
        </div>
        <Link
          to="/hp-manage-7k2x"
          aria-label="כניסה לניהול"
          title="כניסה לניהול"
          className="p-3 -mt-2 text-[#5E1D1D]/25 transition-colors hover:text-[#5E1D1D]/70"
        >
          <Lock className="w-3 h-3" strokeWidth={1.5} />
        </Link>
      </div>
    </footer>
  );
}