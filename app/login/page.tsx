'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/auth/actions'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 px-4 py-10">

      <div className="w-full max-w-md rounded-3xl border border-violet-100 bg-white/90 p-8 shadow-xl shadow-violet-200/40 backdrop-blur">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-700 to-purple-600 text-2xl text-white shadow-lg shadow-violet-300">
            ✦
          </div>

          <h1 className="text-3xl font-bold text-violet-950">
            CourseFlow
          </h1>

          <p className="mt-2 text-sm text-violet-500">
            Learn. Grow. Achieve.
          </p>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back
          </h2>

          <p className="mt-2 text-gray-500">
            Sign in to continue your learning journey.
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter your password"
              className="w-full rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {/* Error */}
          {state?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-gradient-to-r from-violet-800 to-purple-700 py-3 font-semibold text-white shadow-lg shadow-violet-300/50 transition hover:from-violet-900 hover:to-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-violet-700 hover:text-violet-900"
          >
            Create one
          </Link>
        </p>

      </div>
    </main>
  )
}