'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatMoneyArs } from '@/lib/format'
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import type { InPersonSaleRow } from '@/components/stock-sales-history'

const WEEK_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function dayBucketKey(d: Date): string {
  return d.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

type AdminOption = { key: string; label: string }

export function StockSalesStats({
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
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)

  const [from, setFrom] = useState(() => toInputDate(startOfLocalDay(start)))
  const [to, setTo] = useState(() => toInputDate(endOfLocalDay(end)))
  const [weekdayOn, setWeekdayOn] = useState<boolean[]>(() => Array(7).fill(true))
  const [adminFilter, setAdminFilter] = useState('')
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([])
  const [sales, setSales] = useState<InPersonSaleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const loadAdmins = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.rpc('list_admin_users_directory')
    if (error || !data) return
    const opts: AdminOption[] = (data as { email: string; display_name: string }[]).map((r) => {
      const label = (r.display_name?.trim() || r.email).trim()
      return { key: r.email, label }
    })
    setAdminOptions(opts)
  }, [])

  const loadSales = useCallback(async () => {
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
      .order('sold_at', { ascending: true })

    setLoading(false)
    if (error) {
      setErr(error.message)
      setSales([])
      return
    }
    setSales((data ?? []) as unknown as InPersonSaleRow[])
  }, [from, to])

  useEffect(() => {
    void loadAdmins()
  }, [loadAdmins])

  useEffect(() => {
    void loadSales()
  }, [loadSales])

  useEffect(() => {
    if (collapseTick === 0) return
    document.querySelector<HTMLDetailsElement>('[data-stock-stats-panel]')?.removeAttribute('open')
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    const el = document.querySelector<HTMLDetailsElement>('[data-stock-stats-panel]')
    if (el) el.open = true
  }, [expandTick])

  function panelToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!onUserOpenedPanel || !bulkLockRef) return
    if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedPanel()
  }

  const allWeekdaysOn = weekdayOn.every(Boolean)

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.sold_at)
      if (!allWeekdaysOn && !weekdayOn[d.getDay()]) return false
      if (!adminFilter) return true
      const email = (s.sold_by_email ?? '').trim().toLowerCase()
      return email === adminFilter.toLowerCase()
    })
  }, [sales, weekdayOn, allWeekdaysOn, adminFilter])

  const stats = useMemo(() => {
    let totalMoney = 0
    let lineCount = 0
    const byDay = new Map<string, { count: number; money: number }>()
    const byProduct = new Map<string, { name: string; units: number; money: number }>()

    for (const sale of filteredSales) {
      const dayKey = dayBucketKey(new Date(sale.sold_at))
      const lines = sale.in_person_sale_lines ?? []
      let saleSum = 0
      for (const l of lines) {
        const m = l.quantity * Number(l.unit_price)
        saleSum += m
        lineCount += l.quantity
        const pname = l.products?.name ?? 'Producto'
        const pid = l.product_id
        const cur = byProduct.get(pid) ?? { name: pname, units: 0, money: 0 }
        cur.units += l.quantity
        cur.money += m
        byProduct.set(pid, cur)
      }
      totalMoney += saleSum
      const dc = byDay.get(dayKey) ?? { count: 0, money: 0 }
      dc.count += 1
      dc.money += saleSum
      byDay.set(dayKey, dc)
    }

    const byDaySorted = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
    const topProducts = [...byProduct.entries()]
      .sort(([, a], [, b]) => b.units - a.units)
      .slice(0, 15)
      .map(([id, v]) => ({ id, ...v }))

    const sumSatSunOnly = filteredSales
      .filter((s) => {
        const wd = new Date(s.sold_at).getDay()
        return wd === 0 || wd === 6
      })
      .reduce((acc, sale) => {
        const lines = sale.in_person_sale_lines ?? []
        return (
          acc +
          lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
        )
      }, 0)

    return {
      saleCount: filteredSales.length,
      totalMoney,
      lineCount,
      byDaySorted,
      topProducts,
      sumSatSunOnly,
    }
  }, [filteredSales])

  function setPresetDays(n: number) {
    const t = new Date()
    const s = new Date()
    s.setDate(t.getDate() - (n - 1))
    setFrom(toInputDate(startOfLocalDay(s)))
    setTo(toInputDate(endOfLocalDay(t)))
  }

  function toggleWeekday(i: number) {
    setWeekdayOn((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  function selectOnlyWeekend() {
    setWeekdayOn([true, false, false, false, false, false, true])
  }

  function selectAllWeekdays() {
    setWeekdayOn(Array(7).fill(true))
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-lg font-semibold text-violet-100">Estadísticas</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Resumen según rango de fechas. Podés filtrar por día de la semana y por quién registró la
        venta (nombre en admin_users.display_name).
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="stock-stats-from"
            className="block text-[10px] font-medium uppercase text-zinc-500"
          >
            Desde
          </label>
          <input
            id="stock-stats-from"
            name="stock_stats_date_from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="stock-stats-to"
            className="block text-[10px] font-medium uppercase text-zinc-500"
          >
            Hasta
          </label>
          <input
            id="stock-stats-to"
            name="stock_stats_date_to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadSales()}
          className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="w-full text-[10px] font-medium uppercase text-zinc-500">Rango rápido</span>
        {[7, 14, 30, 90].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPresetDays(n)}
            className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Últimos {n} días
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase text-zinc-500">Días de semana</span>
          <button
            type="button"
            onClick={selectAllWeekdays}
            className="text-[11px] text-violet-300 underline-offset-2 hover:underline"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={selectOnlyWeekend}
            className="text-[11px] text-violet-300 underline-offset-2 hover:underline"
          >
            Solo sáb y dom
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEK_LABELS.map((lab, i) => (
            <label
              key={lab}
              htmlFor={`stock-stats-weekday-${i}`}
              className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                weekdayOn[i]
                  ? 'border-violet-500/60 bg-violet-950/40 text-violet-100'
                  : 'border-zinc-700 bg-zinc-950 text-zinc-500'
              }`}
            >
              <input
                id={`stock-stats-weekday-${i}`}
                name={`stock_stats_weekday_${i}`}
                type="checkbox"
                className="sr-only"
                checked={weekdayOn[i]}
                onChange={() => toggleWeekday(i)}
              />
              {lab}
            </label>
          ))}
        </div>
        {!allWeekdaysOn ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            Solo se cuentan ventas cuya fecha cae en los días marcados.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="stats-admin" className="block text-[10px] font-medium uppercase text-zinc-500">
          Vendedor (admin)
        </label>
        <select
          id="stats-admin"
          name="stock_stats_admin_filter"
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
          className="mt-1 max-w-xs rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          {adminOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {err ? <p className="mt-2 text-xs text-rose-400">{err}</p> : null}

      <details
        data-stock-stats-panel
        open
        onToggle={panelToggle}
        className="group mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/30 open:shadow-sm"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm font-medium text-zinc-200">
          <span>Resumen numérico</span>
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </summary>
        <div className="space-y-4 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Ventas (registros)</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-100">{stats.saleCount}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Total $</div>
              <div className="mt-1 text-xl font-semibold text-violet-200">
                {formatMoneyArs(stats.totalMoney)}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Unidades (líneas)</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-100">{stats.lineCount}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Sáb + dom (en filtros)</div>
              <div className="mt-1 text-lg font-semibold text-emerald-200">
                {formatMoneyArs(stats.sumSatSunOnly)}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Suma de ventas en sábado y domingo (respeta rango, toggles de día y filtro de admin).
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Por día</h3>
            <div className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Ventas</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byDaySorted.map(([day, row]) => (
                    <tr key={day} className="border-t border-zinc-800/80">
                      <td className="px-2 py-1.5 text-zinc-300">{day}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{row.count}</td>
                      <td className="px-2 py-1.5 text-right text-violet-200">
                        {formatMoneyArs(row.money)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Productos más vendidos (unidades)</h3>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded border border-zinc-800 p-2 text-xs">
              {stats.topProducts.length === 0 ? (
                <li className="text-zinc-500">Sin datos en el filtro actual.</li>
              ) : (
                stats.topProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between gap-2 border-b border-zinc-800/60 py-1 last:border-0"
                  >
                    <span className="min-w-0 truncate text-zinc-300">{p.name}</span>
                    <span className="shrink-0 text-zinc-500">
                      {p.units} u. · {formatMoneyArs(p.money)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </details>
    </section>
  )
}
