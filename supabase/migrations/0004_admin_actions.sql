-- Revoke or restore access in ONE transaction: the status change and the audit row
-- either both happen or neither does.

create or replace function public.admin_set_enrollment_status(
  p_enrollment_id uuid,
  p_admin_id      uuid,
  p_action        text,   -- 'revoked' or 'restored'
  p_reason        text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_enr enrollments%rowtype;
begin
  if p_action not in ('revoked', 'restored') then
    raise exception 'invalid_action';
  end if;

  -- second check: only a real admin may run this, even if the caller is buggy
  if not exists (select 1 from profiles where id = p_admin_id and role = 'admin') then
    raise exception 'not_admin';
  end if;

  select * into v_enr from enrollments where id = p_enrollment_id for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;

  if p_action = 'revoked' then
    if v_enr.status = 'revoked' then return 'already_revoked'; end if;   -- double click: no change, no audit row
    update enrollments set status = 'revoked', revoked_at = now() where id = v_enr.id;
  else
    if v_enr.status = 'active' then return 'already_active'; end if;
    begin
      update enrollments set status = 'active', revoked_at = null where id = v_enr.id;
    exception when unique_violation then
      -- the partial unique index: the student already has another active enrollment
      raise exception 'already_has_active_enrollment';
    end;
  end if;

  insert into enrollment_audit (enrollment_id, student_id, course_id, admin_id, action, reason)
  values (v_enr.id, v_enr.user_id, v_enr.course_id, p_admin_id, p_action,
          nullif(trim(coalesce(p_reason, '')), ''));

  return p_action;
end $$;

revoke execute on function public.admin_set_enrollment_status(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_enrollment_status(uuid, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';