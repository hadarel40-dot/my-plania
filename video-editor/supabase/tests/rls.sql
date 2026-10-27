-- בדיקת בידוד בין משתמשים. כל בדיקה שנכשלת זורקת שגיאה.
grant select, insert, update, delete on public.projects, public.variant_jobs to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.projects (title, doc) values ('של אליס', '{"timeline":{}}');
insert into storage.objects (bucket_id, name) values ('media', '11111111-1111-1111-1111-111111111111/a.mp4');

do $$ begin
  -- owner_id מתמלא אוטומטית מה-JWT
  if (select owner_id from public.projects limit 1) <> '11111111-1111-1111-1111-111111111111' then raise exception 'owner_id default'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('media', '22222222-2222-2222-2222-222222222222/x.mp4');
    raise exception 'FAIL: uploaded into another user folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.projects (owner_id, title) values ('22222222-2222-2222-2222-222222222222', 'זיוף');
    raise exception 'FAIL: inserted project for another user';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.projects) <> 0 then raise exception 'FAIL: bob sees alice projects'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'FAIL: bob sees alice files'; end if;
  update public.projects set title = 'נפרץ';
  delete from public.projects;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ declare t timestamptz; begin
  if (select title from public.projects) <> 'של אליס' then raise exception 'FAIL: bob changed alice project'; end if;
  t := (select updated_at from public.projects);
  perform pg_sleep(0.01);
  update public.projects set title = 'חדש';
  if (select updated_at from public.projects) = t then raise exception 'FAIL: updated_at not touched'; end if;
end $$;

-- ב-Supabase ל-anon יש הרשאות טבלה כברירת מחדל; רק RLS מגן
reset role;
grant select, insert, update, delete on public.projects, storage.objects to anon;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.projects) <> 0 then raise exception 'FAIL: anon reads projects'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'FAIL: anon reads files'; end if;
  begin
    insert into public.projects (title) values ('anon');
    raise exception 'FAIL: anon inserted a project';
  exception when insufficient_privilege or not_null_violation then null; end;
end $$;
reset role;
select 'ALL RLS TESTS PASSED' as result;

-- variant_jobs: אפשר ליצור עבודה רק לפרויקט שלך, ולראות רק את שלך
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.variant_jobs (project_id, variant_id, model, input)
  select id, 'var_a', 'm', '{}' from public.projects limit 1;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.variant_jobs) <> 0 then raise exception 'FAIL: bob sees alice jobs'; end if;
  begin
    insert into public.variant_jobs (project_id, variant_id, model, input)
      values ((select id from public.projects limit 1), 'x', 'm', '{}');
    raise exception 'FAIL: bob created a job on a project he cannot see';
  exception when insufficient_privilege or not_null_violation then null; end;
  update public.variant_jobs set status = 'failed';
end $$;
reset role;
do $$ begin
  if (select status from public.variant_jobs) <> 'queued' then raise exception 'FAIL: bob changed alice job'; end if;
end $$;
select 'ALL VARIANT_JOBS TESTS PASSED' as result;
