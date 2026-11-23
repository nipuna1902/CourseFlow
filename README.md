# CourseFlow

A course purchase and enrollment system: a student pays with Razorpay (Test Mode) and gets access
only after the payment is verified on the server. It is built to stay correct when requests are
repeated, delayed or concurrent.

- **Live app:** [https://course-flow-beta.vercel.app]
- **Repository:** [https://github.com/nipuna1902/CourseFlow]
- **Walkthrough video:** [LINK]
- **Test evidence:** [docs/test-results.md](docs/test-results.md) and [docs/load-test-results.json](docs/load-test-results.json)

Demo student and admin logins are in the submission message, not in this public file.
Pay with Razorpay's test-mode card or UPI details (see Razorpay's docs). No real money moves.

## Stack
Next.js 16 (App Router) · Tailwind CSS · Supabase Auth + PostgreSQL (RLS) · Razorpay Test Mode · Vercel

## What it does
**Student:** register and sign in, browse courses, buy, see My Courses with access status,
see payment history, open lessons (only with an active enrollment).

**Admin (`/admin`):** payments split by status (successful, pending, failed/cancelled, not completed),
enrollments, students, courses, a per-student access view, revoke/restore with a reason (recorded in
an audit log), a "Needs attention" view (stuck payments, duplicate purchases, failed or repeated
webhook events), and a "Re-check with Razorpay" recovery button.

## Run locally
Needs Node 20.6+, a Supabase project and a Razorpay account in Test Mode.

1. `git clone` the repo, then `npm install`
2. Copy `.env.example` to `.env` and fill in the values below
3. In the Supabase SQL Editor run, in order: `supabase/migrations/0001_init.sql`, `0002_grants.sql`,
   `0003_payment_fixes.sql`, `0004_admin_actions.sql`, `0005_seed.sql`
4. Supabase → Authentication → Providers → Email: turn **Confirm email** off (demo convenience)
5. `npm run dev` and open http://localhost:3000
6. Make an admin: register, then run
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');`

Razorpay cannot reach localhost, so locally the webhook is simulated:
`node --env-file=.env scripts/send-webhook.mjs <order_id> <payment_id> [event_id] [event_type]`

## Environment variables
| Name | Used by | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | no (RLS protects data) |
| `SUPABASE_SECRET_KEY` | server only (bypasses RLS) | **yes** |
| `RAZORPAY_KEY_ID` | server (must start with `rzp_test_`, enforced in code) | no |
| `RAZORPAY_KEY_SECRET` | server | **yes** |
| `RAZORPAY_WEBHOOK_SECRET` | server; the same value goes in the Razorpay dashboard | **yes** |

## Deploy
1. Push to GitHub and import the repo in Vercel.
2. Add the six variables above in Vercel → Settings → Environment Variables, then deploy.
3. Supabase → Authentication → URL Configuration: set the Site URL to the Vercel address.
4. Razorpay dashboard (Test Mode) → Settings → Webhooks: add
   `https://<your-app>.vercel.app/api/webhooks/razorpay`, set the same secret as
   `RAZORPAY_WEBHOOK_SECRET`, and enable `payment.captured`, `payment.failed`,
   `payment.authorized`, `order.paid`. Set payment capture to **automatic**.
5. Smoke test: register, buy with a test payment, confirm the course shows as enrolled.

## How a purchase works
1. **Create order** `POST /api/payments/create-order`: verifies the session, reads the price from
   the database (never from the browser), refuses if the student already owns the course, creates the
   Razorpay order, and stores a `payments` row (`created`) holding the order id.
2. **Checkout** runs in Razorpay's popup. The browser's "success" callback is only a hint.
3. **Verify** `POST /api/payments/verify`: recomputes HMAC-SHA256 of `order_id|payment_id` with the key
   secret and compares in constant time. The order must belong to the signed-in student. Then it calls `fulfill_payment`.
4. **Webhook** `POST /api/webhooks/razorpay`: verifies the signature over the **raw body** with the webhook
   secret, then records the event id in `webhook_events` (unique). A repeated event id is acknowledged and
   ignored. `payment.captured` / `order.paid` call `fulfill_payment`; `payment.authorized` sets `pending`;
   `payment.failed` sets `failed` but never overwrites a paid payment.
5. **`fulfill_payment(order_id, payment_id)`** is one database transaction: it locks the payment row
   (`FOR UPDATE`), marks it paid, inserts the enrollment with `ON CONFLICT DO NOTHING`, and writes an audit row.
   The verify route and the webhook both call it, so whichever arrives first wins and the rest change nothing.

| Payment status | Meaning | Grants access? |
|---|---|---|
| `created` | order made, checkout opened | no |
| `pending` | authorized or verified, enrollment not finished | no |
| `paid` | confirmed by a signature-checked path | yes |
| `failed` / `cancelled` | declined / popup closed | no |

## Preventing duplicates and races
- Partial unique index: **one `active` enrollment per (student, course)**. Revoked rows don't count,
  so revoke, restore and re-purchase all work.
- Unique index: one enrollment per payment. Unique `razorpay_order_id` and `razorpay_payment_id`.
- Unique `webhook_events.razorpay_event_id`: the database decides whether an event was already seen.
- Row lock inside `fulfill_payment`: simultaneous calls for the same order queue up.
- A student who pays twice for one course gets one enrollment; the second payment is recorded and flagged
  `needs_review` (refund is a manual step in Razorpay).

## If payment succeeds but enrollment fails
`fulfill_payment` is atomic, so the database never ends up half done. If it fails, the payment stays
unpaid in our database (or `pending` when the verify route had already seen a valid signature) while the
money is taken at Razorpay. Recovery:
1. Razorpay retries the webhook until it gets a 2xx, and the retry runs the same function.
2. Failures are written to `webhook_events` (status `failed` plus the error).
3. The admin **Needs attention** tab lists stuck payments, with a **Re-check with Razorpay** button that fetches
   the order's payments from Razorpay's API and runs the same idempotent function.

## Access control
- Every protected page and API route verifies the user with `getClaims()` on the server. Admin status is read
  from `profiles.role` in the database, and `/admin` returns 404 to everyone else.
- Row Level Security is on for every table. Students have **read-only** access to their own rows and no write
  policy anywhere; all writes go through server code using the secret key, after the checks above.
- `course_lessons` has an RLS policy that only returns rows when the student has an active enrollment.
- `fulfill_payment` and `admin_set_enrollment_status` can only be executed by the server's service role.

## Database
`profiles` (role) · `courses` · `course_lessons` · `payments` · `enrollments` · `enrollment_audit`
(grant/revoke/restore history with the acting admin) · `webhook_events`. Payments and enrollments are
separate tables linked by `enrollments.payment_id`, so money and access can be audited independently.

## Tests
| # | Scenario | Result |
|---|---|---|
| 1 | Student completes a test payment and gets access | [pass] |
| 2 | Failed or cancelled payment grants nothing | [pass] |
| 3 | Same webhook delivered more than once: one enrollment | [pass] |
| 4 | Repeated purchase requests: no duplicate active enrollment | [pass] |
| 5 | Two students buy the same course: each gets their own access | [pass] |
| 6 | Student without enrollment is denied | [pass] |
| 7 | 100 concurrent simulated requests | [pass: 8/8 checks, N failures] |

Details and raw output are in `docs/`. Scripts: `scripts/send-webhook.mjs` (signed single event) and
`scripts/load-test.mjs` (`... load-test.mjs cleanup` removes its test users).

**What test 7 simulates:** 100 students whose payments confirm at the same moment, plus 40 concurrent
deliveries for one student and one student paying twice, sent as correctly signed webhooks to the real endpoint.
Students and unpaid payments are created directly in the database. Signature checks, deduplication, locking,
`fulfill_payment` and the unique indexes all run for real. **What it does not simulate:** real Razorpay payments or
the checkout popup, Razorpay's real delivery timing and retry schedule, the create-order endpoint, or 100 real
browser sessions. Results reflect a free-tier database.

## Decisions and limitations
- Every Buy click creates a new Razorpay order (Razorpay's docs disagree on reusing an order after a failure).
- A student whose access was revoked can buy the course again.
- Email confirmation is off for the demo. There are no refunds, coupons or email notifications.
- Admin lists are capped (200 users, 200 enrollments, 500 payments).
- Cache Components is disabled: every page is per-user and must never be cached or shared.

## AI and tools
I used Claude (Anthropic) throughout: for discussing the design, drafting the
schema and SQL functions, the API routes, the admin pages and the test scripts, and for debugging. I ran, tested
and reviewed the code, and fixed mismatches between the drafts and my actual database. Docs used: Razorpay,
Supabase and Next.js.