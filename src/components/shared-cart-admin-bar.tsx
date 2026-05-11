'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SharedCartAdminBar({
  cartId,
  status,
}: {
  cartId: string
  status: 'pending' | 'accepted' | 'rejected'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  if (status !== 'pending') return null

  async function post(path: 'accept' | 'reject') {
    setBusy(path)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/carts/${cartId}/${path}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setMsg(js.error ?? 'Error')
        return
      }
      router.refresh()
    } catch {
      setMsg('Error de red')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-rose-800/50 bg-rose-950/25 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-rose-300/90">Panel admin</p>
      <p className="mb-3 text-sm text-zinc-400">
        Al <strong className="text-zinc-200">aceptar venta</strong> se descuenta el stock del depósito. Rechazá si el
        cliente no compra.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void post('accept')}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
        >
          {busy === 'accept' ? 'Procesando…' : 'Aceptar venta (descontar stock)'}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void post('reject')}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy === 'reject' ? '…' : 'Rechazar pedido'}
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm text-amber-300">{msg}</p> : null}
    </div>
  )
}
