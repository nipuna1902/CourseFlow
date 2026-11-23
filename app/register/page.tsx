'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { register } from '@/app/auth/actions'

type FormState = { error?: string; email?: string; full_name?: string } | null

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(register, null)

  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">

      {/* Navbar */}
      <nav className="border-b border-[#e0dedc] px-6 py-5">
        <Link href="/" className="text-xl font-semibold">
          CourseFlow
        </Link>
      </nav>

      {/* Registration Form */}
      <div className="flex min-h-[80vh] items-center justify-center px-6">

        <div className="w-full max-w-md">

          <h1 className="text-4xl font-normal tracking-tight">
            Create your account.
          </h1>

          <p className="mt-3 text-[#535250]">
            Start learning something new today.
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
                Full name
              </label>

              <input
                type="text"
                name="full_name"
                required
                defaultValue={state?.full_name ?? ''}
                className="w-full border border-[#e0dedc] px-4 py-3 outline-none focus:border-[#0a0a0a]"
                placeholder="Your full name"
              />
            </div>

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
                minLength={6}
                className="w-full border border-[#e0dedc] px-4 py-3 outline-none focus:border-[#0a0a0a]"
                placeholder="Create a password"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[#0a0a0a] py-4 text-white hover:bg-[#333] disabled:opacity-60"
            >
              {pending ? 'Creating account…' : 'Create Account'}
            </button>

          </form>

          <p className="mt-8 text-sm text-[#535250]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[#0a0a0a] underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>

        </div>

      </div>

    </main>
  )
}