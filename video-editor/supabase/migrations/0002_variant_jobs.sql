-- עבודות AI שרצות בצד השרת. השורה נוצרת כשהמשתמש מבקש וריאציה, ומתעדכנת
-- כשהשרת בודק את הסטטוס מול fal. כך עבודה ממשיכה גם אם הדף נסגר.

create table public.variant_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  variant_id text not null,               -- המזהה של הוריאציה בתוך מסמך הפרויקט
  model text not null,
  input jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  request_id text,
  status_url text,
  response_url text,
  result_path text,                       -- התוצאה, אחרי שהועתקה ל-Storage
  error text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index variant_jobs_project_idx on public.variant_jobs (project_id);

create trigger variant_jobs_touch before update on public.variant_jobs
for each row execute function public.touch_updated_at();

alter table public.variant_jobs enable row level security;

create policy "variant_jobs: owner reads" on public.variant_jobs
  for select to authenticated using (owner_id = (select auth.uid()));
-- אפשר ליצור עבודה רק לפרויקט שלך
create policy "variant_jobs: owner inserts" on public.variant_jobs
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and project_id in (select id from public.projects where owner_id = (select auth.uid()))
  );
create policy "variant_jobs: owner updates" on public.variant_jobs
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
