-- is_admin() is used by the RLS policies but should not be callable through the public API.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
