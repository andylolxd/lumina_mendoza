import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con service role: solo en servidor, nunca importar en componentes cliente.
 * Necesario para crear usuarios Auth, resetear contraseñas y gestionar `admin_users` sin depender de políticas RLS.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim()) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!key?.trim()) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (Supabase → Settings → API → service_role). Hace falta para el panel Equipo.',
    )
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
