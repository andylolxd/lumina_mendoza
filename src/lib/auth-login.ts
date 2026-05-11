/**
 * Supabase Auth solo acepta email en signInWithPassword.
 * Para UX de "usuario + contraseña": si no hay @, se concatena un dominio interno fijo.
 */
const DEFAULT_DOMAIN = 'lumina.local'

export function getAuthLoginDomain(): string {
  return (
    process.env.NEXT_PUBLIC_AUTH_LOGIN_DOMAIN?.trim().replace(/^@/, '') ||
    DEFAULT_DOMAIN
  )
}

/** Solo parte local ASCII segura para email sintético. */
export function sanitizeUsername(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  const cleaned = s.replace(/[^a-z0-9._-]/g, '')
  return cleaned
}

/**
 * Lo que escribe el usuario en el campo "Usuario" → email que usa Supabase.
 * Si ya incluye @, se usa como email completo (minúsculas).
 */
export function usernameOrEmailToSupabaseEmail(input: string): string {
  const t = input.trim().toLowerCase()
  if (!t) return ''
  if (t.includes('@')) return t
  const local = sanitizeUsername(input)
  if (!local) return ''
  return `${local}@${getAuthLoginDomain()}`
}
