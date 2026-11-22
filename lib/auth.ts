import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null
  return { id: data.claims.sub as string, email: data.claims.email as string | undefined }
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}