import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, isAdminUser } from '@/lib/auth'
import BuyButton from '@/components/BuyButton'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const showAdmin = user ? await isAdminUser(user.id) : false

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: true })

  // courses this student already owns
  let ownedIds = new Set<string>()
  if (user) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
    if (error) console.error('enrollments read failed', error)
    ownedIds = new Set((data ?? []).map((e) => e.course_id))
  }

  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">

      {/* Navbar */}
      <nav className="border-b border-[#e0dedc]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link href="/" className="text-xl font-semibold tracking-tight">
            CourseFlow
          </Link>

          <div className="flex items-center gap-6 text-sm">
            {user ? (
              <>
                {showAdmin && (
                  <Link
                    href="/admin"
                    className="border border-[#0a0a0a] px-4 py-2 hover:bg-[#0a0a0a] hover:text-white"
                  >
                    Admin
                  </Link>
                )}
                <Link href="/account" className="hover:underline">
                  My Account
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:underline">
                  Login
                </Link>

                <Link
                  href="/register"
                  className="bg-[#0a0a0a] px-5 py-3 text-white hover:bg-[#333]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">

        <p className="mb-5 text-sm uppercase tracking-[0.2em] text-[#535250]">
          Learn. Grow. Build.
        </p>

        <h1 className="mx-auto max-w-4xl text-5xl font-normal leading-tight tracking-[-0.04em] md:text-7xl">
          Skills that move
          <br />
          you forward.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#535250]">
          Explore thoughtfully designed courses and develop
          skills that help you achieve your goals.
        </p>

        <Link
          href="#courses"
          className="mt-8 inline-block bg-[#0a0a0a] px-8 py-4 text-white hover:bg-[#333]"
        >
          Explore Courses
        </Link>

      </section>

      {/* Courses */}
      <section
        id="courses"
        className="mx-auto max-w-7xl px-6 pb-24"
      >

        <div className="mb-12">
          <p className="text-sm text-[#535250]">OUR COURSES</p>

          <h2 className="mt-3 text-4xl font-normal tracking-tight">
            Explore what you can learn.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {courses?.map((course) => (
            <div
              key={course.id}
              className="border border-[#e0dedc] p-6 transition hover:border-[#0a0a0a]"
            >

              <div className="mb-6 flex h-40 items-center justify-center bg-[#e9e8e7]">
                <span className="text-sm text-[#535250]">
                  Course Preview
                </span>
              </div>

              <h3 className="text-xl font-medium">
                {course.title}
              </h3>

              <p className="mt-3 min-h-16 text-sm leading-relaxed text-[#535250]">
                {course.description ||
                  'Explore this course and develop new skills.'}
              </p>

              <div className="mt-6 flex items-center justify-between">

                <span className="text-xl font-medium">
                  ₹{(course.price_paise / 100).toLocaleString('en-IN')}
                </span>

              </div>

              <div className="mt-5">
                {ownedIds.has(course.id) ? (
                  <Link
                    href={`/learn/${course.id}`}
                    className="block border border-[#0a0a0a] px-5 py-3 text-center text-sm hover:bg-[#0a0a0a] hover:text-white"
                  >
                    ✓ Enrolled · Start learning
                  </Link>
                ) : user ? (
                  <BuyButton
                    courseId={course.id}
                    title={course.title}
                  />
                ) : (
                  <Link
                    href="/login"
                    className="block border border-[#e0dedc] px-5 py-3 text-center text-sm hover:border-[#0a0a0a]"
                  >
                    Sign in to buy
                  </Link>
                )}
              </div>

            </div>
          ))}

        </div>

      </section>

      {/* Footer */}
      <footer className="border-t border-[#e0dedc]">
        <div className="mx-auto max-w-7xl px-6 py-8">

          <div className="flex flex-col justify-between gap-4 sm:flex-row">

            <p className="font-medium">
              CourseFlow
            </p>

            <p className="text-sm text-[#949189]">
              © 2026 CourseFlow. All rights reserved.
            </p>

          </div>

        </div>
      </footer>

    </main>
  )
}