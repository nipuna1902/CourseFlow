'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { login } from '@/app/auth/actions'

type FormState = { error?: string; email?: string } | null

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(login, null)

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

          <form action={formAction} className="mt-10 space-y-6">

            {state?.error && (
              <p
                role="alert"
                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {state.error}
              </p>
            )}

            <div>
              <label className="mb-2 block text-sm">
                Email address
              </label>

              <input
                type="email"
                name="email"
                required
                defaultValue={state?.email ?? ''}
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
              disabled={pending}
              className="w-full bg-[#0a0a0a] py-4 text-white hover:bg-[#333] disabled:opacity-60"
            >
              {pending ? 'Signing in…' : 'Sign In'}
            </button>

          </form>

          <p className="mt-8 text-sm text-[#535250]">
            Don&apos;t have an account?{' '}
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