'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatMoneyArs } from '@/lib/format'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

export type MozoProduct = {
  id: string
  name: string
  price: number
  stock_quantity: number
  image_path: string | null
  pathLabel: string
}

export function StockMozo({
  products,
  collapseTick = 0,
  expandTick = 0,
  bulkLockRef,
  onUserOpenedPanel,
}: {
  products: MozoProduct[]
  collapseTick?: number
  expandTick?: number
  bulkLockRef?: MutableRefObject<boolean>
  onUserOpenedPanel?: () => void
}) {
  const [q, setQ] = useState('')
  const [basket, setBasket] = useState<
    Record<string, { product: MozoProduct; qty: number }>
  >({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const catalogRef = useRef<HTMLDetailsElement>(null)
  const ticketRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (collapseTick === 0) return
    catalogRef.current?.removeAttribute('open')
    ticketRef.current?.removeAttribute('open')
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    if (catalogRef.current) catalogRef.current.open = true
    if (ticketRef.current) ticketRef.current.open = true
  }, [expandTick])

  function panelToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!onUserOpenedPanel || !bulkLockRef) return
    if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedPanel()
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) || p.pathLabel.toLowerCase().includes(s),
    )
  }, [products, q])

  function addOne(p: MozoProduct) {
    if (p.stock_quantity < 1) return
    setBasket((prev) => {
      const cur = prev[p.id]
      const nextQ = (cur?.qty ?? 0) + 1
      if (nextQ > p.stock_quantity) return prev
      return { ...prev, [p.id]: { product: p, qty: nextQ } }
    })
  }

  function setQty(id: string, qty: number) {
    setBasket((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const qn = Math.max(0, Math.floor(qty))
      if (qn === 0) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      if (qn > cur.product.stock_quantity) return prev
      return { ...prev, [id]: { ...cur, qty: qn } }
    })
  }

  const lines = Object.values(basket)
  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0)

  async function confirmSale() {
    if (lines.length === 0) return
    setBusy(true)
    setMsg('')
    const sb = createClient()
    const payload = lines.map((l) => ({
      product_id: l.product.id,
      quantity: l.qty,
      unit_price: l.product.price,
    }))
    const { error } = await sb.rpc('register_in_person_sale', { lines: payload })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setBasket({})
    setMsg('Venta registrada y stock actualizado.')
    window.location.reload()
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-lg font-semibold text-amber-100">Venta en persona</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Tocá productos para sumar al ticket. Confirma para descontar stock (sin cobro en esta pantalla).
      </p>

      <details
        ref={catalogRef}
        open
        onToggle={panelToggle}
        className="group mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/30 open:shadow-sm"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/80">
          <span>
            Catálogo <span className="text-zinc-500">({filtered.length})</span>
          </span>
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ease-out group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </summary>
        <div className="space-y-3 p-3">
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto rounded border border-zinc-800">
            {filtered.map((p) => {
              const img = getPublicUrlFromPath(p.image_path)
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.stock_quantity < 1}
                  onClick={() => addOne(p)}
                  className="flex w-full items-center gap-3 border-b border-zinc-800 px-2 py-2 text-left text-sm hover:bg-zinc-800/80 disabled:opacity-40"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-zinc-500">{p.pathLabel}</div>
                    <div className="text-xs text-amber-200">
                      {formatMoneyArs(p.price)} · stock {p.stock_quantity}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </details>

      <details
        ref={ticketRef}
        open
        onToggle={panelToggle}
        className="group mt-4 overflow-hidden rounded-lg border border-amber-900/50 bg-amber-950/30 open:shadow-md"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-amber-900/40 bg-amber-950/40 px-3 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-950/55">
          <span>Ticket actual</span>
          <svg
            className="h-4 w-4 shrink-0 text-amber-400/80 transition-transform duration-200 ease-out group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </summary>
        <div className="p-3">
          {lines.length === 0 ? (
            <p className="text-xs text-zinc-500">Vacío</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.product.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{l.product.name}</span>
                  <input
                    type="number"
                    min={1}
                    max={l.product.stock_quantity}
                    className="w-14 rounded border border-zinc-700 bg-zinc-950 px-1 text-center text-xs"
                    value={l.qty}
                    onChange={(e) =>
                      setQty(l.product.id, Number.parseInt(e.target.value, 10))
                    }
                  />
                  <span className="w-24 text-right text-amber-100">
                    {formatMoneyArs(l.product.price * l.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex justify-between border-t border-amber-900/40 pt-2 text-sm font-semibold">
            Total
            <span>{formatMoneyArs(total)}</span>
          </div>
          {msg ? <p className="mt-2 text-xs text-green-400">{msg}</p> : null}
          <button
            type="button"
            disabled={lines.length === 0 || busy}
            onClick={() => void confirmSale()}
            className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-40"
          >
            {busy ? 'Guardando…' : 'Confirmar venta (descontar stock)'}
          </button>
        </div>
      </details>
    </section>
  )
}
