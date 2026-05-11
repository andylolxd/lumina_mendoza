import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
/** Clave publicable (nuevo formato) o anon JWT (legacy). */
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type CookieStore = Awaited<ReturnType<typeof cookies>>

export const createClient = (cookieStore: CookieStore) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    )
  }
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          /* setAll desde Server Component; el middleware renueva la sesión */
        }
      },
    },
  })
}
