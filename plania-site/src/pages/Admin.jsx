import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CalendarCheck, FolderOpen, Instagram, LayoutDashboard, Search, Users, X } from 'lucide-react';
import LeadsTab from '@/components/admin/LeadsTab';
import QuestionnairesTab from '@/components/admin/QuestionnairesTab';
import QuestionnaireLinks from '@/components/admin/QuestionnaireLinks';
import ProjectsTab from '@/components/admin/ProjectsTab';
import TodayTab from '@/components/admin/TodayTab';
import OverviewTab from '@/components/admin/OverviewTab';
import SocialTab from '@/components/admin/SocialTab';
import ClientsTab from '@/components/admin/ClientsTab';
import ClientDialog from '@/components/admin/ClientDialog';
import BottomNav from '@/components/admin/BottomNav';
import AdminLogin from '@/components/admin/AdminLogin';
import { AdminActionsProvider } from '@/components/admin/AdminActions';
import { countNew, sortNewFirst } from '@/lib/recordStatus';
import { DEFAULT_LEAD_STATUS, isOpen, closedAt } from '@/lib/leadStatus';
import { todayISO } from '@/lib/formatDate';
import { waNumber } from '@/lib/phone';
import { toBlankProject } from '@/lib/projects';
import { buildProjectFields } from '@/lib/questionnaireImport';
import { buildActionItems, clientKeyOf, matchesQuery } from '@/lib/adminInsights';
import useNoIndex from '@/hooks/useNoIndex';
import useAdminInstall from '@/hooks/useAdminInstall';

// What changes in a record should be reflected in the Google Calendar
const CALENDAR_KEYS = {
  Lead: ['follow_up_date', 'status', 'name'],
  ClientProject: ['due_date', 'tasks', 'stage', 'name'],
};

const ENTITY_KEYS = {
  Lead: 'leads',
  TravelQuestionnaire: 'travel',
  BusinessQuestionnaire: 'business',
  ClientProject: 'projects',
  ClientMaterial: 'materials',
};

function NewBadge({ count }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#5E1D1D] text-white text-[10px]">
      {count}
    </span>
  );
}

