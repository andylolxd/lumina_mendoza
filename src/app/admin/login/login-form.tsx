'use client'

import { getAuthLoginDomain, usernameOrEmailToSupabaseEmail } from '@/lib/auth-login'
import { createClient } from '@/lib/supabase/browser'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errParam = searchParams.get('error')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(
    errParam === 'no_autorizado' ? 'Esta cuenta no puede administrar el catálogo.' : '',
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

    const sb = createClient()
    const { error: e2 } = await sb.auth.signInWithPassword({
      email: emailForAuth,
      password,
    })
    setLoading(false)
    if (e2) {
      setError(e2.message)
      return
    }
    router.push('/admin/catalog')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl">
        <h1 className="text-center text-lg font-semibold text-rose-200">Lumina Mendoza</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">Acceso administración</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-400" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              spellCheck={false}
              placeholder="ej. lisbetcilla"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <p className="mt-1 text-[11px] leading-snug text-zinc-600">
              Sin correo: escribís solo el usuario (se convierte en{' '}
              <span className="font-mono text-zinc-500">
                usuario@{getAuthLoginDomain()}
              </span>
              ). Si ponés un mail completo (con @), también sirve. Ese mismo email tiene que existir en
              Supabase Authentication y en la tabla <span className="font-mono">admin_users</span>: si solo
              cambiaste la tabla, creá o renombrá el usuario en Authentication o usá el panel Equipo.
            </p>
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
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <Link
          href="/"
          className="mt-6 block text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}
