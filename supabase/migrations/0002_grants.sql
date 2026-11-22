grant select on public.enrollments    to authenticated;
grant select on public.payments       to authenticated;
grant select on public.profiles       to authenticated;
grant select on public.course_lessons to authenticated;

notify pgrst, 'reload schema';

revoke references, trigger, truncate on
  public.enrollments, public.payments, public.profiles, public.course_lessons,
  public.enrollment_audit, public.webhook_events, public.courses
from anon, authenticated;