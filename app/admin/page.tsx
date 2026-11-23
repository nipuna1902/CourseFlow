import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  Badge, Section, Table, Empty, Shell, EnrollmentActions, RecheckButton,
  emailMap, fmt, rupees, td,
} from '@/components/admin'

const TAB_KEYS = ['payments', 'enrollments', 'students', 'courses', 'attention']

type Ctx = { who: (id: string) => string; title: Map<string, string>; returnTo: string }

const studentLink = (id: string, who: (id: string) => string) => (
  <Link href={`/admin/students/${id}`} className="underline">{who(id)}</Link>
)

/* ---------- payments: successful / pending / failed shown separately ---------- */
async function PaymentsTab({ who, title }: Ctx) {
  const { data } = await supabaseAdmin
    .from('payments').select('*').order('created_at', { ascending: false }).limit(500)
  const rows = data ?? []

  const groups: [string, string, any[]][] = [
    ['Successful', 'Confirmed through a signature-checked path (verify route or webhook).', rows.filter((p) => p.status === 'paid')],
    ['Pending', 'Verified or authorized, but enrollment is not finished yet.', rows.filter((p) => p.status === 'pending')],
    ['Failed or cancelled', 'No access was granted.', rows.filter((p) => p.status === 'failed' || p.status === 'cancelled')],
    ['Not completed', 'Checkout was opened but nothing was confirmed.', rows.filter((p) => p.status === 'created')],
  ]

  return (
    <>
      {groups.map(([name, note, list]) => (
        <Section key={name} title={name} count={list.length} note={note}>
          {list.length === 0 ? (
            <Empty />
          ) : (
            <>
              <Table head={['Date', 'Student', 'Course', 'Amount', 'Status', 'Order id', 'Notes']}>
                {list.slice(0, 50).map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{fmt(p.created_at)}</td>
                    <td className={td}>{studentLink(p.user_id, who)}</td>
                    <td className={td}>{title.get(p.course_id) ?? '—'}</td>
                    <td className={td}>{rupees(p.amount_paise)}</td>
                    <td className={td}><Badge value={p.status} /></td>
                    <td className={`${td} font-mono text-xs`}>{p.razorpay_order_id}</td>
                    <td className={td}>
                      {p.needs_review && <Badge value="duplicate purchase" />} {p.failure_reason}
                    </td>
                  </tr>
                ))}
              </Table>
              {list.length > 50 && (
                <p className="mt-2 text-xs text-[#949189]">Showing the newest 50 of {list.length}.</p>
              )}
            </>
          )}
        </Section>
      ))}
    </>
  )
}

/* ---------- enrollments with revoke / restore ---------- */
async function EnrollmentsTab({ who, title, returnTo }: Ctx) {
  const { data } = await supabaseAdmin
    .from('enrollments').select('*').order('enrolled_at', { ascending: false }).limit(200)
  const rows = data ?? []

  return (
    <Section
      title="Enrollments"
      count={rows.length}
      note="Revoke or restore access. Every action is recorded in the audit log."
    >
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Table head={['Student', 'Course', 'Status', 'Source', 'Enrolled', 'Revoked', 'Action']}>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={td}>{studentLink(e.user_id, who)}</td>
              <td className={td}>{title.get(e.course_id) ?? '—'}</td>
              <td className={td}><Badge value={e.status} /></td>
              <td className={td}>{e.source}</td>
              <td className={td}>{fmt(e.enrolled_at)}</td>
              <td className={td}>{fmt(e.revoked_at)}</td>
              <td className={td}><EnrollmentActions enrollment={e} returnTo={returnTo} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  )
}

