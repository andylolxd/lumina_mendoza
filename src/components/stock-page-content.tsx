'use client'

import { StockMozo, type MozoProduct } from '@/components/stock-mozo'
import { formatMoneyArs } from '@/lib/format'
import { useEffect, useRef, useState } from 'react'

type SaleLine = {
  quantity: number
  unit_price: number
  products: { name: string } | { name: string }[] | null
}

type Sale = {
  id: string
  sold_at: string
  in_person_sale_lines: SaleLine[] | null
}

const collapseAllBtnClass =
  'shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-rose-600/50 hover:bg-zinc-700 hover:text-rose-100'

export function StockPageContent({
  products,
  sales,
}: {
  products: MozoProduct[]
  sales: Sale[]
}) {
  const [collapseTick, setCollapseTick] = useState(0)
  const [expandTick, setExpandTick] = useState(0)
  const [showExpandAll, setShowExpandAll] = useState(false)
  const bulkLockRef = useRef(false)
  const historyRef = useRef<HTMLDetailsElement>(null)

  const runBulkLocked = (fn: () => void) => {
    bulkLockRef.current = true
    fn()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bulkLockRef.current = false
      })
    })
  }

  const handleCollapseAll = () => {
    runBulkLocked(() => {
      setCollapseTick((n) => n + 1)
      setShowExpandAll(true)
    })
  }

  const handleExpandAll = () => {
    runBulkLocked(() => {
      setExpandTick((n) => n + 1)
      setShowExpandAll(false)
    })
  }

  const handleUserOpenedPanel = () => {
    if (!bulkLockRef.current) setShowExpandAll(false)
  }

  useEffect(() => {
    if (collapseTick === 0) return
    historyRef.current?.removeAttribute('open')
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    if (historyRef.current) historyRef.current.open = true
  }, [expandTick])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-rose-100">Stock</h1>
          <p className="text-sm text-zinc-500">
            Venta en persona descuenta inventario. Historial del día (desde medianoche).
          </p>
        </div>
        {showExpandAll ? (
          <button type="button" className={collapseAllBtnClass} onClick={handleExpandAll}>
            Abrir todo
          </button>
        ) : (
          <button type="button" className={collapseAllBtnClass} onClick={handleCollapseAll}>
            Contraer todo
          </button>
        )}
      </div>

      <StockMozo
        products={products}
        collapseTick={collapseTick}
        expandTick={expandTick}
        bulkLockRef={bulkLockRef}
        onUserOpenedPanel={handleUserOpenedPanel}
      />

      <details
        ref={historyRef}
        open
        onToggle={(e) => {
          if (e.currentTarget.open && !bulkLockRef.current) handleUserOpenedPanel()
        }}
        className="group rounded-xl border border-zinc-800 bg-zinc-900/40 open:shadow-md"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-xl border-b border-zinc-800 bg-zinc-950/50 px-4 py-3 text-lg font-semibold text-zinc-200 transition hover:bg-zinc-900/80">
          <span>Historial de hoy</span>
          <svg
            className="h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 ease-out group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </summary>
        <div className="p-4 pt-3">
          {sales.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no hay ventas registradas hoy.</p>
          ) : (
            <ul className="space-y-4">
              {sales.map((sale) => {
                const lines = sale.in_person_sale_lines ?? []
                const saleTotal = lines.reduce(
                  (s, l) => s + l.quantity * Number(l.unit_price),
                  0,
                )
                const time = new Date(sale.sold_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <li
                    key={sale.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm"
                  >
                    <div className="mb-2 flex justify-between text-xs text-zinc-500">
                      <span>{time}</span>
                      <span className="font-medium text-rose-200">
                        {formatMoneyArs(saleTotal)}
                      </span>
                    </div>
                    <ul className="space-y-1 text-zinc-300">
                      {lines.map((l, i) => {
                        const pname = Array.isArray(l.products)
                          ? l.products[0]?.name
                          : l.products?.name
                        return (
                          <li key={i}>
                            {pname ?? 'Producto'} × {l.quantity} —{' '}
                            {formatMoneyArs(l.quantity * Number(l.unit_price))}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  )
}
