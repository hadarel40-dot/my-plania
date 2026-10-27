-- סכמה לשלב החיבור לענן. במצב הדמו הנוכחי הנתונים נשמרים בזיכרון הדפדפן.

create type job_status as enum ('queued', 'running', 'succeeded', 'failed');

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null,
  source_url text,                 -- קובץ המקור (R2/S3)
  mux_playback_id text,            -- proxy / HLS לצפייה בדפדפן
  thumbnail_url text,
  duration_sec numeric,
  fps numeric,
  width int,
  height int,
  origin text not null default 'upload',   -- upload | ai_variant | render
  created_at timestamptz default now()
);

create table edit_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  timeline jsonb not null,         -- אותו מבנה כמו Timeline ב-lib/editor/types.ts
  updated_at timestamptz default now()
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references edit_projects on delete cascade,
  clip_id text not null,
  label text not null,
  parent_id uuid references variants on delete set null,
  status job_status not null default 'queued',
  progress int not null default 0,
  params jsonb not null,           -- prompt, style, strength, seed
  provider text not null,          -- fal | replicate | runway
  provider_job_id text,
  result_asset_id uuid references media_assets,
  rating smallint not null default 0,
  error text,
  created_at timestamptz default now()
);
create index on variants (project_id, clip_id);

alter table media_assets enable row level security;
alter table edit_projects enable row level security;
alter table variants enable row level security;

create policy "own assets" on media_assets for all using (owner_id = auth.uid());
create policy "own projects" on edit_projects for all using (owner_id = auth.uid());
create policy "own variants" on variants for all using (
  project_id in (select id from edit_projects where owner_id = auth.uid())
);

-- הכרטיסים בפאנל הווריאציות מתעדכנים מכאן בזמן אמת
alter publication supabase_realtime add table variants;
