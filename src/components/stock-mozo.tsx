'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatCatalogPath } from '@/lib/catalog-tree'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { collectProductImagePaths } from '@/lib/product-images'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import type { CategoryRow, ProductRow, SubcategoryRow, SubsubcategoriaRow } from '@/types/catalog'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

export type MozoProduct = {
  id: string
  name: string
  price: number
  stock_quantity: number
  image_path: string | null
  pathLabel: string
}

function sortByOrder<T extends { sort_order: number }>(arr: T[] | null | undefined): T[] {
  return [...(arr ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

type CategoryView = Omit<CategoryRow, 'subcategories'> & {
  subcategories: SubcategoryRow[]
}

/** Igual que la tienda: solo productos `active`; sin ramas vacías. */
function sortCatalogLikeStore(categories: CategoryRow[]): CategoryView[] {
  return sortByOrder(categories)
    .map((c) => ({
      ...c,
      subcategories: sortByOrder(c.subcategories ?? [])
        .map((s) => ({
          ...s,
          products: sortByOrder((s.products ?? []).filter((p) => p.active)),
          subsubcategorias: sortByOrder(s.subsubcategorias ?? [])
            .map((ss) => ({
              ...ss,
              products: sortByOrder((ss.products ?? []).filter((p) => p.active)),
            }))
            .filter((ss) => ss.products.length > 0),
        }))
        .filter((s) => s.products.length > 0 || s.subsubcategorias.length > 0),
    }))
    .filter((c) => c.subcategories.length > 0)
}

function productMatchesQuery(p: ProductRow, pathLabel: string, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return p.name.toLowerCase().includes(s) || pathLabel.toLowerCase().includes(s)
}

function filterStockTree(cats: CategoryView[], q: string): CategoryView[] {
  const s = q.trim().toLowerCase()
  if (!s) return cats
  const out: CategoryView[] = []
  for (const c of cats) {
    const subs: SubcategoryRow[] = []
    for (const sub of c.subcategories) {
      const pathDirect = formatCatalogPath([c.name, sub.name, null])
      const direct = sub.products.filter((p) => productMatchesQuery(p, pathDirect, s))
      const ssOut: SubsubcategoriaRow[] = []
      for (const ss of sub.subsubcategorias ?? []) {
        const pathSs = formatCatalogPath([c.name, sub.name, ss.name])
        const prods = ss.products.filter((p) => productMatchesQuery(p, pathSs, s))
        if (prods.length > 0) ssOut.push({ ...ss, products: prods })
      }
      if (direct.length > 0 || ssOut.length > 0) {
        subs.push({ ...sub, products: direct, subsubcategorias: ssOut })
      }
    }
    if (subs.length > 0) out.push({ ...c, subcategories: subs })
  }
  return out
}

/** Misma cuenta que la tienda: productos listados en la sub (directos + sub-sub). */
function countProductsInSub(node: SubcategoryRow): number {
  const direct = node.products?.length ?? 0
  const inSs =
    node.subsubcategorias?.reduce((n, ss) => n + (ss.products?.length ?? 0), 0) ?? 0
  return direct + inSs
}

function countProductsInTree(cats: CategoryView[]): number {
  let n = 0
  for (const c of cats) {
    for (const sub of c.subcategories) {
      n += countProductsInSub(sub)
    }
  }
  return n
}

function toMozoProduct(p: ProductRow, pathSegments: [string, string, string | null]): MozoProduct {
  const pathLabel = formatCatalogPath(pathSegments) || '—'
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    stock_quantity: p.stock_quantity,
    image_path: p.image_path,
    pathLabel,
  }
}

const chevron = () => (
  <svg
    className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ease-out group-open:rotate-180"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
  >
    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
  </svg>
)

const storeAccordionCountBadgeBase =
  'inline-flex min-h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none'
const storeAccordionCountCategory = `${storeAccordionCountBadgeBase} border-rose-800/55 bg-rose-950/70 text-rose-50 shadow-sm shadow-black/20`
const storeAccordionCountSub = `${storeAccordionCountBadgeBase} border-zinc-500/75 bg-zinc-950/85 text-zinc-100 shadow-sm shadow-black/15`
const storeAccordionCountSubsub = `${storeAccordionCountBadgeBase} border-rose-800/55 bg-black/35 text-rose-50 shadow-sm shadow-rose-950/20`

const frameCategory =
  'group scroll-mt-2 overflow-hidden rounded-xl border-2 border-rose-900/45 bg-zinc-900/35 shadow-md shadow-black/20 ring-1 ring-zinc-800/40 transition-[border-color,box-shadow] duration-200 open:border-rose-500/55 open:ring-2 open:ring-rose-500/20'

const frameSub =
  'group overflow-hidden rounded-lg border-2 border-zinc-800/90 bg-zinc-950/25 shadow-sm ring-1 ring-zinc-800/35 transition-[border-color] duration-200 open:border-amber-700/45 open:ring-1 open:ring-amber-600/25'

const frameSubsub =
  'group overflow-hidden rounded-md border-2 border-rose-900/35 bg-zinc-950/20 shadow-sm ring-1 ring-zinc-800/30 transition-[border-color] duration-200 open:border-rose-500/40 open:bg-rose-950/10'

const summaryCategory =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-rose-900/30 bg-gradient-to-r from-rose-950/40 to-zinc-900/40 px-3 py-2.5 transition hover:from-rose-900/45 hover:to-zinc-800/50'

const summarySub =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-zinc-800/60 bg-zinc-900/50 px-3 py-2 transition hover:bg-zinc-800/60'

const summarySubsub =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-rose-900/25 bg-rose-950/25 px-2.5 py-2 transition hover:bg-rose-950/40'

const minusBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-rose-700/50 bg-zinc-950/90 text-lg font-semibold leading-none text-rose-100 shadow-inner shadow-black/20 transition hover:border-rose-500/70 hover:bg-rose-950/50 active:scale-95 disabled:pointer-events-none disabled:opacity-35'

const plusBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-rose-500/60 bg-gradient-to-b from-rose-600 to-rose-800 text-lg font-semibold leading-none text-white shadow-md shadow-rose-950/40 transition hover:from-rose-500 hover:to-rose-700 active:scale-95 disabled:pointer-events-none disabled:opacity-35'

function StockProductLine({
  product,
  pathSegments,
  ticketQty,
  onInc,
  onDec,
}: {
  product: ProductRow
  pathSegments: [string, string, string | null]
  ticketQty: number
  onInc: () => void
  onDec: () => void
}) {
  const mozo = toMozoProduct(product, pathSegments)
  const paths = collectProductImagePaths(product)
  const thumbUrl = paths[0] ? getPublicUrlFromPath(paths[0]) : null
  const maxStock = product.stock_quantity
  const addBlocked = maxStock < 1 || ticketQty >= maxStock
  const unitPrice = mozo.price

  return (
    <article className="overflow-visible rounded-lg border border-red-500/45 bg-zinc-950/25 p-2 shadow-md ring-1 ring-red-500/25 sm:p-3">
      <div className="min-w-0 rounded-lg border border-zinc-800/60 bg-zinc-900/45 p-3">
        <h3 className="mb-2 text-sm font-medium leading-snug text-zinc-100">{product.name}</h3>
        <div className="flex gap-3">
          {paths.length > 0 ? (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                  foto
                </div>
              )}
              {paths.length > 1 ? (
                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-zinc-200">
                  +{paths.length - 1}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800 text-[10px] text-zinc-600">
              sin foto
            </div>
          )}
          <div className="min-w-0 flex-1">
            {product.description ? (
              <p className="line-clamp-2 text-xs text-zinc-500">{product.description}</p>
            ) : null}
            <p className="mt-2 text-rose-300">{formatMoneyArs(unitPrice)}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Stock ficha: {maxStock}
              {mozo.pathLabel ? (
                <span className="mt-0.5 block truncate text-[10px] text-zinc-600">
                  {mozo.pathLabel}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={ticketQty <= 0}
                aria-label="Quitar uno del ticket"
                onClick={onDec}
                className={minusBtnClass}
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-zinc-100">
                {ticketQty}
              </span>
              <button
                type="button"
                disabled={addBlocked}
                aria-label="Sumar uno al ticket"
                onClick={onInc}
                className={plusBtnClass}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function StockProductGrid({
  products,
  pathSegmentsForProduct,
  ticketQty,
  onAdjust,
}: {
  products: ProductRow[]
  pathSegmentsForProduct: (_p: ProductRow) => [string, string, string | null]
  ticketQty: (productId: string) => number
  onAdjust: (product: ProductRow, pathSegments: [string, string, string | null], delta: number) => void
}) {
  return (
    <ul className="grid list-none gap-4 sm:grid-cols-2">
      {products.map((p) => {
        const segs = pathSegmentsForProduct(p)
        return (
          <li key={p.id} className="list-none">
            <StockProductLine
              product={p}
              pathSegments={segs}
              ticketQty={ticketQty(p.id)}
              onInc={() => onAdjust(p, segs, 1)}
              onDec={() => onAdjust(p, segs, -1)}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function StockMozo({
  categories,
  collapseTick = 0,
  expandTick = 0,
  bulkLockRef,
  onUserOpenedPanel,
}: {
  categories: CategoryRow[]
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
  const treeRootRef = useRef<HTMLDivElement>(null)

  const sortedCatalog = useMemo(() => sortCatalogLikeStore(categories), [categories])
  const visibleTree = useMemo(() => filterStockTree(sortedCatalog, q), [sortedCatalog, q])
  const productCount = useMemo(() => countProductsInTree(visibleTree), [visibleTree])
  const totalInCatalog = useMemo(() => countProductsInTree(sortedCatalog), [sortedCatalog])

  const ticketQty = useCallback(
    (productId: string) => basket[productId]?.qty ?? 0,
    [basket],
  )

  const adjustTicket = useCallback(
    (product: ProductRow, pathSegments: [string, string, string | null], delta: number) => {
      const mozo = toMozoProduct(product, pathSegments)
      if (delta === 0) return
      setBasket((prev) => {
        const cur = prev[mozo.id]
        const currentQty = cur?.qty ?? 0
        const next = currentQty + delta
        if (next <= 0) {
          const { [mozo.id]: _, ...rest } = prev
          return rest
        }
        if (next > mozo.stock_quantity) return prev
        return { ...prev, [mozo.id]: { product: mozo, qty: next } }
      })
    },
    [],
  )

  useEffect(() => {
    if (collapseTick === 0) return
    catalogRef.current?.removeAttribute('open')
    ticketRef.current?.removeAttribute('open')
    treeRootRef.current?.querySelectorAll('details[data-stock-branch]').forEach((el) => {
      el.removeAttribute('open')
    })
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    if (catalogRef.current) catalogRef.current.open = true
    if (ticketRef.current) ticketRef.current.open = true
    treeRootRef.current?.querySelectorAll('details[data-stock-branch]').forEach((el) => {
      ;(el as HTMLDetailsElement).open = true
    })
  }, [expandTick])

  function panelToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!onUserOpenedPanel || !bulkLockRef) return
    if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedPanel()
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

  const countLabel =
    q.trim().length > 0 ? `${productCount} / ${totalInCatalog}` : String(productCount)

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-lg font-semibold text-amber-100">Venta en persona</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Misma selección que la tienda (+/−); lo que sumás va al ticket actual (venta en persona).
      </p>

      <details
        ref={catalogRef}
        open
        onToggle={panelToggle}
        className="group mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/30 open:shadow-sm"
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/80">
          <span>
            Catálogo <span className="text-zinc-500">({countLabel})</span>
          </span>
          {chevron()}
        </summary>
        <div className="space-y-3 p-3">
          <div>
            <label htmlFor="stock-mozo-product-search" className="sr-only">
              Buscar producto
            </label>
            <input
              id="stock-mozo-product-search"
              name="stock_mozo_product_search"
              type="text"
              autoComplete="off"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Buscar por nombre o rubro…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div
            ref={treeRootRef}
            className="max-h-[min(70vh,28rem)] overflow-y-auto rounded border border-zinc-800 bg-zinc-950/40 p-2"
          >
            {visibleTree.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-zinc-500">
                {sortedCatalog.length === 0
                  ? 'No hay categorías cargadas en el catálogo.'
                  : 'Ningún producto coincide con la búsqueda.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visibleTree.map((cat) => {
                  const catProductCount = cat.subcategories.reduce(
                    (n, s) => n + countProductsInSub(s),
                    0,
                  )
                  return (
                    <details key={cat.id} data-stock-branch className={frameCategory}>
                      <summary className={summaryCategory}>
                        <span className="min-w-0 text-left">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/90">
                            Categoría
                          </span>
                          <span className="mt-0.5 block truncate text-base font-semibold text-rose-50">
                            {upperCategoryLabel(cat.name)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {catProductCount > 0 ? (
                            <span
                              className={storeAccordionCountCategory}
                              title={`${catProductCount} producto${catProductCount === 1 ? '' : 's'}`}
                            >
                              {catProductCount}
                            </span>
                          ) : null}
                          {chevron()}
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-rose-900/20 bg-zinc-950/30 px-2 py-3">
                        {cat.subcategories.map((sub) => {
                          const nSub = countProductsInSub(sub)
                          return (
                            <details key={sub.id} data-stock-branch className={frameSub}>
                              <summary className={summarySub}>
                                <span className="min-w-0 text-left">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Subcategoría
                                  </span>
                                  <span className="mt-0.5 block truncate text-sm font-medium text-zinc-100">
                                    {upperCategoryLabel(sub.name)}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  {nSub > 0 ? (
                                    <span
                                      className={storeAccordionCountSub}
                                      title={`${nSub} producto${nSub === 1 ? '' : 's'}`}
                                    >
                                      {nSub}
                                    </span>
                                  ) : null}
                                  {chevron()}
                                </span>
                              </summary>
                              <div className="space-y-4 border-t border-zinc-800/50 bg-zinc-950/40 px-2 py-3 sm:px-3">
                                {sub.products.length > 0 ? (
                                  <StockProductGrid
                                    products={sub.products}
                                    pathSegmentsForProduct={() => [cat.name, sub.name, null]}
                                    ticketQty={ticketQty}
                                    onAdjust={adjustTicket}
                                  />
                                ) : null}
                                {(sub.subsubcategorias ?? []).length > 0 ? (
                                  <div
                                    className={
                                      sub.products.length > 0
                                        ? 'space-y-3 border-t border-zinc-800/50 pt-3'
                                        : 'space-y-3'
                                    }
                                  >
                                    {(sub.subsubcategorias ?? []).map((ss) => {
                                      const nSs = ss.products.length
                                      return (
                                        <details
                                          key={ss.id}
                                          data-stock-branch
                                          className={frameSubsub}
                                        >
                                          <summary className={summarySubsub}>
                                            <span className="min-w-0 text-left">
                                              <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-400/85">
                                                Sub-sub
                                              </span>
                                              <span className="mt-0.5 block truncate text-xs font-medium text-rose-100">
                                                {upperCategoryLabel(ss.name)}
                                              </span>
                                            </span>
                                            <span className="flex shrink-0 items-center gap-1.5">
                                              {nSs > 0 ? (
                                                <span
                                                  className={storeAccordionCountSubsub}
                                                  title={`${nSs} producto${nSs === 1 ? '' : 's'}`}
                                                >
                                                  {nSs}
                                                </span>
                                              ) : null}
                                              {chevron()}
                                            </span>
                                          </summary>
                                          <div className="border-t border-rose-900/20 bg-zinc-950/25 px-1 py-3 sm:px-2">
                                            {ss.products.length > 0 ? (
                                              <StockProductGrid
                                                products={ss.products}
                                                pathSegmentsForProduct={() => [
                                                  cat.name,
                                                  sub.name,
                                                  ss.name,
                                                ]}
                                                ticketQty={ticketQty}
                                                onAdjust={adjustTicket}
                                              />
                                            ) : null}
                                          </div>
                                        </details>
                                      )
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    </details>
                  )
                })}
              </div>
            )}
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
                    id={`stock-mozo-line-qty-${l.product.id}`}
                    name={`stock_mozo_line_qty_${l.product.id}`}
                    type="number"
                    min={1}
                    max={l.product.stock_quantity}
                    autoComplete="off"
                    aria-label={`Cantidad de ${l.product.name}`}
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
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Al confirmar, el servidor descuenta el stock de cada producto en la base de datos.
          </p>
        </div>
      </details>
    </section>
  )
}
