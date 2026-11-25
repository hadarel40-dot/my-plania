-- שעת פרסום לכל פוסט, ויומן מנויים (ics) שמקפיץ תזכורת לפרסם

alter table public.studio_items add column if not exists post_time text
  check (post_time is null or post_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- המנהלת קובעת קוד סודי ליומן (נשמר רק כגיבוב). קוד חדש מבטל את הקודם
create or replace function public.studio_calendar_token_set(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'not allowed'; end if;
  if length(p_token) < 32 then raise exception 'token too short'; end if;
  insert into public.studio_secrets (name, hash) values ('calendar', encode(extensions.digest(p_token, 'sha256'), 'hex'))
  on conflict (name) do update set hash = excluded.hash;
end $$;
revoke all on function public.studio_calendar_token_set(text) from public;
grant execute on function public.studio_calendar_token_set(text) to authenticated;

-- היומן עצמו: אפליקציית היומן קוראת אותו בלי התחברות, רק עם הקוד. מחזיר פוסטים משבועיים אחורה ועד חודשיים קדימה
create or replace function public.studio_calendar_feed(p_token text)
returns table (id uuid, title text, format text, planned_date date, post_time text, caption text, stage text, draft_id uuid, account text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.studio_secrets where name = 'calendar' and length(p_token) >= 32 and hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then raise exception 'not allowed'; end if;
  return query
    select i.id, i.title, i.format, i.planned_date, i.post_time, i.caption, i.stage, i.draft_id, i.account, i.updated_at
    from public.studio_items i
    where i.planned_date is not null and i.planned_date between current_date - 14 and current_date + 62
    order by i.planned_date, i.post_time nulls last;
end $$;
revoke all on function public.studio_calendar_feed(text) from public;
grant execute on function public.studio_calendar_feed(text) to anon, authenticated;
