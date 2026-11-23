# Test results

## Test 3: same webhook delivered more than once
Method: signed `payment.captured` events sent with `scripts/send-webhook.mjs`
(simulated payment id `pay_test_0001`; not a real Razorpay payment).

First delivery:
```
200 {"ok":true}
```
Same event id delivered again:
```
200 {"ok":true,"duplicate":true}
```
Result: one row in `webhook_events`, one row in `enrollments` for that student and course.

## Test 7: 100 concurrent simulated purchase/enrollment requests

Command: `node --env-file=.env scripts/load-test.mjs` (local Next.js dev server, Supabase free tier)

Simulated: 100 students whose payments confirm at the same moment, plus 40 concurrent
deliveries for one student (20 identical, 20 with different event ids) and one student
paying twice for the same course. Signed `payment.captured` webhooks were sent to the real
endpoint; students and unpaid payment rows were created directly in the database.
Not simulated: real Razorpay payments, the checkout popup, Razorpay's delivery timing and
retry schedule, the create-order route, or real browser sessions.

Results (142 requests, 3.9 s burst):
- First-attempt failures: 0
- All 8 database checks passed (100/100 paid, 100/100 with exactly one active enrollment,
  no cross-student enrollment, hot student 1 enrollment, double purchase 1 active enrollment
  with the second payment flagged needs_review, one audit row per student,
  123 event rows for 123 distinct event ids, no event left unprocessed)
- Duplicates acknowledged without reprocessing: [number from the JSON file]
- Latency p50 / p95: about 3.0 s / 3.7 s. This is a local dev server handling 142
  simultaneous requests, so it reflects queueing, not production performance.

Raw output: `docs/load-test-results.json`

## Database rebuild check
Ran `0001_init.sql` to `0004_admin_actions.sql` and `seed.sql` on a new empty Supabase project, then
`supabase/tests/schema_check.sql`: 21/21 checks passed (signup trigger, idempotent payment fulfillment,
duplicate-enrollment rejection, partial unique index, webhook event uniqueness, admin revoke/restore with audit,
grants, row-level security for enrolled and non-enrolled students). The script runs inside one transaction that is
rolled back on purpose, so it leaves no data behind.