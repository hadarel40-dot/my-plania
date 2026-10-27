-- תיקונים לפי ה-advisors של Supabase

-- search_path קבוע: הפונקציה לא תושפע מאובייקטים בשמות זהים בסכמות אחרות
alter function public.touch_updated_at() set search_path = '';

-- ה-RLS של variant_jobs מסנן לפי owner_id
create index variant_jobs_owner_idx on public.variant_jobs (owner_id);
