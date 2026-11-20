-- סטודיו התוכן: הצעות שהסטודיו מביא בעצמו (רעיון והוקים), ומה שהיא אהבה ולא אהבה, כדי ללמוד ממנו.

create table public.studio_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  idea text not null default '',
  why text not null default '',
  account text not null check (account in ('hadarelifergan', 'plania.il')),
  niche text,
  format text not null default 'reel' check (format in ('reel', 'carousel', 'story', 'image')),
  hooks jsonb not null default '[]'::jsonb,
  source text not null default 'studio' check (source in ('studio', 'trend', 'inspiration', 'advisor')),
  source_url text,
  source_note text,
  status text not null default 'new' check (status in ('new', 'saved', 'dismissed')),
  item_id uuid references public.studio_items (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.studio_feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('idea', 'hook')),
  text text not null,
  verdict text not null check (verdict in ('like', 'dislike')),
  reason text,
  account text,
  created_at timestamptz not null default now()
);

alter table public.studio_suggestions enable row level security;
alter table public.studio_feedback enable row level security;
create policy "admin only" on public.studio_suggestions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin only" on public.studio_feedback for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- המשימה של הבוקר יודעת גם מה היא אהבה, ואילו הצעות כבר הוצעו
create or replace function public.studio_cron_context(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'account', account, 'niche', niche, 'format', format, 'stage', stage,
      'planned_date', planned_date, 'notes', notes, 'auto', auto, 'draft_id', draft_id, 'created_at', created_at))
      from (select * from public.studio_items order by created_at desc limit 300) i), '[]'::jsonb),
    'voice', coalesce((select jsonb_object_agg(account, profile) from public.studio_voice), '{}'::jsonb),
    'trends', coalesce((select items from public.studio_trends where status = 'done' order by date desc limit 1), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'text', text, 'verdict', verdict, 'reason', reason))
      from (select * from public.studio_feedback order by created_at desc limit 60) f), '[]'::jsonb),
    'suggested', coalesce((select jsonb_agg(title) from (select title from public.studio_suggestions order by created_at desc limit 60) s), '[]'::jsonb),
    'open_suggestions', (select count(*) from public.studio_suggestions where status = 'new')
  );
end $$;

-- הצעות חדשות מהבוקר
create or replace function public.studio_cron_add_suggestions(p_secret text, p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  insert into public.studio_suggestions (title, idea, why, account, niche, format, hooks, source, source_url)
  select left(x->>'title', 200), left(coalesce(x->>'idea', ''), 2000), left(coalesce(x->>'why', ''), 1000), x->>'account', x->>'niche',
    coalesce(x->>'format', 'reel'), coalesce(x->'hooks', '[]'::jsonb), coalesce(x->>'source', 'studio'), x->>'source_url'
  from jsonb_array_elements(p_items) x
  limit 10;
  get diagnostics n = row_count;
  return n;
end $$;

-- טיוטה לפריט שהיא שמרה ושיבצה: נשאר בתאריך שהיא בחרה
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
  update public.studio_items set draft_id = new_id, stage = 'draft', planned_date = coalesce(planned_date, p_planned),
    hook = left(coalesce(p_draft->>'hook', ''), 500), caption = left(coalesce(p_draft->>'caption', ''), 4000)
  where id = p_item_id;
  return new_id;
end $$;

revoke all on function public.studio_cron_add_suggestions(text, jsonb) from public;
grant execute on function public.studio_cron_add_suggestions(text, jsonb) to anon, authenticated;
