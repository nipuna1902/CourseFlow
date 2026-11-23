'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// On failure these return an error for the form to display (instead of putting it in the URL).
// On success, redirect() ends the action and sends the student to their account.

export async function register(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    // send back what they typed (never the password) so the form can refill it
    return { error: error.message, email, full_name: fullName }
  }

  redirect('/account')
}

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message, email }
  }

  redirect('/account')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}