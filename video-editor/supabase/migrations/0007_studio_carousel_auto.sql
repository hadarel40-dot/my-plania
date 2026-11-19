-- סטודיו התוכן: קרוסלות, ותוכן אוטומטי כל בוקר (רעיונות וטיוטות שמשובצים בימים פנויים).
-- שום דבר כאן לא מפרסם. המשימה האוטומטית נוגעת רק בפריטים שהיא עצמה יצרה (auto = true).

alter table public.studio_drafts drop constraint if exists studio_drafts_mode_check;
alter table public.studio_drafts add constraint studio_drafts_mode_check check (mode in ('full', 'short', 'carousel'));

alter table public.studio_items add column if not exists auto boolean not null default false;

-- כל מה שהמשימה האוטומטית צריכה לדעת: הלוח, הקול והטרנדים האחרונים
create or replace function public.studio_cron_context(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'account', account, 'niche', niche, 'format', format, 'stage', stage,
      'planned_date', planned_date, 'notes', notes, 'auto', auto, 'draft_id', draft_id, 'created_at', created_at))
      from (select * from public.studio_items order by created_at desc limit 300) i), '[]'::jsonb),
    'voice', coalesce((select jsonb_object_agg(account, profile) from public.studio_voice), '{}'::jsonb),
    'trends', coalesce((select items from public.studio_trends where status = 'done' order by date desc limit 1), '[]'::jsonb)
  );
end $$;

-- רעיונות חדשים לתור (מסומנים auto)
create or replace function public.studio_cron_add_items(p_secret text, p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  insert into public.studio_items (title, account, niche, format, stage, notes, auto)
  select left(x->>'title', 200), x->>'account', x->>'niche', coalesce(x->>'format', 'reel'), 'idea', left(coalesce(x->>'notes', ''), 4000), true
  from jsonb_array_elements(p_items) x
  limit 10;
  get diagnostics n = row_count;
  return n;
end $$;

-- טיוטה לרעיון אוטומטי: נוצרת, מקושרת, עוברת ל"טיוטה" ומשובצת ביום פנוי. רק לפריט שנוצר אוטומטית
create or replace function public.studio_cron_add_draft(p_secret text, p_item_id uuid, p_draft jsonb, p_planned date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.studio_items where id = p_item_id and auto and stage = 'idea' and studio_items.draft_id is null) then
    raise exception 'item is not an open automatic idea';
  end if;
  insert into public.studio_drafts (idea, account, niche, mode, facts, data)
  values (p_draft->>'idea', p_draft->>'account', p_draft->>'niche', p_draft->>'mode', '', coalesce(p_draft->'data', '{}'::jsonb))
  returning id into new_id;
  update public.studio_items set draft_id = new_id, stage = 'draft', planned_date = p_planned,
    hook = left(coalesce(p_draft->>'hook', ''), 500), caption = left(coalesce(p_draft->>'caption', ''), 4000)
  where id = p_item_id;
  return new_id;
end $$;

revoke all on function public.studio_cron_context(text) from public;
revoke all on function public.studio_cron_add_items(text, jsonb) from public;
revoke all on function public.studio_cron_add_draft(text, uuid, jsonb, date) from public;
grant execute on function public.studio_cron_context(text) to anon, authenticated;
grant execute on function public.studio_cron_add_items(text, jsonb) to anon, authenticated;
grant execute on function public.studio_cron_add_draft(text, uuid, jsonb, date) to anon, authenticated;
