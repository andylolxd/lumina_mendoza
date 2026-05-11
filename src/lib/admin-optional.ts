import { createClient } from '@/lib/supabase/server'

/** Sesión actual: email si es admin, si no null (sin redirigir). */
export async function getAdminEmailIfSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from('admin_users').select('email').eq('email', user.email).maybeSingle()
  return data?.email ?? null
}
