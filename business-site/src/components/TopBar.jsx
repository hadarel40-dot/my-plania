import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { services, site } from '../content';

export default function TopBar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const linkStyle = (s) => {
    const active = pathname === s.path;
    return {
      color: active ? s.color : '#2a2622',
      fontWeight: active ? 600 : 400,
      textDecoration: active ? 'underline' : 'none',
      textDecorationThickness: '2px',
      textUnderlineOffset: '4px',
    };
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 px-3 pt-3 pb-1"
    >
      <div className="relative mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px]">
        <div className="relative h-14 px-5 flex items-center justify-between rounded-full border border-[#e3d9cc] bg-[#faf6f1]/80 backdrop-blur-md shadow-[0_2px_14px_rgba(94,29,29,0.08)]">
          <Link to="/" aria-label={`${site.name}, לדף הבית`} className="flex items-center">
            <Logo className="h-8 lg:h-9 w-auto" />
          </Link>
          <nav aria-label="ניווט ראשי" className="hidden lg:flex items-center gap-8">
            {services.map((s) => (
              <Link key={s.key} to={s.path} aria-current={pathname === s.path ? 'page' : undefined} style={linkStyle(s)}>
                {s.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            aria-label={open ? 'סגירת התפריט' : 'פתיחת התפריט'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden w-11 h-11 flex items-center justify-center"
            style={{ color: site.brand }}
          >
            {open ? <X className="w-7 h-7" strokeWidth={1.75} /> : <Menu className="w-7 h-7" strokeWidth={1.75} />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="תפריט נייד" className="lg:hidden absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-3xl border border-[#e3d9cc] bg-[#faf6f1]/95 backdrop-blur-md shadow-[0_6px_24px_rgba(94,29,29,0.12)] py-2">
            {services.map((s) => (
              <Link key={s.key} to={s.path} className="block px-6 py-4" style={linkStyle(s)}>
                {s.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </motion.header>
  );
}
