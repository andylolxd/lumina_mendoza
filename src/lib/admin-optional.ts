import { createClient } from '@/lib/supabase/server'

/** Sesión actual: email si es admin, si no null (sin redirigir). */
export async function getAdminEmailIfSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data: ok } = await supabase.rpc('current_user_is_admin')
  return ok === true ? user.email : null
}
