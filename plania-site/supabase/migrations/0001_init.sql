-- Generated from base44/entities/*.jsonc. Same fields, same rules:
-- the admin reads and edits everything; visitors may only add leads, questionnaires and visits.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('admin','user')),
  created_date timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Every new account gets a profile. The site owner's email becomes admin automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          case when lower(new.email) in ('hadarel40@gmail.com','planiasmartplan@gmail.com') then 'admin' else 'user' end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_date() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_date = now(); return new; end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table public.leads (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "campaign" text,
  "deal_value" double precision,
  "follow_up_date" text,
  "history" jsonb,
  "message" text,
  "name" text not null,
  "notes" text,
  "phone" text not null,
  "service" text not null,
  "source" text,
  "status" text default 'ליד חדש'
);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_date();
alter table public.leads enable row level security;
create policy leads_admin_all on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy leads_public_insert on public.leads for insert to anon, authenticated with check (true);
create index leads_created_idx on public.leads (created_date desc);

create table public.travel_questionnaires (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "answers" jsonb,
  "campaign" text,
  "contract_signed" boolean,
  "contract_text" text,
  "contract_version" text,
  "email" text,
  "files" jsonb,
  "name" text not null,
  "notes" text,
  "phone" text,
  "plan_tier" text,
  "quote_approved_at" text,
  "quote_approved_name" text,
  "quote_brief" text,
  "quote_delivery" text,
  "quote_deposit" double precision,
  "quote_payment_url" text,
  "quote_price" double precision,
  "quote_sent_at" text,
  "quote_token" text,
  "signed_at" text,
  "signer_id_number" text,
  "signer_name" text,
  "source" text,
  "status" text default 'חדש',
  "travelers_ages" jsonb
);
create trigger travel_questionnaires_touch before update on public.travel_questionnaires for each row execute function public.touch_updated_date();
alter table public.travel_questionnaires enable row level security;
create policy travel_questionnaires_admin_all on public.travel_questionnaires for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy travel_questionnaires_public_insert on public.travel_questionnaires for insert to anon, authenticated with check (true);
create index travel_questionnaires_created_idx on public.travel_questionnaires (created_date desc);

create table public.business_questionnaires (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "answers" jsonb,
  "campaign" text,
  "contract_signed" boolean,
  "contract_text" text,
  "contract_version" text,
  "email" text,
  "files" jsonb,
  "name" text not null,
  "notes" text,
  "phone" text,
  "quote_approved_at" text,
  "quote_approved_name" text,
  "quote_brief" text,
  "quote_delivery" text,
  "quote_deposit" double precision,
  "quote_payment_url" text,
  "quote_price" double precision,
  "quote_sent_at" text,
  "quote_token" text,
  "signed_at" text,
  "signer_id_number" text,
  "signer_name" text,
  "source" text,
  "status" text default 'חדש'
);
create trigger business_questionnaires_touch before update on public.business_questionnaires for each row execute function public.touch_updated_date();
alter table public.business_questionnaires enable row level security;
create policy business_questionnaires_admin_all on public.business_questionnaires for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy business_questionnaires_public_insert on public.business_questionnaires for insert to anon, authenticated with check (true);
create index business_questionnaires_created_idx on public.business_questionnaires (created_date desc);

create table public.client_projects (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "name" text not null,
  "business_name" text,
  "phone" text,
  "email" text,
  "project_type" text,
  "stage" text,
  "source_type" text,
  "source_id" text,
  "start_date" text,
  "due_date" text,
  "price" double precision,
  "deposit_paid" double precision,
  "balance_paid" double precision,
  "domain" text,
  "platform" text,
  "existing_site" text,
  "goal" text,
  "audience" text,
  "pages_features" text,
  "brand" text,
  "references" text,
  "requirements" text,
  "notes" text,
  "requested_items" jsonb,
  "tasks" jsonb,
  "log" jsonb,
  "portal_token" text,
  "portal_enabled" boolean default true,
  "portal_note" text,
  "last_material_at" text
);
create trigger client_projects_touch before update on public.client_projects for each row execute function public.touch_updated_date();
alter table public.client_projects enable row level security;
create policy client_projects_admin_all on public.client_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index client_projects_created_idx on public.client_projects (created_date desc);

create table public.client_materials (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "project_id" text not null,
  "text" text,
  "files" jsonb,
  "requested_item" text,
  "seen" boolean default false
);
create trigger client_materials_touch before update on public.client_materials for each row execute function public.touch_updated_date();
alter table public.client_materials enable row level security;
create policy client_materials_admin_all on public.client_materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index client_materials_created_idx on public.client_materials (created_date desc);

create table public.site_visits (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "campaign" text,
  "device" text,
  "is_entry" boolean,
  "path" text not null,
  "referrer" text,
  "session_id" text not null,
  "source" text
);
create trigger site_visits_touch before update on public.site_visits for each row execute function public.touch_updated_date();
alter table public.site_visits enable row level security;
create policy site_visits_admin_all on public.site_visits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy site_visits_public_insert on public.site_visits for insert to anon, authenticated with check (true);
create index site_visits_created_idx on public.site_visits (created_date desc);

create table public.social_snapshots (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  "date" text not null,
  "engaged_7d" double precision,
  "followers" double precision,
  "follows" double precision,
  "media_count" double precision,
  "platform" text,
  "profile_views_7d" double precision,
  "reach_7d" double precision,
  "website_clicks_7d" double precision
);
create trigger social_snapshots_touch before update on public.social_snapshots for each row execute function public.touch_updated_date();
alter table public.social_snapshots enable row level security;
create policy social_snapshots_admin_all on public.social_snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index social_snapshots_created_idx on public.social_snapshots (created_date desc);

-- Lookups the server functions run often
create index client_projects_portal_token_idx on public.client_projects (portal_token);
create index client_projects_source_id_idx on public.client_projects (source_id);
create index client_materials_project_idx on public.client_materials (project_id);
create index site_visits_entry_idx on public.site_visits (is_entry, created_date desc);

-- Private bucket for files clients upload (questionnaires and materials). Only the server and the admin read it.
insert into storage.buckets (id, name, public, file_size_limit) values ('private', 'private', false, 52428800) on conflict do nothing;
create policy private_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'private' and public.is_admin());

-- Visitors attach files to questionnaires and the client portal: they may upload into uploads/ but never read or list
create policy private_public_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = 'uploads');
