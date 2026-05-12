import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

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
 * Tras login en el cliente, persiste la sesión en cookies **de respuesta HTTP**
 * para que los Server Components (requireAdmin) lean la misma sesión que Supabase SSR.
 */
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_env' }, { status: 500 })
  }

  let body: { access_token?: string; refresh_token?: string }
  try {
    body = (await request.json()) as { access_token?: string; refresh_token?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { access_token, refresh_token } = body
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'missing_tokens' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      /**
       * @supabase/ssr pasa como 2º arg cabeceras anti-caché; hay que aplicarlas al `Response`
       * para que cookies de sesión no queden inconsistentes entre Next CDN y navegador.
       */
      setAll(cookiesToSet: CookiesToSet[], responseHeaders?: Record<string, string | undefined>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
        mergeNoStoreHeaders(res, responseHeaders)
      },
    },
  })

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  /** Fuerza materializar tokens en cookies antes del JSON final (listeners internos SSR). */
  await supabase.auth.getUser()

  return res
}
