import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null //check whether the user is logged in
  return { id: data.claims.sub as string, email: data.claims.email as string | undefined }
}
//is the currently loggedin user an admin
export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}
//whether the given user id belongs to an admin by fetching their role from the profiles table...returns true or false
export async function isAdminUser(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return data?.role === 'admin'
}