import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function LearnPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // does this course exist?
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, description')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) notFound()

  // layer 1: does THIS student have an active enrollment?
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .maybeSingle()

  if (!enrollment) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="mx-auto max-w-2xl pt-24 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[#535250]">Access denied</p>
          <h1 className="mt-4 text-3xl font-normal tracking-tight text-[#0a0a0a]">
            You don&apos;t have access to {course.title}
          </h1>
          <p className="mt-3 text-[#535250]">
            Purchase this course to unlock its lessons. If you were revoked by an admin, contact support.
          </p>
          <Link
            href="/#courses"
            className="mt-8 inline-block bg-[#0a0a0a] px-6 py-3 text-white hover:bg-[#333]"
          >
            Browse courses
          </Link>
        </div>
      </main>
    )
  }

  // layer 2: lessons are fetched with the student's own session, so the database
  // policy decides which rows come back (not just this page's check)
  const { data: lessons, error } = await supabase.from('course_lessons').select('*')
  if (error) console.error('lessons read failed', error)

  const forThisCourse = (lessons ?? [])
    .filter((l: any) => l.course_id === courseId)
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-3xl pt-12">
        <Link href="/account" className="text-sm text-[#535250] hover:underline">
          ← Back to my account
        </Link>

        <h1 className="mt-6 text-4xl font-normal tracking-tight text-[#0a0a0a]">
          {course.title}
        </h1>
        <p className="mt-2 text-[#535250]">{course.description}</p>

        <div className="mt-10 space-y-4">
          {forThisCourse.length === 0 ? (
            <p className="border border-[#e0dedc] p-6 text-[#535250]">
              No lessons have been added to this course yet.
            </p>
          ) : (
            forThisCourse.map((lesson: any, i: number) => (
              <div key={lesson.id} className="border border-[#e0dedc] p-6">
                <p className="text-sm text-[#949189]">Lesson {i + 1}</p>
                <h2 className="mt-1 text-xl font-medium text-[#0a0a0a]">
                  {lesson.title ?? 'Untitled lesson'}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#535250]">
                  {lesson.body ?? lesson.content ?? ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}