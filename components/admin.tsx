import Link from 'next/link'
import type { ReactNode } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { setEnrollmentStatus, recheckPayment } from '@/app/admin/actions'

export function fmt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

// emails live in Supabase Auth, not in profiles
export async function emailMap() {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  return new Map((data?.users ?? []).map((u) => [u.id, u.email ?? '']))
}

export const td = 'px-3 py-2 border-b border-[#e0dedc] align-top'

const badgeColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  processed: 'bg-green-100 text-green-800',
  granted: 'bg-green-100 text-green-800',
  restored: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  received: 'bg-yellow-100 text-yellow-800',
  'duplicate purchase': 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800',
  revoked: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  created: 'bg-gray-100 text-gray-700',
}

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${badgeColors[value] ?? 'bg-gray-100 text-gray-700'}`}>
      {value}
    </span>
  )
}

export function Shell({ tab, msg, children }: { tab?: string; msg?: string; children: ReactNode }) {
  const tabs: [string, string][] = [
    ['payments', 'Payments'],
    ['enrollments', 'Enrollments'],
    ['students', 'Students'],
    ['courses', 'Courses'],
    ['attention', 'Needs attention'],
  ]
  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">
      <nav className="border-b border-[#e0dedc]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-semibold tracking-tight">
            CourseFlow Admin
          </Link>
          <Link href="/account" className="text-sm hover:underline">
            ← Back to site
          </Link>
        </div>
        <div className="mx-auto flex max-w-7xl gap-6 px-6 text-sm">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin?tab=${key}`}
              className={`border-b-2 py-3 ${tab === key
                  ? 'border-[#0a0a0a] font-medium'
                  : 'border-transparent text-[#535250] hover:text-[#0a0a0a]'
                }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {msg && <p className="mb-6 border border-[#e0dedc] bg-[#f5f4f3] p-3 text-sm">{msg}</p>}
        {children}
      </div>
    </main>
  )
}

export function Section({
  title, count, note, children,
}: { title: string; count?: number; note?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-normal tracking-tight">
        {title}
        {count !== undefined && <span className="ml-2 text-sm text-[#949189]">({count})</span>}
      </h2>
      {note && <p className="mt-1 text-sm text-[#535250]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-[#e0dedc]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#e0dedc] bg-[#f5f4f3] text-[#535250]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Empty({ text = 'Nothing here.' }: { text?: string }) {
  return <p className="border border-[#e0dedc] p-4 text-sm text-[#535250]">{text}</p>
}

export function EnrollmentActions({
  enrollment, returnTo,
}: { enrollment: { id: string; status: string }; returnTo: string }) {
  const revoking = enrollment.status === 'active'
  return (
    <form action={setEnrollmentStatus} className="flex items-center gap-2">
      <input type="hidden" name="enrollmentId" value={enrollment.id} />
      <input type="hidden" name="action" value={revoking ? 'revoked' : 'restored'} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input
        name="reason"
        placeholder="Reason (optional)"
        className="w-40 border border-[#e0dedc] px-2 py-1 text-xs"
      />
      <button
        className={`px-3 py-1 text-xs text-white ${revoking ? 'bg-red-700 hover:bg-red-800' : 'bg-[#0a0a0a] hover:bg-[#333]'}`}
      >
        {revoking ? 'Revoke' : 'Restore'}
      </button>
    </form>
  )
}

export function RecheckButton({ orderId, returnTo }: { orderId: string; returnTo: string }) {
  return (
    <form action={recheckPayment}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button className="border border-[#0a0a0a] px-3 py-1 text-xs hover:bg-[#0a0a0a] hover:text-white">
        Re-check with Razorpay
      </button>
    </form>
  )
}