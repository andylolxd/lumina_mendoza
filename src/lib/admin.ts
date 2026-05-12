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

  /** RPC SECURITY DEFINER: evita depender del filtro `.ilike` en PostgREST y de policies recursivas. */
  const { data: isAdmin, error: rpcErr } = await supabase.rpc('current_user_is_admin')

  if (rpcErr || isAdmin !== true) {
    await supabase.auth.signOut()
    redirect('/admin/login?error=no_autorizado')
  }

  return { supabase, user }
})
