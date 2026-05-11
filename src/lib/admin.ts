import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Una sola verificación por request de React (layout + página suelen llamar ambos).
 * Evita duplicar getUser + consulta admin_users en cada navegación.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/admin/login')

  const { data: row } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .maybeSingle()

  if (!row) {
    await supabase.auth.signOut()
    redirect('/admin/login?error=no_autorizado')
  }

  return { supabase, user }
})
