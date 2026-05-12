'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatMoneyArs } from '@/lib/format'
import { storeCatalogFrameSubClass } from '@/lib/store-theme'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type MutableRefObject } from 'react'

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type SaleLine = {
  quantity: number
  unit_price: number
  product_id: string
  products: { name: string } | null
}

export type InPersonSaleRow = {
  id: string
  sold_at: string
  sold_by_email: string | null
  sold_by_display_name: string | null
  in_person_sale_lines: SaleLine[] | null
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function StockSalesHistory({
  collapseTick = 0,
  expandTick = 0,
  bulkLockRef,
  onUserOpenedPanel,
}: {
  collapseTick?: number
  expandTick?: number
  bulkLockRef?: MutableRefObject<boolean>
  onUserOpenedPanel?: () => void
}) {
  const router = useRouter()

  const today = new Date()
  const [from, setFrom] = useState(() => toInputDate(startOfLocalDay(today)))
  const [to, setTo] = useState(() => toInputDate(endOfLocalDay(today)))
  const [searchDay, setSearchDay] = useState('')
  const [sales, setSales] = useState<InPersonSaleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    const fromD = startOfLocalDay(new Date(from + 'T12:00:00'))
    const toD = endOfLocalDay(new Date(to + 'T12:00:00'))
    if (toD < fromD) {
      setErr('La fecha hasta debe ser posterior o igual a la fecha desde.')
      setLoading(false)
      return
    }
    const sb = createClient()
    const { data, error } = await sb
      .from('in_person_sales')
      .select(
        `
        id,
        sold_at,
        sold_by_email,
        sold_by_display_name,
        in_person_sale_lines (
          quantity,
          unit_price,
          product_id,
          products ( name )
        )
      `,
      )
      .gte('sold_at', fromD.toISOString())
      .lte('sold_at', toD.toISOString())
      .order('sold_at', { ascending: false })

    setLoading(false)
    if (error) {
      setErr(error.message)
      setSales([])
      return
    }
    setSales((data ?? []) as unknown as InPersonSaleRow[])
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (collapseTick === 0) return
    const el = document.querySelector<HTMLDetailsElement>('[data-stock-history-panel]')
    el?.removeAttribute('open')
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    const el = document.querySelector<HTMLDetailsElement>('[data-stock-history-panel]')
    if (el) el.open = true
  }, [expandTick])

  function panelToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!onUserOpenedPanel || !bulkLockRef) return
    if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedPanel()
  }

  function applySearchDay() {
    const s = searchDay.trim()
    if (!s) return
    setFrom(s)
    setTo(s)
  }

  function goToTodaySales() {
    const day = toInputDate(new Date())
    setFrom(day)
    setTo(day)
    setSearchDay(day)
  }

  const dayShortcutBtnClass =
    'rounded-lg border border-zinc-500/60 bg-zinc-500/85 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-400/90'

  async function confirmDelete() {
    if (!deleteId) return
    setBusyDelete(true)
    const sb = createClient()
    const { error } = await sb.rpc('delete_in_person_sale', { p_sale_id: deleteId })
    setBusyDelete(false)
    if (error) {
      setErr(error.message)
      setDeleteId(null)
      return
    }
    setDeleteId(null)
    router.refresh()
    void load()
  }

  return (
    <section className={`${storeCatalogFrameSubClass} p-4`}>
      <h2 className="text-lg font-semibold text-sky-100">Historial de ventas</h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="hist-from" className="block text-[10px] font-medium uppercase text-white">
            Desde
          </label>
          <input
            id="hist-from"
            name="stock_hist_date_from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="hist-to" className="block text-[10px] font-medium uppercase text-white">
            Hasta
          </label>
          <input
            id="hist-to"
            name="stock_hist_date_to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {loading ? 'Cargando…' : 'Buscar'}
        </button>
        <div className="flex flex-wrap items-end gap-2 border-l border-zinc-700 pl-3">
          <div>
            <label htmlFor="hist-day" className="block text-[10px] font-medium uppercase text-zinc-500">
              Un día
            </label>
            <input
              id="hist-day"
              name="stock_hist_search_day"
              type="date"
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              className="mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="button" onClick={goToTodaySales} className={dayShortcutBtnClass}>
            Ventas de hoy
          </button>
          <button type="button" onClick={applySearchDay} className={dayShortcutBtnClass}>
            Ir a ese día
          </button>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-rose-400">{err}</p> : null}

      <details
        data-stock-history-panel
        open
        onToggle={panelToggle}
        className="group mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/30 open:shadow-sm"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm font-medium text-zinc-200">
          <span>Resultados ({sales.length})</span>
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </summary>
        <div className="max-h-[min(60vh,24rem)] space-y-3 overflow-y-auto p-3">
          {sales.length === 0 && !loading ? (
            <p className="text-sm text-white">No hay ventas en el rango elegido.</p>
          ) : (
            <ul className="space-y-3">
              {sales.map((sale) => {
                const lines = sale.in_person_sale_lines ?? []
                const saleTotal = lines.reduce(
                  (s, l) => s + l.quantity * Number(l.unit_price),
                  0,
                )
                const when = new Date(sale.sold_at)
                const dateStr = when.toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
                const timeStr = when.toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const who =
                  sale.sold_by_display_name?.trim() ||
                  sale.sold_by_email?.trim() ||
                  'Admin'
                return (
                  <li
                    key={sale.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-zinc-500">
                          {dateStr} · {timeStr}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-sky-200">{who}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-rose-200">{formatMoneyArs(saleTotal)}</span>
                        <button
                          type="button"
                          className="rounded border border-rose-800/60 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/40"
                          onClick={() => setDeleteId(sale.id)}
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-1 text-zinc-300">
                      {lines.map((l, i) => (
                        <li key={`${sale.id}-${l.product_id}-${i}`}>
                          {l.products?.name ?? 'Producto'} × {l.quantity} —{' '}
                          {formatMoneyArs(l.quantity * Number(l.unit_price))}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>

      {deleteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-600 bg-zinc-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-rose-100">¿Borrar esta venta?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Se eliminará solo el registro de esta venta del historial. El stock del depósito no se
              modifica.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={() => setDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyDelete}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
                onClick={() => void confirmDelete()}
              >
                {busyDelete ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
