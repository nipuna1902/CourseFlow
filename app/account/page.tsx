import { getCurrentUser } from '@/lib/supabase/auth'
import { logout } from '@/app/auth/actions'

export default async function AccountPage() {
  const user = await getCurrentUser()

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 p-6">
      <div className="mx-auto max-w-5xl">

        {/* Navbar */}
        <nav className="flex items-center justify-between rounded-2xl bg-white/80 p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-violet-900">
            CourseFlow
          </h1>

          <form action={logout}>
            <button className="rounded-xl border border-violet-200 px-4 py-2 text-violet-800 hover:bg-violet-50">
              Logout
            </button>
          </form>
        </nav>

        {/* Welcome */}
        <section className="mt-10 rounded-3xl bg-gradient-to-r from-violet-800 via-purple-700 to-indigo-700 p-10 text-white shadow-lg">
          <p className="text-violet-100">Welcome back 👋</p>

          <h2 className="mt-2 text-3xl font-bold">
            Your learning journey starts here.
          </h2>

          <p className="mt-3 text-violet-100">
            Discover courses, develop skills and achieve your goals.
          </p>
        </section>

        {/* User info */}
        <section className="mt-8 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-violet-900">
            Account Information
          </h3>

          <div className="mt-4">
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium text-gray-800">
              {user?.email}
            </p>
          </div>
        </section>

        {/* Courses */}
        <section className="mt-8">
          <h3 className="text-2xl font-bold text-violet-900">
            Explore Courses
          </h3>

          <p className="mt-2 text-gray-500">
            Start learning something new today.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">

            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-200 text-2xl">
                💻
              </div>

              <h4 className="font-semibold text-violet-900">
                Full Stack Web Development
              </h4>

              <p className="mt-2 text-sm text-gray-500">
                Learn frontend, backend and database development.
              </p>

              <p className="mt-4 text-lg font-bold text-violet-800">
                ₹4,999
              </p>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">
                🐍
              </div>

              <h4 className="font-semibold text-violet-900">
                Python Programming
              </h4>

              <p className="mt-2 text-sm text-gray-500">
                Master Python fundamentals and problem solving.
              </p>

              <p className="mt-4 text-lg font-bold text-violet-800">
                ₹2,999
              </p>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
                🧠
              </div>

              <h4 className="font-semibold text-violet-900">
                Data Structures & Algorithms
              </h4>

              <p className="mt-2 text-sm text-gray-500">
                Improve your problem-solving and coding skills.
              </p>

              <p className="mt-4 text-lg font-bold text-violet-800">
                ₹3,999
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  )
}