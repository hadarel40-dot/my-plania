import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { buildVisit } from '@/lib/visitTracking';

// Records one visit per page view on the public site. Admins browsing the site are
// not counted, so the numbers reflect real visitors.
export default function VisitTracker() {
  const { pathname } = useLocation();
  const { user, isLoadingAuth } = useAuth();
  const lastPath = useRef(null);

  useEffect(() => {
    if (isLoadingAuth || user?.role === 'admin') return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const visit = buildVisit(pathname);
    if (!visit) return;
    base44.entities.SiteVisit.create(visit).catch(() => {});
  }, [pathname, user, isLoadingAuth]);

  return null;
}