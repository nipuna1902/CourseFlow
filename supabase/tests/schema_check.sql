--ran this to ensure and keep clean sql files for the repo 
do $$
declare
  u1 uuid := gen_random_uuid();   -- student who buys
  u2 uuid := gen_random_uuid();   -- second student
  u3 uuid := gen_random_uuid();   -- admin
  u4 uuid := gen_random_uuid();   -- student who never buys
  c  uuid;
  e1 uuid;
  e2 uuid;
  e_extra uuid;
  r  uuid;
  n  int;
  m  int;
  ok boolean;
  s  text;
  report text := E'\n';
begin
  select id into c from public.courses order by created_at limit 1;
  if c is null then raise exception 'No courses found: did you run seed.sql?'; end if;

  -- 4 users; the signup trigger should create their profiles
  insert into auth.users (id, email) values
    (u1, 'sqlcheck1@test.dev'), (u2, 'sqlcheck2@test.dev'),
    (u3, 'sqlcheck3@test.dev'), (u4, 'sqlcheck4@test.dev');
  update public.profiles set role = 'admin' where id = u3;

  select count(*) into n from public.profiles where id in (u1, u2, u3, u4);
  report := report || case when n = 4 then 'PASS' else 'FAIL' end
    || '  signup trigger created the profiles' || E'\n';

  insert into public.payments (user_id, course_id, amount_paise, razorpay_order_id) values
    (u1, c, 100, 'order_sqlcheck_1'),
    (u1, c, 100, 'order_sqlcheck_1b'),
    (u2, c, 100, 'order_sqlcheck_2');

  -- 1. a verified payment creates one active enrollment
  e1 := public.fulfill_payment('order_sqlcheck_1', 'pay_sqlcheck_1');
  select count(*) into n from public.enrollments where user_id = u1 and status = 'active';
  report := report || case when e1 is not null and n = 1 then 'PASS' else 'FAIL' end
    || '  verified payment created exactly one active enrollment' || E'\n';

  -- 2. the same confirmation again changes nothing
  r := public.fulfill_payment('order_sqlcheck_1', 'pay_sqlcheck_1');
  select count(*) into n from public.enrollments where user_id = u1;
  report := report || case when r = e1 and n = 1 then 'PASS' else 'FAIL' end
    || '  repeating the same confirmation returned the same enrollment, still 1 row' || E'\n';

  select count(*) into n from public.enrollment_audit where student_id = u1 and action = 'granted';
  report := report || case when n = 1 then 'PASS' else 'FAIL' end
    || '  only one "granted" audit row was written' || E'\n';

  -- 3. paying twice for the same course
  r := public.fulfill_payment('order_sqlcheck_1b', 'pay_sqlcheck_1b');
  select count(*) into n from public.enrollments where user_id = u1 and status = 'active';
  select (status = 'paid' and needs_review) into ok
    from public.payments where razorpay_order_id = 'order_sqlcheck_1b';
  report := report || case when n = 1 and r is null and ok then 'PASS' else 'FAIL' end
    || '  paying twice: still 1 active enrollment, second payment flagged needs_review' || E'\n';

  -- 4. a second student gets their own enrollment
  e2 := public.fulfill_payment('order_sqlcheck_2', 'pay_sqlcheck_2');
  select count(*) into n
    from public.enrollments en join public.payments p on p.id = en.payment_id
    where en.id = e2 and en.user_id = u2 and p.user_id = u2;
  report := report || case when n = 1 then 'PASS' else 'FAIL' end
    || '  second student got their own enrollment, linked to their own payment' || E'\n';

  -- 5. the database itself refuses a second active enrollment
  begin
    insert into public.enrollments (user_id, course_id, status) values (u1, c, 'active');
    report := report || 'FAIL  a second active enrollment was allowed' || E'\n';
  exception when unique_violation then
    report := report || 'PASS  database rejected a second active enrollment for the same student and course' || E'\n';
  end;

  -- 6. but a revoked row may sit next to an active one
  begin
    insert into public.enrollments (user_id, course_id, status, revoked_at)
      values (u1, c, 'revoked', now()) returning id into e_extra;
    report := report || 'PASS  a revoked enrollment can coexist with an active one' || E'\n';
  exception when others then
    report := report || 'FAIL  revoked row was rejected: ' || sqlerrm || E'\n';
  end;

  -- 7. duplicate webhook event id
  insert into public.webhook_events (razorpay_event_id, event_type, payload)
    values ('evt_sqlcheck_1', 'payment.captured', '{}');
  begin
    insert into public.webhook_events (razorpay_event_id, event_type, payload)
      values ('evt_sqlcheck_1', 'payment.captured', '{}');
    report := report || 'FAIL  duplicate webhook event id was accepted' || E'\n';
  exception when unique_violation then
    report := report || 'PASS  duplicate webhook event id rejected' || E'\n';
  end;

  -- 8. admin revoke / restore
  s := public.admin_set_enrollment_status(e1, u3, 'revoked', 'sql check');
  select count(*) into n from public.enrollment_audit
    where enrollment_id = e1 and action = 'revoked' and admin_id = u3;
  report := report || case when s = 'revoked' and n = 1 then 'PASS' else 'FAIL' end
    || '  admin revoke changed the status and wrote one audit row' || E'\n';

  s := public.admin_set_enrollment_status(e1, u3, 'revoked', 'sql check');
  select count(*) into n from public.enrollment_audit where enrollment_id = e1 and action = 'revoked';
  report := report || case when s = 'already_revoked' and n = 1 then 'PASS' else 'FAIL' end
    || '  revoking twice did nothing (no extra audit row)' || E'\n';

  begin
    s := public.admin_set_enrollment_status(e1, u1, 'restored', null);
    report := report || 'FAIL  a non-admin was allowed to restore access' || E'\n';
  exception when others then
    report := report || case when sqlerrm like '%not_admin%' then 'PASS' else 'FAIL' end
      || '  non-admin cannot change access' || E'\n';
  end;

  s := public.admin_set_enrollment_status(e1, u3, 'restored', 'sql check');
  report := report || case when s = 'restored' then 'PASS' else 'FAIL' end
    || '  admin restore works' || E'\n';

  begin
    s := public.admin_set_enrollment_status(e_extra, u3, 'restored', 'sql check');
    report := report || 'FAIL  restore created a second active enrollment' || E'\n';
  exception when others then
    report := report || case when sqlerrm like '%already_has_active_enrollment%' then 'PASS' else 'FAIL' end
      || '  restore refused when the student already has an active enrollment' || E'\n';
  end;

  -- 9. who may do what (grants)
  report := report || case when
      has_table_privilege('service_role', 'public.webhook_events', 'insert')
      and has_table_privilege('service_role', 'public.payments', 'update')
      and has_table_privilege('service_role', 'public.enrollments', 'insert')
    then 'PASS' else 'FAIL' end || '  server role (service_role) can write to the tables' || E'\n';

  report := report || case when
      not has_table_privilege('authenticated', 'public.payments', 'insert,update,delete')
      and not has_table_privilege('authenticated', 'public.enrollments', 'insert,update,delete')
      and not has_table_privilege('anon', 'public.enrollments', 'insert,update,delete')
    then 'PASS' else 'FAIL' end || '  students and visitors have no write permission on payments/enrollments' || E'\n';

  report := report || case when
      not has_function_privilege('authenticated', 'public.fulfill_payment(text,text)', 'execute')
      and not has_function_privilege('anon', 'public.fulfill_payment(text,text)', 'execute')
    then 'PASS' else 'FAIL' end || '  students cannot call fulfill_payment' || E'\n';

  -- 10. row level security, acting as a logged-in student
  perform set_config('request.jwt.claims',
    json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.course_lessons where course_id = c;
  select count(*) into m from public.payments;
  reset role;
  report := report || case when n > 0 then 'PASS' else 'FAIL' end
    || '  enrolled student can read the lessons' || E'\n';
  report := report || case when m = 1 then 'PASS' else 'FAIL' end
    || '  student sees only their own payment rows (saw ' || m || ')' || E'\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub', u4, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.course_lessons where course_id = c;
  select count(*) into m from public.enrollments;
  reset role;
  report := report || case when n = 0 then 'PASS' else 'FAIL' end
    || '  student without enrollment sees 0 lessons' || E'\n';
  report := report || case when m = 0 then 'PASS' else 'FAIL' end
    || '  student sees none of the other students enrollments' || E'\n';

  raise exception E'SQL CHECK REPORT (rolled back, nothing was saved)\n%', report;
end $$;