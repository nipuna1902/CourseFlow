'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function register(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
    options: { data: { full_name: String(formData.get('full_name')) } },
  })
  if (error) return { error: error.message }
  redirect('/account')
}

export async function login(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })
  if (error) return { error: error.message }
  redirect('/account')
}

export async function logout() {
  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}