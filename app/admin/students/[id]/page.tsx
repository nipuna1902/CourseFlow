import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Badge, Section, Table, Empty, Shell, EnrollmentActions, emailMap, fmt, rupees, td } from '@/components/admin'

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin) notFound()

  const { id } = await params
  const { msg } = await searchParams
  const returnTo = `/admin/students/${id}`

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!profile) notFound()

  const [emails, courses, enrRes, payRes, audRes] = await Promise.all([
    emailMap(),
    supabaseAdmin.from('courses').select('id, title'),
    supabaseAdmin.from('enrollments').select('*').eq('user_id', id).order('enrolled_at', { ascending: false }),
    supabaseAdmin.from('payments').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('enrollment_audit').select('*').eq('student_id', id).order('created_at', { ascending: false }),
  ])
  const title = new Map((courses.data ?? []).map((c) => [c.id, c.title]))
  const enrollments = enrRes.data ?? []
  const payments = payRes.data ?? []
  const audit = audRes.data ?? []

  return (
    <Shell msg={msg}>
      <div className="mb-8 border border-[#e0dedc] p-5">
        <p className="text-sm text-[#949189]">Student</p>
        <h1 className="mt-1 text-2xl font-normal tracking-tight">{emails.get(id) ?? id}</h1>
        <p className="mt-2 text-sm text-[#535250]">
          {profile.full_name ?? 'No name'} · role: {profile.role} · joined {fmt(profile.created_at)}
        </p>
      </div>

      <Section title="Course access" count={enrollments.length}>
        {enrollments.length === 0 ? (
          <Empty text="No enrollments." />
        ) : (
          <Table head={['Course', 'Status', 'Source', 'Enrolled', 'Revoked', 'Action']}>
            {enrollments.map((e) => (
              <tr key={e.id}>
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

      <Section title="Payments" count={payments.length}>
        {payments.length === 0 ? (
          <Empty text="No payments." />
        ) : (
          <Table head={['Date', 'Course', 'Amount', 'Status', 'Order id', 'Notes']}>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className={td}>{fmt(p.created_at)}</td>
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
        )}
      </Section>

      <Section
        title="Access history"
        count={audit.length}
        note="Every grant, revoke and restore. Automatic grants from verified payments show as System."
      >
        {audit.length === 0 ? (
          <Empty text="No access changes recorded." />
        ) : (
          <Table head={['When', 'Action', 'Course', 'By', 'Reason']}>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className={td}>{fmt(a.created_at)}</td>
                <td className={td}><Badge value={a.action} /></td>
                <td className={td}>{title.get(a.course_id) ?? '—'}</td>
                <td className={td}>{a.admin_id ? emails.get(a.admin_id) ?? a.admin_id : 'System'}</td>
                <td className={td}>{a.reason ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </Shell>
  )
}