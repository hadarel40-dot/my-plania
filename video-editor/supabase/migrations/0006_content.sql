-- מאגר התוכן לאינסטגרם: כל שורה היא פוסט אחד (רעיון, טיוטה, מאושר, פורסם).
-- הדאשבורד (/content) עורך את הטבלה; תרחיש הפרסום (Make) מושך פוסטים מאושרים שהגיע זמנם
-- דרך /api/content/due ומדווח חזרה דרך /api/content/report, עם מפתח אישי (רק ה-hash נשמר).

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  account text not null check (account in ('plania.il', 'hadarelifergan')),
  format text not null default 'reel' check (format in ('reel', 'carousel', 'image', 'story')),
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'approved', 'publishing', 'published', 'failed')),
  title text not null default '' check (char_length(title) <= 200),
  hook text not null default '' check (char_length(hook) <= 1000),        -- הטקסט על המסך / הפתיח
  script text not null default '' check (char_length(script) <= 10000),   -- מה מצלמים / התסריט
  caption text not null default '' check (char_length(caption) <= 2200), -- המגבלה של אינסטגרם
  notes text not null default '' check (char_length(notes) <= 5000),
  -- [{ "path": "<user>/<item>/<file>", "type": "video" | "image" }] בתוך ה-bucket הציבורי content
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  project_id uuid references public.projects on delete set null,
  scheduled_at timestamptz,
  published_at timestamptz,
  ig_media_id text,
  ig_permalink text,
  error text,
  source text not null default 'manual' check (source in ('manual', 'agent', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_owner_sched_idx on public.content_items (owner_id, scheduled_at);
create index content_items_due_idx on public.content_items (scheduled_at) where status = 'approved';
create index content_items_project_idx on public.content_items (project_id);

create trigger content_items_touch before update on public.content_items
for each row execute function public.touch_updated_at();

alter table public.content_items enable row level security;

create policy "content: owner reads" on public.content_items
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "content: owner inserts" on public.content_items
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "content: owner updates" on public.content_items
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "content: owner deletes" on public.content_items
  for delete to authenticated using (owner_id = (select auth.uid()));

-- קבצים לפרסום: bucket ציבורי, כי אינסטגרם מורידה את הסרטון מכתובת פתוחה.
-- הנתיבים כוללים מזהים אקראיים, ואין policy של select, כך שאי אפשר לרשום את התוכן.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 52428800,
        array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "content files: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "content files: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "content files: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- מפתח לתרחיש הפרסום. נשמר רק ה-hash; המפתח עצמו מוצג פעם אחת בדאשבורד.
create table public.content_automation (
  owner_id uuid primary key default auth.uid() references auth.users on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.content_automation enable row level security;
create policy "automation: owner reads" on public.content_automation
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "automation: owner inserts" on public.content_automation
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "automation: owner updates" on public.content_automation
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "automation: owner deletes" on public.content_automation
  for delete to authenticated using (owner_id = (select auth.uid()));

create function public.content_owner_for_key(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select owner_id from public.content_automation
  where p_key is not null and char_length(p_key) >= 32
    and key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
$$;
revoke all on function public.content_owner_for_key(text) from public, anon, authenticated;

-- הפוסטים המאושרים שהגיע זמנם. מסמן אותם "בפרסום", כדי שריצה כפולה לא תפרסם פעמיים.
create function public.content_take_due(p_key text)
returns setof public.content_items
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.content_owner_for_key(p_key);
begin
  if v_owner is null then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  update public.content_automation set last_seen_at = now() where owner_id = v_owner;
  return query
    update public.content_items c
       set status = 'publishing', error = null
     where c.owner_id = v_owner and c.status = 'approved'
       and c.scheduled_at is not null and c.scheduled_at <= now()
       and jsonb_array_length(c.media) > 0
    returning c.*;
end $$;

-- דיווח מהתרחיש: פורסם (עם הקישור) או נכשל (עם הסיבה)
create function public.content_report(
  p_key text, p_id uuid, p_ok boolean, p_ig_media_id text default null,
  p_permalink text default null, p_error text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.content_owner_for_key(p_key);
begin
  if v_owner is null then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  update public.content_items
     set status = case when p_ok then 'published' else 'failed' end,
         published_at = case when p_ok then now() else published_at end,
         ig_media_id = coalesce(p_ig_media_id, ig_media_id),
         ig_permalink = coalesce(p_permalink, ig_permalink),
         error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 1000) end
   where id = p_id and owner_id = v_owner;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.content_take_due(text) from public;
revoke all on function public.content_report(text, uuid, boolean, text, text, text) from public;
grant execute on function public.content_take_due(text) to anon, authenticated;
grant execute on function public.content_report(text, uuid, boolean, text, text, text) to anon, authenticated;
