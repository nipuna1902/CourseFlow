import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getCurrentUser, isAdminUser } from '@/lib/auth'
import { logout } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'
import CourseCard from '@/components/CourseCard'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const paymentLabels: Record<string, string> = {
  created: 'Not completed',
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export default async function AccountPage() {
  await connection()

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const showAdmin = await isAdminUser(user.id)

  const supabase = await createClient()

  const [courseRes, enrollRes, paymentRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, description, price_paise')
      .eq('is_published', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('enrollments')
      .select('id, course_id, status, source, enrolled_at')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, course_id, status, amount_paise, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const { data: courses, error } = courseRes
  if (enrollRes.error) console.error('enrollments read failed', enrollRes.error)
  if (paymentRes.error) console.error('payments read failed', paymentRes.error)

  const enrollments = enrollRes.data ?? []
  const payments = paymentRes.data ?? []

  const titles = new Map((courses ?? []).map((c) => [c.id, c.title]))
  const activeIds = new Set(
    enrollments.filter((e) => e.status === 'active').map((e) => e.course_id)
  )
  const coursesToExplore = (courses ?? []).filter((c) => !activeIds.has(c.id))

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-5xl">

        {/* Navbar */}
        <nav className="fixed left-0 top-0 z-50 w-full border-b border-[#e0dedc] bg-white">
          <div className="flex items-center justify-between px-6 py-5">

            <Link href="/" className="text-2xl font-semibold text-[#0a0a0a]">
              CourseFlow
            </Link>

            <div className="flex items-center gap-4">
              {showAdmin && (
                <Link
                  href="/admin"
                  className="border border-[#0a0a0a] px-4 py-2 text-[#0a0a0a] transition hover:bg-[#0a0a0a] hover:text-white"
                >
                  Admin
                </Link>
              )}
              <form action={logout}>
                <button className="border border-[#0a0a0a] px-4 py-2 text-[#0a0a0a] transition hover:bg-[#0a0a0a] hover:text-white">
                  Logout
                </button>
              </form>
            </div>

          </div>
        </nav>

        {/* Welcome */}
        <section className="mt-28 bg-[#1f1f1e] p-10 text-white">
          <p className="text-[#bcb9ae]">
            Welcome back
          </p>

          <h2 className="mt-2 text-3xl font-normal tracking-tight">
            Your learning journey starts here.
          </h2>

          <p className="mt-3 text-[#e9e8e7]">
            Discover courses, develop skills and achieve your goals.
          </p>
        </section>

        {/* User info */}
        <section className="mt-8 border border-[#e0dedc] bg-white p-6">
          <h3 className="text-xl font-medium text-[#0a0a0a]">
            Account Information
          </h3>

          <div className="mt-4">
            <p className="text-sm text-[#949189]">
              Email
            </p>

            <p className="font-medium text-[#333333]">
              {user.email}
            </p>
          </div>
        </section>

        {/* My courses */}
        <section className="mt-8">
          <h3 className="text-2xl font-normal tracking-tight text-[#0a0a0a]">
            My Courses
          </h3>

          {enrollments.length === 0 ? (
            <p className="mt-4 border border-[#e0dedc] p-6 text-[#535250]">
              You haven&apos;t enrolled in any course yet. Pick one below.
            </p>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {enrollments.map((e) => (
                <div key={e.id} className="border border-[#e0dedc] p-5">
                  <h4 className="text-lg font-medium text-[#0a0a0a]">
                    {titles.get(e.course_id) ?? 'Course'}
                  </h4>

                  <p className="mt-1 text-sm text-[#535250]">
                    Enrolled on {formatDate(e.enrolled_at)}
                    {e.source === 'admin_grant' ? ' · granted by admin' : ''}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    {e.status === 'active' ? (
                      <>
                        <span className="text-sm font-medium text-green-700">
                          ● Access active
                        </span>
                        <Link
                          href={`/learn/${e.course_id}`}
                          className="border border-[#0a0a0a] px-4 py-2 text-sm text-[#0a0a0a] transition hover:bg-[#0a0a0a] hover:text-white"
                        >
                          Start learning
                        </Link>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-red-700">
                        ● Access revoked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payment history */}
        <section className="mt-8">
          <h3 className="text-2xl font-normal tracking-tight text-[#0a0a0a]">
            Payment History
          </h3>

          {payments.length === 0 ? (
            <p className="mt-4 border border-[#e0dedc] p-6 text-[#535250]">
              No payments yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto border border-[#e0dedc]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e0dedc] bg-[#f5f4f3] text-[#535250]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Course</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-[#e0dedc] last:border-0">
                      <td className="px-4 py-3">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        {titles.get(p.course_id) ?? 'Course'}
                      </td>
                      <td className="px-4 py-3">
                        ₹{(p.amount_paise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        {paymentLabels[p.status] ?? p.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Explore (only courses you don't own yet) */}
        <section className="mt-8 pb-16">
          <h3 className="text-2xl font-normal tracking-tight text-[#0a0a0a]">
            Explore Courses
          </h3>

          <p className="mt-2 text-[#535250]">
            Start learning something new today.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">

            {error ? (
              <p className="col-span-3 border border-red-200 bg-red-50 p-4 text-red-700">
                Failed to load courses: {error.message}
              </p>
            ) : coursesToExplore.length > 0 ? (
              coursesToExplore.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  number={index + 1}
                />
              ))
            ) : (
              <p className="col-span-3 border border-[#e0dedc] p-6 text-[#535250]">
                You&apos;re enrolled in every available course.
              </p>
            )}

          </div>
        </section>

      </div>
    </main>
  )
}