import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { LOGO_URL } from '@/lib/brand';

const navItems = [
  { path: '/business', label: 'לעסקים', color: '#5E1D1D' },
  { path: '/travel', label: 'טיולים', color: '#5E1D1D' },
  { path: '/plania', label: 'Plania', color: '#4A6355' },
];

export default function TopBar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 px-3 pt-3 pb-1"
    >
      <div className="relative mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px]">
        <div className="relative h-14 px-4 flex items-center justify-between rounded-full border border-[#e3d9cc] bg-[#faf6f1]/80 backdrop-blur-md shadow-[0_2px_14px_rgba(94,29,29,0.08)]">
          <Link
            to="/"
            aria-label="Plania's"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0 flex items-center shrink-0"
          >
            {/* התמונה המקורית 500x500 עם שוליים שקופים גדולים, ולכן חותכים לתוכן המשמעותי של הלוגו */}
            <span
              className="relative block h-8 lg:h-9 overflow-hidden"
              style={{ aspectRatio: '383 / 98' }}
            >
              <img
                src={LOGO_URL}
                alt=""
                className="absolute max-w-none"
                style={{ width: '130.55%', left: '-17.23%', top: '-196.94%' }}
              />
            </span>
          </Link>

          <nav aria-label="ניווט ראשי" className="hidden lg:flex items-center gap-8 text-base">
            {navItems.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="transition-colors"
                  style={{
                    color: active ? item.color : '#2a2622',
                    fontWeight: active ? 600 : 400,
                    textDecoration: active ? 'underline' : 'none',
                    textDecorationThickness: active ? '2px' : 'auto',
                    textUnderlineOffset: active ? '4px' : '0',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            aria-label={open ? 'סגירת התפריט' : 'פתיחת התפריט'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((prev) => !prev)}
            className="lg:hidden mr-auto w-11 h-11 flex items-center justify-center text-[#5E1D1D]"
          >
            {open ? <X className="w-7 h-7" strokeWidth={1.75} /> : <Menu className="w-7 h-7" strokeWidth={1.75} />}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="תפריט ניווט נייד" className="lg:hidden absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-3xl border border-[#e3d9cc] bg-[#faf6f1]/95 backdrop-blur-md shadow-[0_6px_24px_rgba(94,29,29,0.12)] py-2">
            {navItems.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="block px-6 py-4 text-base"
                  style={{
                    color: active ? item.color : '#2a2622',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </motion.header>
  );
}
