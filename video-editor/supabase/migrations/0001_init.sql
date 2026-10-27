-- פרויקטים של העורך. כל פרויקט נשמר כמסמך אחד (timeline + assets + variants),
-- באותו מבנה כמו SavedProject ב-lib/editor/types.ts.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'פרויקט חדש',
  doc jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;

create policy "projects: owner reads" on public.projects
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "projects: owner inserts" on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "projects: owner updates" on public.projects
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "projects: owner deletes" on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- קבצי מדיה: bucket פרטי. כל משתמש כותב וקורא רק מתחת לתיקייה שלו: media/<user id>/...
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