/* ---------- students ---------- */
async function StudentsTab({ who }: Ctx) {
  const [profiles, enr, pay] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('enrollments').select('user_id, status'),
    supabaseAdmin.from('payments').select('user_id, status'),
  ])
  const count = (rows: any[] | null, status: string) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) if (r.status === status) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1)
    return m
  }
  const active = count(enr.data, 'active')
  const paid = count(pay.data, 'paid')
  const rows = profiles.data ?? []

  return (
    <Section title="Students" count={rows.length}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Table head={['Email', 'Name', 'Role', 'Joined', 'Active courses', 'Paid payments']}>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className={td}>{studentLink(p.id, who)}</td>
              <td className={td}>{p.full_name ?? '—'}</td>
              <td className={td}>{p.role}</td>
              <td className={td}>{fmt(p.created_at)}</td>
              <td className={td}>{active.get(p.id) ?? 0}</td>
              <td className={td}>{paid.get(p.id) ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  )
}

/* ---------- courses ---------- */
async function CoursesTab(_: Ctx) {
  const [courses, enr, pay] = await Promise.all([
    supabaseAdmin.from('courses').select('*').order('created_at'),
    supabaseAdmin.from('enrollments').select('course_id, status'),
    supabaseAdmin.from('payments').select('course_id, status, amount_paise'),
  ])
  const rows = courses.data ?? []

  return (
    <Section title="Courses" count={rows.length}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Table head={['Title', 'Price', 'Published', 'Active enrollments', 'Paid payments', 'Revenue (test)']}>
          {rows.map((c) => {
            const active = (enr.data ?? []).filter((e) => e.course_id === c.id && e.status === 'active').length
            const paid = (pay.data ?? []).filter((p) => p.course_id === c.id && p.status === 'paid')
            const revenue = paid.reduce((sum, p) => sum + p.amount_paise, 0)
            return (
              <tr key={c.id}>
                <td className={td}>{c.title}</td>
                <td className={td}>{rupees(c.price_paise)}</td>
                <td className={td}>{c.is_published ? 'Yes' : 'No'}</td>
                <td className={td}>{active}</td>
                <td className={td}>{paid.length}</td>
                <td className={td}>{rupees(revenue)}</td>
              </tr>
            )
          })}
        </Table>
      )}
    </Section>
  )
}

