'use client'

import { usernameOrEmailToSupabaseEmail } from '@/lib/auth-login'
import { headerNavPillMuted } from '@/lib/store-header-nav'
import { STORE_HEADER_BG_SRC, storeCatalogFrameSubClass, storeInfiniteBgLayerStyle } from '@/lib/store-theme'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

const loginTitleFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
})

export function LoginForm() {
  const searchParams = useSearchParams()
  const errParam = searchParams.get('error')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(
    errParam === 'no_autorizado'
      ? 'Esta cuenta no puede administrar el catálogo. El email tiene que estar en la tabla admin_users de Supabase (el mismo que en Authentication).'
      : '',
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const emailForAuth = usernameOrEmailToSupabaseEmail(username)
    if (!emailForAuth) {
      setLoading(false)
      setError('Ingresá un usuario válido (letras, números, punto, guión).')
      return
    }

    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    })
    const loginBody = (await loginRes.json().catch(() => ({}))) as { error?: string; ok?: boolean }
    setLoading(false)
    if (!loginRes.ok) {
      if (loginRes.status === 403 || loginBody.error === 'no_autorizado') {
        setError(
          'Esta cuenta no puede administrar el catálogo. El email tiene que estar en la tabla admin_users de Supabase (el mismo que en Authentication).',
        )
        return
      }
      setError(
        loginBody.error
          ? `${loginBody.error} — Email que usamos en Supabase: ${emailForAuth}`
          : `No se pudo iniciar sesión (${loginRes.status}).`,
      )
      return
    }

    window.location.assign('/admin/catalog')
  }

  return (
    <div className="flex min-h-screen flex-col text-zinc-100">
      <header className="sticky top-0 z-40 overflow-hidden border-b border-zinc-800/50">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-left-top bg-no-repeat"
          style={{ backgroundImage: `url(${STORE_HEADER_BG_SRC})` }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <h1
              className={`m-0 bg-[linear-gradient(118deg,#fff5f0_0%,#f0d4cc_22%,#d4a088_52%,#c08081_78%,#a86f6f_100%)] bg-clip-text text-[1.35rem] font-semibold leading-tight tracking-[0.03em] text-transparent sm:text-[1.5rem] ${loginTitleFont.className}`}
            >
              Lumina Mendoza
            </h1>
            <p className="mt-1 font-sans text-[0.6875rem] font-medium leading-snug tracking-wide text-amber-200/88 sm:text-xs">
              Acceso administración
            </p>
          </div>
          <Link href="/" className={`${headerNavPillMuted} shrink-0`}>
            Ver tienda
          </Link>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={storeInfiniteBgLayerStyle}
          aria-hidden
        />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div
            className={`mb-5 w-full max-w-sm px-4 py-3 text-center ${storeCatalogFrameSubClass}`}
            role="note"
          >
            <p className="text-sm leading-relaxed text-rose-50/95">
              ¿Viniste a comprar? <strong className="text-white">No hace falta</strong> iniciar sesión: volvé a la
              tienda y armá tu pedido por el catálogo.
            </p>
          </div>

          <div className={`w-full max-w-sm p-8 ${storeCatalogFrameSubClass}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400" htmlFor="username">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400" htmlFor="password">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
            <Link href="/" className={`mt-6 block w-full text-center ${headerNavPillMuted}`}>
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
