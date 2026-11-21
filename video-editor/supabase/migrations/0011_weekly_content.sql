-- תוכן שבועי שנוצר בקלוד קוד: סוג תוכן לכל פריט, וקבצים (תמונות וסרטונים מוכנים) שמועלים לאחסון

-- ארבעת סוגי התוכן: סיפור אישי, ויראלי, ערך, אמון והוכחה
alter table public.studio_items add column if not exists content_type text
  check (content_type in ('story', 'viral', 'value', 'trust'));

-- העלאה מהתהליך השבועי: בלי משתמשת מחוברת, לנתיב inbox/<טוקן>/...
-- הטוקן מתחלף בכל ריצה (דרך המסד), ורק הגיבוב שלו נשמר כאן
create or replace function public.studio_upload_ok(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_secrets
    where name = 'upload' and length(p_token) >= 32 and hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;
revoke all on function public.studio_upload_ok(text) from public;
grant execute on function public.studio_upload_ok(text) to anon, authenticated;

drop policy if exists "media: weekly uploads" on storage.objects;
create policy "media: weekly uploads" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'inbox' and public.studio_upload_ok((storage.foldername(name))[2]));

-- המנהלת רואה את הקבצים שהועלו (לתצוגה בסטודיו)
drop policy if exists "media: admin reads inbox" on storage.objects;
create policy "media: admin reads inbox" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'inbox' and (select public.is_admin()));
