import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { usernameOrEmailToSupabaseEmail } from '@/lib/auth-login'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type CookiesToSet = { name: string; value: string; options?: CookieOptions }

function mergeNoStoreHeaders(res: NextResponse, h: Record<string, string | undefined> | undefined) {
  if (!h) return
  for (const [key, val] of Object.entries(h)) {
    if (typeof val === 'string') res.headers.set(key, val)
  }
}

/**
 * Login en un solo paso en el servidor: escribe la sesión con `cookies()` de Next
 * (más fiable que signIn en el browser + POST /api/auth/session).
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_env' }, { status: 500 })
  }

  let body: { username?: string; password?: string }
  try {
    body = (await request.json()) as { username?: string; password?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { username, password } = body
  const email = usernameOrEmailToSupabaseEmail(username ?? '')
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const res = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookiesToSet[], responseHeaders?: Record<string, string | undefined>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
        mergeNoStoreHeaders(res, responseHeaders)
      },
    },
  })

  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signErr) {
    return NextResponse.json({ error: signErr.message }, { status: 401 })
  }

  await supabase.auth.getUser()

  const { data: isAdmin, error: rpcErr } = await supabase.rpc('current_user_is_admin')
  if (rpcErr || isAdmin !== true) {
    await supabase.auth.signOut()
    const denied = NextResponse.json({ error: 'no_autorizado' }, { status: 403 })
    const outgoing = res.headers.getSetCookie?.() ?? []
    for (const c of outgoing) {
      denied.headers.append('Set-Cookie', c)
    }
    return denied
  }

  return res
}
