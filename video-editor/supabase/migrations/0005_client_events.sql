-- יומן אירועים מהדפדפן (שלבי העלאה ושגיאות), כדי לאבחן תקלות שקורות רק בטלפון.
-- המשתמש יכול רק להוסיף שורות על עצמו; קריאה רק מצד השרת/הניהול.
create table public.client_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  event text not null check (char_length(event) <= 64),
  detail jsonb not null default '{}'::jsonb check (octet_length(detail::text) <= 4000),
  user_agent text check (char_length(user_agent) <= 400)
);
alter table public.client_events enable row level security;
create policy "insert own events" on public.client_events
  for insert to authenticated with check (user_id = (select auth.uid()));
create index client_events_user_created on public.client_events (user_id, created_at desc);
