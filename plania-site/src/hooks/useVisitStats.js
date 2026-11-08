import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { pathLabel, visitSourceLabel } from '@/lib/visitTracking';

const DAY = 86400000;
const WINDOW_DAYS = 14;
const REFRESH_MS = 30000;
const LIVE_MINUTES = 30;

const EMPTY = {
  loading: true,
  refreshing: false,
  lastUpdated: null,
  today: { views: 0, sessions: 0, entries: 0, pagesPerSession: 0 },
  liveVisitors: 0,
  sources: [],
  recent: [],
  daily: [],
  topPaths: [],
  topEntries: [],
  topExits: [],
  totalViews: 0,
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function countBy(rows, key, labelFn = (value) => value) {
  const map = new Map();
  rows.forEach((row) => {
    const raw = key(row);
    if (!raw) return;
    map.set(raw, (map.get(raw) || 0) + 1);
  });
  return [...map.entries()]
    .map(([raw, count]) => ({ raw, label: labelFn(raw), count }))
    .sort((a, b) => b.count - a.count);
}

export default function useVisitStats() {
  const [state, setState] = useState(EMPTY);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((value) => value + 1);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, refreshing: !prev.lastUpdated }));

    (async () => {
      const todayStart = startOfToday();
      const since = new Date(todayStart.getTime() - (WINDOW_DAYS - 1) * DAY);

      const [todayPage, recentPage, totalViews] = await Promise.all([
        base44.entities.SiteVisit.filter(
          { created_date: { $gte: todayStart.toISOString() } },
          { sort: 'created_date', limit: 1000 }
        ),
        base44.entities.SiteVisit.filter(
          { created_date: { $gte: since.toISOString() } },
          { sort: 'created_date', limit: 1000 }
        ),
        base44.entities.SiteVisit.count({}),
      ]);
      if (!active) return;

      const todayRows = todayPage.items || [];
      const recentRows = recentPage.items || [];
      const now = Date.now();
      const liveSince = now - LIVE_MINUTES * 60000;
      const feedSince = now - 2 * 3600000;
      const todaySessions = new Set(todayRows.map((row) => row.session_id).filter(Boolean));

      // The last page of each session is where the visitor left the site.
      const lastBySession = new Map();
      recentRows.forEach((row) => lastBySession.set(row.session_id, row));
      const liveSessions = new Set(
        recentRows
          .filter((row) => new Date(row.created_date).getTime() >= liveSince)
          .map((row) => row.session_id)
          .filter(Boolean)
      );

      const dailyMap = new Map();
      for (let i = 0; i < WINDOW_DAYS; i += 1) {
        const date = new Date(since.getTime() + i * DAY);
        dailyMap.set(dayKey(date), 0);
      }
      recentRows.forEach((row) => {
        const key = dayKey(row.created_date);
        if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key) + 1);
      });

      setState({
        loading: false,
        refreshing: false,
        lastUpdated: now,
        today: {
          views: todayRows.length,
          sessions: todaySessions.size,
          entries: todayRows.filter((row) => row.is_entry).length,
          pagesPerSession: todaySessions.size
            ? Math.round((todayRows.length / todaySessions.size) * 10) / 10
            : 0,
        },
        liveVisitors: liveSessions.size,
        sources: countBy(recentRows.filter((row) => row.is_entry), (row) => visitSourceLabel(row)).slice(0, 6),
        recent: recentRows
          .filter((row) => new Date(row.created_date).getTime() >= feedSince)
          .slice(-6)
          .reverse()
          .map((row) => ({
            id: row.id,
            page: pathLabel(row.path),
            source: visitSourceLabel(row),
            device: row.device === 'mobile' ? 'מהטלפון' : 'מהמחשב',
            at: row.created_date,
          })),
        daily: [...dailyMap.entries()].map(([key, count]) => {
          const [, month, day] = key.split('-');
          return { label: `${day}/${month}`, count };
        }),
        topPaths: countBy(recentRows, (row) => row.path, pathLabel).slice(0, 6),
        topEntries: countBy(recentRows.filter((row) => row.is_entry), (row) => row.path, pathLabel).slice(0, 5),
        topExits: countBy([...lastBySession.values()], (row) => row.path, pathLabel).slice(0, 5),
        totalViews,
      });
    })();

    return () => {
      active = false;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { ...state, refresh };
}