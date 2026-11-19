-- סטודיו התוכן: הדשבורד האישי לתוכן ושיווק. פתוח רק למנהלת (public.is_admin()).
-- הסטודיו לא מפרסם כלום. שלב של פריט משתנה רק כשהמנהלת מזיזה אותו.

create table public.studio_voice (
  account text primary key check (account in ('hadarelifergan', 'plania.il')),
  profile jsonb not null default '{}'::jsonb,
  pending jsonb not null default '[]'::jsonb,
  samples jsonb not null default '[]'::jsonb,
  built_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.studio_drafts (
  id uuid primary key default gen_random_uuid(),
  idea text not null,
  account text not null check (account in ('hadarelifergan', 'plania.il')),
  niche text,
  mode text not null default 'full' check (mode in ('full', 'short')),
  facts text not null default '',
  data jsonb not null default '{}'::jsonb,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  account text not null check (account in ('hadarelifergan', 'plania.il')),
  niche text,
  format text not null default 'reel' check (format in ('reel', 'carousel', 'story', 'image')),
  stage text not null default 'idea' check (stage in ('idea', 'draft', 'review', 'approved', 'published')),
  planned_date date,
  hook text not null default '',
  caption text not null default '',
  notes text not null default '',
  draft_id uuid references public.studio_drafts (id) on delete set null,
  ig_permalink text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_trends (
  date date primary key,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  items jsonb not null default '[]'::jsonb,
  dropped integer not null default 0,
  error text,
  updated_at timestamptz not null default now()
);

create table public.studio_daily (
  date date primary key,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.studio_reviews (
  week_start date primary key,
  body text not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.studio_snapshots (
  date date not null,
  account text not null,
  followers integer not null,
  media_count integer,
  primary key (date, account)
);

-- הסוד של המשימה היומית (שמור כ-hash בלבד). אין לטבלה מדיניות, כך שרק הפונקציות למטה קוראות אותה
create table public.studio_secrets (
  name text primary key,
  hash text not null
);

create or replace function public.studio_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger studio_drafts_touch before update on public.studio_drafts for each row execute function public.studio_touch();
create trigger studio_items_touch before update on public.studio_items for each row execute function public.studio_touch();
create trigger studio_trends_touch before update on public.studio_trends for each row execute function public.studio_touch();
create trigger studio_voice_touch before update on public.studio_voice for each row execute function public.studio_touch();

do $$
declare t text;
begin
  foreach t in array array['studio_voice', 'studio_drafts', 'studio_items', 'studio_trends', 'studio_daily', 'studio_reviews', 'studio_snapshots', 'studio_secrets'] loop
    execute format('alter table public.%I enable row level security', t);
    if t <> 'studio_secrets' then
      execute format('create policy "admin only" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
end $$;

-- המשימה היומית רצה בלי משתמשת מחוברת: היא מוכיחה את עצמה עם הסוד, ורק אז נוגעת בטבלת הטרנדים
create or replace function public.studio_cron_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_secrets
    where name = 'cron' and hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  );
$$;

create or replace function public.studio_cron_trends(p_secret text, p_date date, p_status text, p_items jsonb, p_dropped integer, p_error text)
returns text language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  select status into current_status from public.studio_trends where date = p_date;
  -- בדיקה בלבד: האם כבר רץ היום
  if p_status is null then return coalesce(current_status, 'none'); end if;
  insert into public.studio_trends (date, status, items, dropped, error)
  values (p_date, p_status, coalesce(p_items, '[]'::jsonb), coalesce(p_dropped, 0), p_error)
  on conflict (date) do update set status = excluded.status, items = excluded.items, dropped = excluded.dropped, error = excluded.error;
  return p_status;
end $$;

revoke all on function public.studio_cron_ok(text) from public, anon, authenticated;
revoke all on function public.studio_cron_trends(text, date, text, jsonb, integer, text) from public;
grant execute on function public.studio_cron_trends(text, date, text, jsonb, integer, text) to anon, authenticated;
