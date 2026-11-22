import Link from 'next/link'
import { login } from '@/app/auth/actions'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">

      <nav className="border-b border-[#e0dedc] px-6 py-5">
        <Link href="/" className="text-xl font-semibold">
          CourseFlow
        </Link>
      </nav>

      <div className="flex min-h-[80vh] items-center justify-center px-6">

        <div className="w-full max-w-md">

          <h1 className="text-4xl font-normal tracking-tight">
            Welcome back.
          </h1>

          <p className="mt-3 text-[#535250]">
            Sign in to continue your learning journey.
          </p>

          <form action={login} className="mt-10 space-y-6">

            <div>
              <label className="mb-2 block text-sm">
                Email address
              </label>

              <input
                type="email"
                name="email"
                required
                className="w-full border border-[#e0dedc] px-4 py-3 outline-none focus:border-[#0a0a0a]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">
                Password
              </label>

              <input
                type="password"
                name="password"
                required
                className="w-full border border-[#e0dedc] px-4 py-3 outline-none focus:border-[#0a0a0a]"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#0a0a0a] py-4 text-white hover:bg-[#333]"
            >
              Sign In
            </button>

          </form>

          <p className="mt-8 text-sm text-[#535250]">
            Don't have an account?{' '}
            <Link
              href="/register"
              className="text-[#0a0a0a] underline underline-offset-4"
            >
              Create one
            </Link>
          </p>

        </div>

      </div>

    </main>
  )
}