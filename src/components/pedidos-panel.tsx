'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatMoneyArs } from '@/lib/format'
import { appBaseUrl } from '@/lib/publicUrl'

export type PedidoListRow = {
  id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  accepted_at: string | null
  accepted_by_email: string | null
  customer_whatsapp_e164: string | null
  admin_note: string | null
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

const pedidoStatusBadgeFrame =
  'rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide'

function historySortKey(r: PedidoListRow) {
  if (r.status === 'accepted' && r.accepted_at) return new Date(r.accepted_at).getTime()
  return new Date(r.created_at).getTime()
}

export function PedidosPanel({ initialRows }: { initialRows: PedidoListRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<'accept' | 'reject' | 'delete' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<
    { kind: 'accept' | 'reject' | 'delete'; row: PedidoListRow } | null
  >(null)

  const pendientes = useMemo(
    () => initialRows.filter((r) => r.status === 'pending'),
    [initialRows],
  )
  const historial = useMemo(() => {
    const h = initialRows.filter((r) => r.status !== 'pending')
    return [...h].sort((a, b) => historySortKey(b) - historySortKey(a))
  }, [initialRows])

  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  async function deleteCart(id: string) {
    setBusyId(id)
    setBusyKind('delete')
    setErr(null)
    try {
      const res = await fetch(`/api/admin/carts/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(js.error ?? 'Error')
        return
      }
      setConfirm(null)
      router.refresh()
    } catch {
      setErr('Error de red')
    } finally {
      setBusyId(null)
      setBusyKind(null)
    }
  }

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
      setConfirm(null)
      router.refresh()
    } catch {
      setErr('Error de red')
    } finally {
      setBusyId(null)
      setBusyKind(null)
    }
  }

  const base = appBaseUrl()

  const rowsToShow = tab === 'pendientes' ? pendientes : historial

  return (
    <div>
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirm(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pedido-confirm-title"
            className={
              confirm.kind === 'delete'
                ? 'max-h-[min(88vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-red-900/55 bg-zinc-950 p-6 shadow-2xl shadow-black/50 ring-1 ring-red-950/25'
                : 'max-h-[min(88vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-rose-900/50 bg-zinc-950 p-6 shadow-2xl shadow-black/50 ring-1 ring-rose-950/30'
            }
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="pedido-confirm-title" className="text-lg font-semibold text-rose-100">
              {confirm.kind === 'accept'
                ? 'Confirmar venta'
                : confirm.kind === 'reject'
                  ? 'Confirmar rechazo'
                  : 'Eliminar del historial'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              {confirm.kind === 'accept' ? (
                <>
                  Vas a <strong className="text-zinc-100">aceptar</strong> este pedido y se{' '}
                  <strong className="text-zinc-100">descontará el stock</strong> del depósito según las cantidades del
                  carrito. Verificá que el pago esté acordado.
                </>
              ) : confirm.kind === 'reject' ? (
                <>
                  Vas a <strong className="text-zinc-100">rechazar</strong> este pedido. No se descuenta stock; el
                  cliente puede ver el estado en el enlace del carrito.
                </>
              ) : (
                <>
                  Vas a <strong className="text-zinc-100">borrar</strong> este registro del panel. El enlace público
                  del carrito <strong className="text-zinc-100">dejará de funcionar</strong>. No se revierte stock: si la
                  venta ya estaba aceptada, el inventario ya quedó descontado.
                </>
              )}
            </p>
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-500">Ítems:</span>{' '}
                <span className="font-medium text-zinc-100">{confirm.row.lineCount}</span>
              </p>
              <p className="mt-1">
                <span className="text-zinc-500">Total:</span>{' '}
                <span className="font-semibold text-rose-200">{formatMoneyArs(confirm.row.total)}</span>
              </p>
              {confirm.row.customer_whatsapp_e164 ? (
                <p className="mt-1 text-xs">
                  <span className="text-zinc-500">Cliente WA:</span>{' '}
                  <span className="tabular-nums text-zinc-400">+{confirm.row.customer_whatsapp_e164}</span>
                </p>
              ) : null}
              {confirm.row.admin_note ? (
                <p className="mt-2 border-t border-zinc-800/80 pt-2 text-xs leading-relaxed text-zinc-400">
                  <span className="font-medium text-zinc-500">Nota interna:</span>{' '}
                  <span className="text-zinc-200">{confirm.row.admin_note}</span>
                </p>
              ) : null}
              <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">ID {confirm.row.id}</p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                onClick={() => setConfirm(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId != null}
                className={
                  confirm.kind === 'accept'
                    ? 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50'
                    : confirm.kind === 'reject'
                      ? 'rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50'
                      : 'rounded-lg border border-red-800/70 bg-red-900/50 px-4 py-2.5 text-sm font-semibold text-red-50 hover:bg-red-800/60 disabled:opacity-50'
                }
                onClick={() =>
                  confirm.kind === 'delete'
                    ? void deleteCart(confirm.row.id)
                    : void act(confirm.row.id, confirm.kind)
                }
              >
                {busyId === confirm.row.id
                  ? 'Procesando…'
                  : confirm.kind === 'accept'
                    ? 'Sí, aceptar venta'
                    : confirm.kind === 'reject'
                      ? 'Sí, rechazar pedido'
                      : 'Sí, eliminar del historial'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {err}
        </p>
      ) : null}

      {initialRows.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay pedidos por carrito compartido.</p>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setTab('pendientes')}
              className={
                tab === 'pendientes'
                  ? '-mb-px border-b-2 border-rose-500 px-3 py-2 text-sm font-semibold text-rose-100'
                  : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300'
              }
            >
              Pedidos ({pendientes.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('historial')}
              className={
                tab === 'historial'
                  ? '-mb-px border-b-2 border-rose-500 px-3 py-2 text-sm font-semibold text-rose-100'
                  : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300'
              }
            >
              Historial ({historial.length})
            </button>
          </div>

          {rowsToShow.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {tab === 'pendientes'
                ? 'No hay pedidos pendientes.'
                : 'Todavía no hay ventas confirmadas ni pedidos rechazados.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {rowsToShow.map((row) => {
                const cartUrl = `${base}/c/${row.id}`
                const loading = busyId === row.id
                const showActions = tab === 'pendientes' && row.status === 'pending'
                const showHistorialDelete =
                  tab === 'historial' && (row.status === 'accepted' || row.status === 'rejected')
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1 pb-3 sm:pb-0">
                      {row.admin_note ? (
                        <div className="flex w-full min-w-0 items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span
                              className={`${pedidoStatusBadgeFrame} ${statusClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                            <span className="min-w-0 text-xs text-zinc-500 sm:tabular-nums">
                              {new Date(row.created_at).toLocaleString('es-AR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          <div className="flex min-w-0 max-w-[11rem] shrink-0 flex-col gap-1 sm:max-w-[20rem]">
                            <span
                              className={`w-fit ${pedidoStatusBadgeFrame} ${statusClass('pending')}`}
                            >
                              Nota
                            </span>
                            <p
                              className="line-clamp-2 w-full break-words text-left text-xs leading-snug text-zinc-300"
                              title={row.admin_note}
                            >
                              {row.admin_note}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={`${pedidoStatusBadgeFrame} ${statusClass(row.status)}`}
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
                      )}
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
                      {row.status === 'rejected' ? (
                        <p className="text-xs text-zinc-500">Cerrado sin venta (rechazado).</p>
                      ) : null}
                      <p className="pt-1">
                        <Link
                          href={cartUrl}
                          className="inline-block text-sm text-rose-400 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-300"
                        >
                          Ver carrito / link cliente
                        </Link>
                      </p>
                    </div>
                    {showActions ? (
                      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 border-t border-zinc-800/80 pt-3 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:border-t-0 sm:border-l sm:border-zinc-800/80 sm:pl-4 sm:pt-0">
                        <div className="flex w-full justify-end gap-2 sm:w-auto">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setConfirm({ kind: 'accept', row })}
                            className="min-h-[44px] min-w-[7.5rem] rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50 sm:min-h-0"
                          >
                            {loading && busyKind === 'accept' ? '…' : 'Aceptar venta'}
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setConfirm({ kind: 'reject', row })}
                            className="min-h-[44px] min-w-[6.5rem] rounded-lg border border-zinc-500 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 sm:min-h-0"
                          >
                            {loading && busyKind === 'reject' ? '…' : 'Rechazar'}
                          </button>
                        </div>
                      </div>
                    ) : showHistorialDelete ? (
                      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 border-t border-zinc-800/80 pt-3 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:border-t-0 sm:border-l sm:border-zinc-800/80 sm:pl-4 sm:pt-0">
                        <div className="flex w-full justify-end sm:w-auto">
                          <button
                            type="button"
                            disabled={loading}
                            aria-label="Eliminar este pedido del historial"
                            onClick={() => setConfirm({ kind: 'delete', row })}
                            className="min-h-[44px] rounded-lg border border-red-800/60 bg-red-950/35 px-4 py-2 text-xs font-semibold text-red-100 hover:bg-red-950/55 disabled:opacity-50 sm:min-h-0"
                          >
                            {loading && busyKind === 'delete' ? '…' : 'Eliminar del historial'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
