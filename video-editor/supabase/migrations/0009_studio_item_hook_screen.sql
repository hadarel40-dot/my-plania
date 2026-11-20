-- ההוק שהיא בחרה בהצעה: גם השורה על המסך, כדי שהטיוטה האוטומטית תשתמש בו
alter table public.studio_items add column if not exists hook_screen text not null default '';

create or replace function public.studio_cron_context(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.studio_cron_ok(p_secret) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'account', account, 'niche', niche, 'format', format, 'stage', stage,
      'planned_date', planned_date, 'notes', notes, 'auto', auto, 'draft_id', draft_id, 'created_at', created_at, 'hook', hook, 'hook_screen', hook_screen))
      from (select * from public.studio_items order by created_at desc limit 300) i), '[]'::jsonb),
    'voice', coalesce((select jsonb_object_agg(account, profile) from public.studio_voice), '{}'::jsonb),
    'trends', coalesce((select items from public.studio_trends where status = 'done' order by date desc limit 1), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'text', text, 'verdict', verdict, 'reason', reason))
      from (select * from public.studio_feedback order by created_at desc limit 60) f), '[]'::jsonb),
    'suggested', coalesce((select jsonb_agg(title) from (select title from public.studio_suggestions order by created_at desc limit 60) s), '[]'::jsonb),
    'open_suggestions', (select count(*) from public.studio_suggestions where status = 'new')
  );
end $$;
