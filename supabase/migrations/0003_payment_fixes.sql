-- 0003_payment_fixes.sql
-- Changes applied after the initial tables: extra columns, duplicate-protection
-- indexes, the idempotent fulfill_payment function, and role permissions.

-- 1. columns the payment flow needs
alter table public.payments
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists needs_review boolean not null default false,
  add column if not exists failure_reason text;

alter table public.enrollments
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'purchase';

-- 2. duplicate protection, enforced by the database
create unique index if not exists payments_order_id_uidx
  on public.payments (razorpay_order_id);

create unique index if not exists payments_payment_id_uidx
  on public.payments (razorpay_payment_id) where razorpay_payment_id is not null;

-- at most ONE active enrollment per student per course
create unique index if not exists one_active_enrollment_per_course
  on public.enrollments (user_id, course_id) where status = 'active';

-- one payment can create at most one enrollment
create unique index if not exists one_enrollment_per_payment
  on public.enrollments (payment_id) where payment_id is not null;

-- 3. webhook event log: one row per Razorpay event id
alter table public.webhook_events
  alter column id          set default gen_random_uuid(),
  alter column status      set default 'received',
  alter column attempts    set default 1,
  alter column received_at set default now();

create unique index if not exists webhook_events_event_id_uidx
  on public.webhook_events (razorpay_event_id);

-- 4. idempotent fulfillment: called by BOTH the verify route and the webhook
drop function if exists public.fulfill_payment(uuid);

create or replace function public.fulfill_payment(p_order_id text, p_payment_id text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_payment       payments%rowtype;
  v_enrollment_id uuid;
begin
  -- lock this payment row: simultaneous calls for the same order queue up here
  select * into v_payment
  from payments where razorpay_order_id = p_order_id
  for update;

  if not found then
    raise exception 'payment_not_found: %', p_order_id;
  end if;

  update payments
     set status = 'paid',
         razorpay_payment_id = coalesce(razorpay_payment_id, p_payment_id),
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where id = v_payment.id and status <> 'paid';

  insert into enrollments (user_id, course_id, payment_id, source, status)
  values (v_payment.user_id, v_payment.course_id, v_payment.id, 'purchase', 'active')
  on conflict do nothing
  returning id into v_enrollment_id;

  if v_enrollment_id is not null then
    insert into enrollment_audit (enrollment_id, student_id, course_id, admin_id, action, reason)
    values (v_enrollment_id, v_payment.user_id, v_payment.course_id, null, 'granted', 'payment verified');
    return v_enrollment_id;
  end if;

  -- nothing inserted: a repeat of the same payment, or the student already had access
  select id into v_enrollment_id from enrollments where payment_id = v_payment.id;
  if v_enrollment_id is null then
    update payments set needs_review = true where id = v_payment.id;
  end if;
  return v_enrollment_id;
end $$;

revoke execute on function public.fulfill_payment(text, text) from public, anon, authenticated;
grant execute on function public.fulfill_payment(text, text) to service_role;

notify pgrst, 'reload schema';