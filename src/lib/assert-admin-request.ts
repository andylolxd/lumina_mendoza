import { createClient } from '@/lib/supabase/server'

/** Para Route Handlers: devuelve el email admin o null. */
export async function getAdminEmailFromRequest() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data: ok } = await supabase.rpc('current_user_is_admin')
  return ok === true ? user.email : null
}
