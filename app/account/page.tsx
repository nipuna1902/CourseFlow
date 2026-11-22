import { getCurrentUser } from '@/lib/auth'
import { logout } from '@/app/auth/actions'

export default async function AccountPage() {
  const user = await getCurrentUser()

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-5xl">

        {/* Navbar */}
        <nav className="fixed left-0 top-0 z-50 w-full border-b border-[#e0dedc] bg-white">
          <div className="flex items-center justify-between px-6 py-5">

            <h1 className="text-2xl font-semibold text-[#0a0a0a]">
              CourseFlow
            </h1>

            <form action={logout}>
              <button className="border border-[#0a0a0a] px-4 py-2 text-[#0a0a0a] transition hover:bg-[#0a0a0a] hover:text-white">
                Logout
              </button>
            </form>

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
            <p className="text-sm text-[#949189]">Email</p>
            <p className="font-medium text-[#333333]">
              {user?.email}
            </p>
          </div>
        </section>

        {/* Courses */}
        <section className="mt-8">
          <h3 className="text-2xl font-normal tracking-tight text-[#0a0a0a]">
            Explore Courses
          </h3>

          <p className="mt-2 text-[#535250]">
            Start learning something new today.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">

            {/* Full Stack */}
            <div className="border border-[#e0dedc] bg-white p-6 transition hover:border-[#0a0a0a]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-[#e9e8e7]">
                <span className="text-sm text-[#535250]">01</span>
              </div>

              <h4 className="font-medium text-[#0a0a0a]">
                Full Stack Web Development
              </h4>

              <p className="mt-2 text-sm text-[#535250]">
                Learn frontend, backend and database development.
              </p>

              <p className="mt-4 text-lg font-medium text-[#0a0a0a]">
                ₹4,999
              </p>
            </div>

            {/* Python */}
            <div className="border border-[#e0dedc] bg-white p-6 transition hover:border-[#0a0a0a]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-[#e9e8e7]">
                <span className="text-sm text-[#535250]">02</span>
              </div>

              <h4 className="font-medium text-[#0a0a0a]">
                Python Programming
              </h4>

              <p className="mt-2 text-sm text-[#535250]">
                Master Python fundamentals and problem solving.
              </p>

              <p className="mt-4 text-lg font-medium text-[#0a0a0a]">
                ₹2,999
              </p>
            </div>

            {/* DSA */}
            <div className="border border-[#e0dedc] bg-white p-6 transition hover:border-[#0a0a0a]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-[#e9e8e7]">
                <span className="text-sm text-[#535250]">03</span>
              </div>

              <h4 className="font-medium text-[#0a0a0a]">
                Data Structures & Algorithms
              </h4>

              <p className="mt-2 text-sm text-[#535250]">
                Improve your problem-solving and coding skills.
              </p>

              <p className="mt-4 text-lg font-medium text-[#0a0a0a]">
                ₹3,999
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  )
}