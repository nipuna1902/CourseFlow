-- 0002_grants.sql
-- Who may touch which table. Supabase does not grant table access by default,
-- so every permission is listed explicitly.

-- Public catalogue: anyone may read (row-level policies still limit this to published courses)
grant select on public.courses to anon, authenticated;

-- Logged-in students: read-only. Row-level security limits them to their own rows.
-- They get NO insert/update/delete anywhere; all writes go through the server.
grant select on public.enrollments    to authenticated;
grant select on public.payments       to authenticated;
grant select on public.profiles       to authenticated;
grant select on public.course_lessons to authenticated;

-- Remove permissions nobody needs (least privilege)
revoke references, trigger, truncate on
  public.enrollments, public.payments, public.profiles, public.course_lessons,
  public.enrollment_audit, public.webhook_events, public.courses
from anon, authenticated;

-- Server side (the secret key runs as service_role): full access, including future tables
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- make the API pick up the changes
notify pgrst, 'reload schema';