/* ---------- needs attention: duplicates and failed processing ---------- */
async function AttentionTab({ who, title, returnTo }: Ctx) {
  const [payRes, enrRes, evRes] = await Promise.all([
    supabaseAdmin.from('payments').select('*').order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('enrollments').select('payment_id'),
    supabaseAdmin
      .from('webhook_events')
      .select('razorpay_event_id, event_type, status, attempts, error, received_at')
      .order('received_at', { ascending: false })
      .limit(300),
  ])
  const pays = payRes.data ?? []
  const linked = new Set((enrRes.data ?? []).map((e) => e.payment_id).filter(Boolean))

  const stuck = pays
    .map((p) => {
      if (p.status === 'pending')
        return { p, why: 'Payment verified or authorized, but enrollment is not finished' }
      if (p.status === 'paid' && !p.needs_review && !linked.has(p.id))
        return { p, why: 'Marked paid, but no enrollment is linked to it' }
      return null
    })
    .filter(Boolean) as { p: any; why: string }[]

  const duplicates = pays.filter((p) => p.needs_review)

  // same student + same course with more than one payment row
  const groups = new Map<string, any[]>()
  for (const p of pays) {
    const k = `${p.user_id}|${p.course_id}`
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const repeats = [...groups.values()].filter((g) => g.length > 1)

  const events = (evRes.data ?? []).filter((e) => e.status !== 'processed' || e.attempts > 1)

  return (
    <>
      <Section
        title="Failed enrollment processing"
        count={stuck.length}
        note="Re-check asks Razorpay directly. If the order was captured, the same idempotent function finishes it."
      >
        {stuck.length === 0 ? (
          <Empty text="No stuck payments." />
        ) : (
          <Table head={['Date', 'Student', 'Course', 'Status', 'Why', 'Order id', 'Action']}>
            {stuck.map(({ p, why }) => (
              <tr key={p.id}>
                <td className={td}>{fmt(p.created_at)}</td>
                <td className={td}>{studentLink(p.user_id, who)}</td>
                <td className={td}>{title.get(p.course_id) ?? '—'}</td>
                <td className={td}><Badge value={p.status} /></td>
                <td className={td}>{why}{p.failure_reason ? ` (${p.failure_reason})` : ''}</td>
                <td className={`${td} font-mono text-xs`}>{p.razorpay_order_id}</td>
                <td className={td}><RecheckButton orderId={p.razorpay_order_id} returnTo={returnTo} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section
        title="Duplicate purchases"
        count={duplicates.length}
        note="Paid for a course the student already had. Access was not duplicated; the money may need a manual refund in the Razorpay dashboard."
      >
        {duplicates.length === 0 ? (
          <Empty />
        ) : (
          <Table head={['Date', 'Student', 'Course', 'Amount', 'Order id']}>
            {duplicates.map((p) => (
              <tr key={p.id}>
                <td className={td}>{fmt(p.created_at)}</td>
                <td className={td}>{studentLink(p.user_id, who)}</td>
                <td className={td}>{title.get(p.course_id) ?? '—'}</td>
                <td className={td}>{rupees(p.amount_paise)}</td>
                <td className={`${td} font-mono text-xs`}>{p.razorpay_order_id}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section
        title="Repeated purchase attempts"
        count={repeats.length}
        note="Same student, same course, more than one payment record."
      >
        {repeats.length === 0 ? (
          <Empty />
        ) : (
          <Table head={['Student', 'Course', 'Attempts', 'Breakdown']}>
            {repeats.map((g) => {
              const byStatus = new Map<string, number>()
              g.forEach((p) => byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1))
              return (
                <tr key={`${g[0].user_id}-${g[0].course_id}`}>
                  <td className={td}>{studentLink(g[0].user_id, who)}</td>
                  <td className={td}>{title.get(g[0].course_id) ?? '—'}</td>
                  <td className={td}>{g.length}</td>
                  <td className={td}>
                    {[...byStatus].map(([s, n]) => `${n} ${s}`).join(', ')}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      <Section
        title="Webhook events: failed, unprocessed, or delivered more than once"
        count={events.length}
        note="Attempts above 1 means Razorpay sent the same event id again. Duplicates are acknowledged without creating a second enrollment."
      >
        {events.length === 0 ? (
          <Empty />
        ) : (
          <Table head={['Received', 'Event', 'Type', 'Status', 'Attempts', 'Error']}>
            {events.slice(0, 50).map((e) => (
              <tr key={e.razorpay_event_id}>
                <td className={td}>{fmt(e.received_at)}</td>
                <td className={`${td} font-mono text-xs`}>{e.razorpay_event_id}</td>
                <td className={td}>{e.event_type}</td>
                <td className={td}><Badge value={e.status} /></td>
                <td className={td}>{e.attempts}</td>
                <td className={td}>{e.error ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </>
  )
}

/* ---------- page ---------- */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin) notFound() // students get a 404, not a hint that /admin exists

  const { tab, msg } = await searchParams
  const active = TAB_KEYS.includes(tab ?? '') ? (tab as string) : 'payments'
  const returnTo = `/admin?tab=${active}`

  const [emails, courses] = await Promise.all([
    emailMap(),
    supabaseAdmin.from('courses').select('id, title'),
  ])
  const who = (id: string) => emails.get(id) || id.slice(0, 8)
  const title = new Map((courses.data ?? []).map((c) => [c.id, c.title]))
  const ctx: Ctx = { who, title, returnTo }

  return (
    <Shell tab={active} msg={msg}>
      {active === 'payments' && <PaymentsTab {...ctx} />}
      {active === 'enrollments' && <EnrollmentsTab {...ctx} />}
      {active === 'students' && <StudentsTab {...ctx} />}
      {active === 'courses' && <CoursesTab {...ctx} />}
      {active === 'attention' && <AttentionTab {...ctx} />}
    </Shell>
  )
}