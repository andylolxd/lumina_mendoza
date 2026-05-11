'use client'

import {
  type ActionResult,
  changeAdminLoginEmailAction,
  createAdminUserAction,
  linkExistingAuthAdminAction,
  removeAdminAction,
  setAdminPasswordAction,
} from '@/app/admin/(dash)/equipo/actions'
import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

function Feedback({ state }: { state: ActionResult | undefined }) {
  if (!state) return null
  if (state.ok) {
    return <p className="text-xs text-green-400">{state.message ?? 'Listo.'}</p>
  }
  return <p className="text-xs text-red-400">{state.error}</p>
}

export function AdminTeamPanel({
  initialEmails,
  loginDomain,
}: {
  initialEmails: string[]
  loginDomain: string
}) {
  const router = useRouter()

  const [createState, createAction, createPending] = useActionState(createAdminUserAction, undefined)
  const [linkState, linkAction, linkPending] = useActionState(linkExistingAuthAdminAction, undefined)
  const [pwdState, pwdAction, pwdPending] = useActionState(setAdminPasswordAction, undefined)
  const [renameState, renameAction, renamePending] = useActionState(changeAdminLoginEmailAction, undefined)
  const [removeState, removeAction, removePending] = useActionState(removeAdminAction, undefined)

  useEffect(() => {
    const states = [createState, linkState, pwdState, renameState, removeState]
    const last = [...states].reverse().find((s) => s !== undefined)
    if (!last?.ok) return
    if (last.mustReauth) {
      const sb = createClient()
      void sb.auth.signOut().then(() => {
        window.location.href = '/admin/login'
      })
      return
    }
    router.refresh()
  }, [createState, linkState, pwdState, renameState, removeState, router])

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-rose-200">Administradores actuales</h2>
        <p className="mt-1 text-xs text-zinc-500">
          El login usa el mismo email en Authentication y en esta tabla. Sin @, el usuario es{' '}
          <code className="rounded bg-zinc-950 px-1 text-zinc-300">nombre@{loginDomain}</code>.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-zinc-200">
          {initialEmails.length === 0 ? (
            <li className="text-zinc-500">No hay filas en admin_users.</li>
          ) : (
            initialEmails.map((e) => (
              <li key={e} className="font-mono text-xs">
                {e}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-rose-200">Nuevo administrador</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Crea el usuario en Supabase Auth y lo agrega a admin_users (contraseña inicial).
        </p>
        <form action={createAction} className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              name="username"
              placeholder="Usuario (ej. andy)"
              className="min-w-[140px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
            <input
              name="password"
              type="password"
              placeholder="Contraseña (mín. 6)"
              className="min-w-[140px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={createPending}
            className="rounded bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {createPending ? 'Creando…' : 'Crear administrador'}
          </button>
          <Feedback state={createState} />
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-rose-200">Vincular usuario existente</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Si ya creaste el usuario en Authentication (Dashboard) y solo falta permitirle el panel.
        </p>
        <form action={linkAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            name="link_username"
            placeholder="Usuario o email"
            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={linkPending}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            {linkPending ? '…' : 'Vincular'}
          </button>
          <div className="w-full">
            <Feedback state={linkState} />
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-rose-200">Cambiar contraseña</h2>
        <form action={pwdAction} className="mt-3 space-y-2">
          <select
            name="pwd_email"
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Elegí administrador…
            </option>
            {initialEmails.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input
            name="new_password"
            type="password"
            placeholder="Nueva contraseña"
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            minLength={6}
            autoComplete="new-password"
            required
          />
          <button
            type="submit"
            disabled={pwdPending}
            className="rounded bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pwdPending ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
          <Feedback state={pwdState} />
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-rose-200">Cambiar usuario de ingreso</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Actualiza el email en Auth y en admin_users. Si cambiás el tuyo, al guardar se cierra la sesión y
          entrás con el nuevo nombre.
        </p>
        <form action={renameAction} className="mt-3 space-y-2">
          <input
            name="old_login"
            placeholder="Usuario o email actual (ej. lisbetcilla)"
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            required
          />
          <input
            name="new_username"
            placeholder="Nuevo usuario (solo nombre, sin @)"
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            required
          />
          <button
            type="submit"
            disabled={renamePending}
            className="rounded border border-rose-700 bg-rose-950/50 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-900/60 disabled:opacity-50"
          >
            {renamePending ? 'Aplicando…' : 'Cambiar usuario de login'}
          </button>
          <Feedback state={renameState} />
        </form>
      </section>

      <section className="rounded-xl border border-red-950/60 bg-red-950/20 p-4">
        <h2 className="text-sm font-semibold text-red-300">Quitar administrador</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Quita la fila en admin_users y borra el usuario de Authentication. No se puede si es el único.
        </p>
        <form
          action={removeAction}
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            if (!confirm('¿Eliminar este administrador de la lista y borrar su usuario de Authentication?')) {
              e.preventDefault()
            }
          }}
        >
          <select
            name="remove_email"
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Elegí cuenta a eliminar…
            </option>
            {initialEmails.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={removePending}
            className="rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {removePending ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
          <Feedback state={removeState} />
        </form>
      </section>
    </div>
  )
}
