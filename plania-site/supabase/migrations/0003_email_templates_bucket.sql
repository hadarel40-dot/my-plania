-- Private bucket for the compiled email templates (supabase/templates/*.html). Only the server reads it.
insert into storage.buckets (id, name, public) values ('templates', 'templates', false) on conflict do nothing;
