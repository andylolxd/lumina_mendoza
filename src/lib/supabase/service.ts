import { createClient } from '@supabase/supabase-js'

/** Solo en servidor (API routes). Nunca exponer la service role al cliente. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}
