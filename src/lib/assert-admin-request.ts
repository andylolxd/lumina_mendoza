import { createClient } from '@/lib/supabase/server'

/** Para Route Handlers: devuelve el email admin o null. */
export async function getAdminEmailFromRequest() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from('admin_users').select('email').eq('email', user.email).maybeSingle()
  return data?.email ?? null
}
