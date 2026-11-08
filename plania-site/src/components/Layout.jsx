import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TopBar from './TopBar';
import SiteFooter from './SiteFooter';
import FloatingWhatsApp from './FloatingWhatsApp';
import VisitTracker from './VisitTracker';

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f0e8df]">
      <a href="#main" className="skip-link">דלגו לתוכן הראשי</a>
      <AnimatePresence initial={false}>
        {pathname !== '/' && <TopBar key="topbar" />}
      </AnimatePresence>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <SiteFooter flush={['/', '/plania', '/travel', '/business'].includes(pathname)} />
      <FloatingWhatsApp />
      <VisitTracker />
    </div>
  );
}