export default function Admin() {
  const { user, isLoadingAuth, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  useNoIndex();
  useAdminInstall();
  const [data, setData] = useState({ leads: [], travel: [], business: [], projects: [], materials: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [client, setClient] = useState(null);
  const [openRequest, setOpenRequest] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [calendar, setCalendar] = useState({ state: 'unknown', text: '' });
  const [calendarBusy, setCalendarBusy] = useState(false);

  const syncCalendar = useCallback(async (payload) => {
    try {
      const response = await base44.functions.invoke('syncCalendar', payload);
      setCalendar({ state: 'ok', text: '' });
      return response?.data;
    } catch (error) {
      const message = error?.response?.data?.error || 'לא הצלחתי לעדכן את היומן';
      setCalendar({ state: message.includes('לא מחובר') ? 'off' : 'error', text: message });
      return { error: message };
    }
  }, []);

  const syncCalendarAll = async () => {
    setCalendarBusy(true);
    const result = await syncCalendar({ all: true });
    setCalendarBusy(false);
    if (!result?.error) {
      setCalendar({ state: 'ok', text: `היומן עודכן: ${result?.synced ?? 0} אירועים` });
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.all([
      base44.entities.Lead.list('-created_date'),
      base44.entities.TravelQuestionnaire.list('-created_date'),
      base44.entities.BusinessQuestionnaire.list('-created_date'),
      base44.entities.ClientProject.list('-created_date').catch(() => []),
      base44.entities.ClientMaterial.list('-created_date', 500).catch(() => []),
    ]).then(([leads, travel, business, projects, materials]) => {
      if (!active) return;
      setData({ leads, travel: sortNewFirst(travel), business: sortNewFirst(business), projects, materials });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  // Quietly reloads everything (leads, questionnaires, projects and what clients sent),
  // so new leads, questionnaires and uploads show up without a manual page refresh.
  const refreshWork = useCallback(async () => {
    setRefreshing(true);
    try {
      const [leads, travel, business, projects, materials] = await Promise.all([
        base44.entities.Lead.list('-created_date'),
        base44.entities.TravelQuestionnaire.list('-created_date'),
        base44.entities.BusinessQuestionnaire.list('-created_date'),
        base44.entities.ClientProject.list('-created_date'),
        base44.entities.ClientMaterial.list('-created_date', 500),
      ]);
      setData({ leads, travel: sortNewFirst(travel), business: sortNewFirst(business), projects, materials });
      setLastRefreshed(new Date().toISOString());
    } catch {
      // נשארים עם מה שיש, ינסו שוב ברענון הבא
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshWork();
    }, 60000);
    return () => clearInterval(timer);
  }, [isAdmin, refreshWork]);

  const summary = useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const open = data.leads.filter(isOpen);

    return {
      openCount: open.length,
      closedThisMonth: data.leads.filter(
        (lead) => !isOpen(lead) && String(closedAt(lead)).slice(0, 7) === month
      ).length,
      dueToday: open.filter((lead) => lead.follow_up_date && lead.follow_up_date <= today).length,
      openValue: open.reduce((sum, lead) => sum + (Number(lead.deal_value) || 0), 0),
    };
  }, [data.leads]);

  const followUps = useMemo(() => {
    const today = todayISO();
    return data.leads
      .filter((lead) => isOpen(lead) && lead.follow_up_date && lead.follow_up_date <= today)
      .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
  }, [data.leads]);

  const actionItems = useMemo(() => buildActionItems(data), [data]);

  const questionnairesByPhone = useMemo(() => {
    const map = {};
    const add = (records, type) => {
      records.forEach((record) => {
        const key = waNumber(record.phone);
        if (!key) return;
        map[key] = [...(map[key] || []), { type, answers: record.answers || [] }];
      });
    };
    add(data.travel, 'travel');
    add(data.business, 'business');
    return map;
  }, [data.travel, data.business]);

  const updateRecord = async (entityName, id, patch) => {
    await base44.entities[entityName].update(id, patch);
    const key = ENTITY_KEYS[entityName];
    setData((prev) => ({
      ...prev,
      [key]: prev[key].map((record) => (record.id === id ? { ...record, ...patch } : record)),
    }));
    if (CALENDAR_KEYS[entityName]?.some((field) => field in patch)) {
      syncCalendar({ kind: entityName === 'Lead' ? 'lead' : 'project', id });
    }
  };

  // A quote was sent and the server already updated the lead and the project; this only
  // mirrors that on screen so nothing shows old numbers until the next refresh.
  const applySynced = (synced) => {
    if (!synced) return;
    setData((prev) => ({
      ...prev,
      leads: synced.lead
        ? prev.leads.map((lead) => (lead.id === synced.lead.id ? { ...lead, ...synced.lead.patch } : lead))
        : prev.leads,
      projects: synced.project
        ? prev.projects.map((project) =>
            project.id === synced.project.id ? { ...project, ...synced.project.patch } : project
          )
        : prev.projects,
    }));
  };

  const createProject = async (fields) => {
    const created = await base44.entities.ClientProject.create(fields);
    setData((prev) => ({ ...prev, projects: [created, ...prev.projects] }));
    setOpenRequest({ id: created.id, n: Date.now() });
    return created;
  };

  const openProject = (id) => {
    setQuery('');
    setTab('projects');
    setOpenRequest({ id, n: Date.now() });
  };

  const openClient = (record) => {
    setClient({ key: clientKeyOf(record), name: record.name, phone: record.phone });
  };

  const createProjectFromQuestionnaire = async (record, type) => {
    await createProject(
      toBlankProject({
        name: record.name,
        phone: record.phone || '',
        email: record.email || '',
        source_type: type,
        source_id: record.id,
        price: record.quote_price ?? undefined,
        ...(type === 'travel' ? { project_type: 'אחר', requested_items: [] } : {}),
        ...buildProjectFields(record, type).fields,
      })
    );
    setQuery('');
    setTab('projects');
  };

  const createProjectFromLead = async (lead) => {
    await createProject(
      toBlankProject({
        name: lead.name,
        phone: lead.phone || '',
        price: lead.deal_value ?? undefined,
        ...(lead.service === 'travel' ? { project_type: 'אחר', requested_items: [] } : {}),
      })
    );
    setQuery('');
    setTab('projects');
  };

  const projectBySource = useMemo(() => {
    const map = {};
    data.projects.forEach((p) => {
      if (p.source_id) map[p.source_id] = p;
    });
    return map;
  }, [data.projects]);

  const projectByPhone = useMemo(() => {
    const map = {};
    data.projects.forEach((p) => {
      const key = waNumber(p.phone);
      if (key && !map[key]) map[key] = p;
    });
    return map;
  }, [data.projects]);

  const markMaterialSeen = async (id) => {
    setData((prev) => ({
      ...prev,
      materials: prev.materials.map((m) => (m.id === id ? { ...m, seen: true } : m)),
    }));
    try {
      await base44.entities.ClientMaterial.update(id, { seen: true });
    } catch {
      // לא קריטי, יסומן שוב בפתיחה הבאה
    }
  };

  const projectQuestionnaires = useMemo(
    () => [
      ...data.business.map((q) => ({ ...q, __type: 'business' })),
      ...data.travel.map((q) => ({ ...q, __type: 'travel' })),
    ],
    [data.business, data.travel]
  );

  const unseenMaterials = data.materials.filter((m) => !m.seen).length;

  const searching = query.trim().length > 0;
  const found = useMemo(() => {
    if (!searching) return null;
    return {
      leads: data.leads.filter((record) => matchesQuery(record, query)),
      travel: data.travel.filter((record) => matchesQuery(record, query)),
      business: data.business.filter((record) => matchesQuery(record, query)),
      projects: data.projects.filter((record) => matchesQuery(record, query)),
    };
  }, [searching, query, data.leads, data.travel, data.business, data.projects]);

  const deleteRecord = async (entityName, id) => {
    if (entityName === 'ClientProject') {
      const related = data.materials.filter((m) => m.project_id === id);
      await Promise.all(related.map((m) => base44.entities.ClientMaterial.delete(m.id)));
      setData((prev) => ({ ...prev, materials: prev.materials.filter((m) => m.project_id !== id) }));
    }
    await base44.entities[entityName].delete(id);
    const key = ENTITY_KEYS[entityName];
    setData((prev) => ({ ...prev, [key]: prev[key].filter((record) => record.id !== id) }));
    if (CALENDAR_KEYS[entityName]) {
      syncCalendar({ kind: entityName === 'Lead' ? 'lead' : 'project', id, deleted: true });
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0e8df]">
        <p className="text-sm text-[#6a6158]">טוען...</p>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0e8df] px-6 text-center">
        <div>
          <p className="text-sm text-[#6a6158] mb-4">אין הרשאה לצפות בעמוד הזה.</p>
          <button type="button" onClick={() => logout()} className="text-sm underline text-[#5E1D1D]">
            יציאה
          </button>
        </div>
      </div>
    );
  }

  const newLeadsCount = countNew(data.leads, DEFAULT_LEAD_STATUS);
  const newTravelCount = countNew(data.travel);
  const newBusinessCount = countNew(data.business);
  const clientsBadge = newLeadsCount + newTravelCount + newBusinessCount;
  const todayBadge = actionItems.length + followUps.length;

  const navItems = [
    { key: 'overview', label: 'סקירה', icon: LayoutDashboard, badge: 0 },
    { key: 'today', label: 'היום', icon: CalendarCheck, badge: todayBadge },
    { key: 'clients', label: 'לקוחות', icon: Users, badge: clientsBadge },
    { key: 'projects', label: 'פרויקטים', icon: FolderOpen, badge: unseenMaterials },
    { key: 'social', label: 'סושיאל', icon: Instagram, badge: 0 },
  ];

  const leadsList = (list, compact = false) => (
    <LeadsTab
      leads={list}
      compact={compact}
      questionnairesByPhone={questionnairesByPhone}
      projectByPhone={projectByPhone}
      onOpenProject={openProject}
      onCreateProject={createProjectFromLead}
      onUpdate={(id, patch) => updateRecord('Lead', id, patch)}
      onDelete={(id) => deleteRecord('Lead', id)}
    />
  );

  const travelList = (list) => (
    <QuestionnairesTab
      records={list}
      emptyText="אין שאלוני טיול עדיין."
      accentColor="#4A6355"
      type="travel"
      projectBySource={projectBySource}
      onOpenProject={openProject}
      onCreateProject={(record) => createProjectFromQuestionnaire(record, 'travel')}
      onSynced={applySynced}
      onUpdate={(id, patch) => updateRecord('TravelQuestionnaire', id, patch)}
      onDelete={(id) => deleteRecord('TravelQuestionnaire', id)}
    />
  );

  const businessList = (list) => (
    <QuestionnairesTab
      records={list}
      emptyText="אין שאלוני עסק עדיין."
      accentColor="#4A6355"
      type="business"
      projectBySource={projectBySource}
      onOpenProject={openProject}
      onCreateProject={(record) => createProjectFromQuestionnaire(record, 'business')}
      onSynced={applySynced}
      onUpdate={(id, patch) => updateRecord('BusinessQuestionnaire', id, patch)}
      onDelete={(id) => deleteRecord('BusinessQuestionnaire', id)}
    />
  );

  const projectsList = (list, compact = false) => (
    <ProjectsTab
      projects={list}
      compact={compact}
      materials={data.materials}
      questionnaires={projectQuestionnaires}
      openRequest={openRequest}
      lastRefreshed={lastRefreshed}
      refreshing={refreshing}
      onRefresh={refreshWork}
      onCreate={createProject}
      onUpdate={(id, patch) => updateRecord('ClientProject', id, patch)}
      onDelete={(id) => deleteRecord('ClientProject', id)}
      onMarkSeen={markMaterialSeen}
    />
  );

  const resultSections = found
    ? [
        { key: 'leads', title: 'לידים', count: found.leads.length, node: () => leadsList(found.leads, true) },
        { key: 'travel', title: 'שאלוני טיול', count: found.travel.length, node: () => travelList(found.travel) },
        { key: 'business', title: 'שאלוני עסק', count: found.business.length, node: () => businessList(found.business) },
        { key: 'projects', title: 'פרויקטים', count: found.projects.length, node: () => projectsList(found.projects, true) },
      ].filter((section) => section.count > 0)
    : [];

  return (
    <AdminActionsProvider value={{ openClient }}>
      <div className="min-h-screen bg-[#f0e8df] pb-28 sm:pb-16">
        <header className="bg-[#2a2622] text-white">
          <div className="mx-auto w-full max-w-[720px] px-5 h-14 flex items-center justify-between">
            <span className="font-heading text-lg">הדראל איפרגן · ניהול</span>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="https://www.instagram.com/hadarelifergan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Instagram className="w-3.5 h-3.5" />
                אינסטגרם
              </a>
              <Link to="/" className="hover:underline">
                לאתר
              </Link>
              <button type="button" onClick={() => logout()} className="hover:underline">
                יציאה
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[720px] px-5 py-6">
          <div className="relative mb-5">
            <Search className="w-4 h-4 text-[#6a6158] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי שם, טלפון או עסק"
              className="pr-9 pl-9 h-11 bg-[#faf6f1] border-[#d9cfc2] text-sm"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="ניקוי החיפוש"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6158]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-center text-sm text-[#6a6158] py-10">טוען...</p>
          ) : searching ? (
            <div className="space-y-6">
              {resultSections.length === 0 && (
                <p className="text-center text-sm text-[#6a6158] py-10">אין תוצאות לחיפוש הזה.</p>
              )}
              {resultSections.map((section) => (
                <section key={section.key}>
                  <h2 className="font-heading text-lg text-[#2a2622] mb-2">
                    {section.title} <span className="text-xs text-[#6a6158]">({section.count})</span>
                  </h2>
                  {section.node()}
                </section>
              ))}
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="hidden sm:flex mb-6 w-full h-auto flex-wrap bg-[#e6dccd]">
                <TabsTrigger value="overview" className="flex-1 gap-2 text-sm">
                  סקירה
                </TabsTrigger>
                <TabsTrigger value="today" className="flex-1 gap-2 text-sm">
                  היום
                  {todayBadge > 0 && <NewBadge count={todayBadge} />}
                </TabsTrigger>
                <TabsTrigger value="clients" className="flex-1 gap-2 text-sm">
                  לקוחות
                  {clientsBadge > 0 && <NewBadge count={clientsBadge} />}
                </TabsTrigger>
                <TabsTrigger value="projects" className="flex-1 gap-2 text-sm">
                  פרויקטים
                  {unseenMaterials > 0 && <NewBadge count={unseenMaterials} />}
                </TabsTrigger>
                <TabsTrigger value="social" className="flex-1 gap-2 text-sm">
                  סושיאל
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab
                  data={data}
                  actionItems={actionItems}
                  onOpenClient={openClient}
                  onOpenProject={openProject}
                  onNavigate={setTab}
                />
              </TabsContent>

              <TabsContent value="today">
                <TodayTab
                  data={data}
                  summary={summary}
                  followUps={followUps}
                  actionItems={actionItems}
                  onOpenClient={openClient}
                  onOpenProject={openProject}
                  calendar={calendar}
                  calendarBusy={calendarBusy}
                  onSyncCalendar={syncCalendarAll}
                />
              </TabsContent>

              <TabsContent value="clients">
                <ClientsTab
                  sections={[
                    { key: 'leads', label: 'לידים', badge: newLeadsCount, render: () => leadsList(data.leads) },
                    { key: 'travel', label: 'שאלוני טיול', badge: newTravelCount, render: () => travelList(data.travel) },
                    { key: 'business', label: 'שאלוני עסק', badge: newBusinessCount, render: () => businessList(data.business) },
                  ]}
                />
              </TabsContent>

              <TabsContent value="projects">{projectsList(data.projects)}</TabsContent>

              <TabsContent value="social">
                <SocialTab data={data} onOpenClient={openClient} />
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-10">
            <QuestionnaireLinks />
          </div>
        </div>

        <BottomNav
          items={navItems}
          value={searching ? '' : tab}
          onChange={(key) => {
            setQuery('');
            setTab(key);
          }}
        />

        <ClientDialog
          client={client}
          data={data}
          onClose={() => setClient(null)}
          onOpenProject={(id) => {
            setClient(null);
            openProject(id);
          }}
        />
      </div>
    </AdminActionsProvider>
  );
}