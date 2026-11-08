import useVisitStats from '@/hooks/useVisitStats';
import LiveStrip from './dashboard/LiveStrip';
import VisitStats from './dashboard/VisitStats';
import SourceList from './dashboard/SourceList';
import LiveVisits from './dashboard/LiveVisits';
import VisitsChart from './dashboard/VisitsChart';
import PathList from './dashboard/PathList';
import RecentActivity from './dashboard/RecentActivity';

export default function DashboardTab({ data }) {
  const {
    loading,
    refreshing,
    lastUpdated,
    today,
    liveVisitors,
    sources,
    recent,
    daily,
    topPaths,
    topEntries,
    topExits,
    totalViews,
    refresh,
  } = useVisitStats();

  if (loading) {
    return <p className="text-center text-sm text-[#6a6158] py-10">טוען נתוני פעילות...</p>;
  }

  return (
    <div className="space-y-4">
      <LiveStrip
        visitors={liveVisitors}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={refreshing}
      />
      <VisitStats today={today} totalViews={totalViews} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SourceList rows={sources} />
        <LiveVisits rows={recent} />
      </div>
      <VisitsChart data={daily} />
      <div className="grid gap-3 sm:grid-cols-2">
        <PathList title="עמודי כניסה" hint="איפה המבקרים נכנסים לאתר" rows={topEntries} />
        <PathList title="עמודי יציאה" hint="איפה המבקרים עוזבים" rows={topExits} />
      </div>
      <PathList title="העמודים הנצפים ביותר" rows={topPaths} />
      <RecentActivity data={data} />
    </div>
  );
}