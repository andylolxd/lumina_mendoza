'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatMoneyArs } from '@/lib/format'
import { appBaseUrl } from '@/lib/publicUrl'

export type PedidoListRow = {
  id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  accepted_at: string | null
  accepted_by_email: string | null
  customer_whatsapp_e164: string | null
  total: number
  lineCount: number
}

function statusLabel(s: PedidoListRow['status']) {
  if (s === 'pending') return 'Pendiente'
  if (s === 'accepted') return 'Aceptado'
  return 'Rechazado'
}

function statusClass(s: PedidoListRow['status']) {
  if (s === 'pending') return 'border-amber-700/50 bg-amber-950/30 text-amber-200'
  if (s === 'accepted') return 'border-green-800/50 bg-green-950/25 text-green-200'
  return 'border-zinc-600 bg-zinc-900/60 text-zinc-400'
}

export function PedidosPanel({ initialRows }: { initialRows: PedidoListRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<'accept' | 'reject' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function act(id: string, path: 'accept' | 'reject') {
    setBusyId(id)
    setBusyKind(path)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/carts/${id}/${path}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(js.error ?? 'Error')
        return
      }
      router.refresh()
    } catch {
      setErr('Error de red')
    } finally {
      setBusyId(null)
      setBusyKind(null)
    }
  }

  const base = appBaseUrl()

  return (
    <div>
      {err ? (
        <p className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {err}
        </p>
      ) : null}
      {initialRows.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay pedidos por carrito compartido.</p>
      ) : (
        <ul className="space-y-3">
          {initialRows.map((row) => {
            const cartUrl = `${base}/c/${row.id}`
            const loading = busyId === row.id
            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(row.created_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300">
                    {row.lineCount} ítem{row.lineCount === 1 ? '' : 's'} · Total{' '}
                    <span className="font-semibold text-rose-200">{formatMoneyArs(row.total)}</span>
                  </p>
                  {row.customer_whatsapp_e164 ? (
                    <p className="text-xs text-zinc-500">
                      Cliente WA: <span className="tabular-nums text-zinc-400">+{row.customer_whatsapp_e164}</span>
                    </p>
                  ) : null}
                  {row.status === 'accepted' && row.accepted_at ? (
                    <p className="text-xs text-zinc-500">
                      Aceptado{' '}
                      {new Date(row.accepted_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {row.accepted_by_email ? ` · ${row.accepted_by_email}` : ''}
                    </p>
                  ) : null}
                  <Link href={cartUrl} className="inline-block text-sm text-rose-400 underline hover:text-rose-300">
                    Ver carrito / link cliente
                  </Link>
                </div>
                {row.status === 'pending' ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void act(row.id, 'accept')}
                      className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      {loading && busyKind === 'accept' ? '…' : 'Aceptar venta'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void act(row.id, 'reject')}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {loading && busyKind === 'reject' ? '…' : 'Rechazar'}
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
