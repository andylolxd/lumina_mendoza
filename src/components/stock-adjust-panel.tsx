'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatCatalogPath } from '@/lib/catalog-tree'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { collectProductImagePaths } from '@/lib/product-images'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import {
  countProductsInSub,
  sortCatalogStockAdminView,
  type CategoryView,
} from '@/lib/stock-catalog-view'
import {
  storeCatalogFrameCategoryClass,
  storeCatalogFrameSubClass,
  storeCatalogFrameSubsubClass,
} from '@/lib/store-theme'
import type { CategoryRow, ProductRow, SubcategoryRow } from '@/types/catalog'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

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

const summaryCategory =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-emerald-900/30 bg-gradient-to-r from-emerald-950/35 to-zinc-900/40 px-3 py-2.5'
const summarySub =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-zinc-800/60 bg-zinc-900/50 px-3 py-2'
const summarySubsub =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b border-emerald-900/25 bg-emerald-950/20 px-2.5 py-2'

const minusBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-800/50 bg-zinc-950/90 text-lg font-semibold leading-none text-emerald-100 transition hover:border-emerald-500/60 active:scale-95 disabled:pointer-events-none disabled:opacity-35'
const plusBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-500/55 bg-gradient-to-b from-emerald-600 to-emerald-900 text-lg font-semibold leading-none text-white shadow-md transition hover:from-emerald-500 hover:to-emerald-800 active:scale-95 disabled:pointer-events-none disabled:opacity-35'

function StockAdjustCard({
  product,
  pathSegments,
  delta,
  onDelta,
}: {
  product: ProductRow
  pathSegments: [string, string, string | null]
  delta: number
  onDelta: (next: number) => void
}) {
  const paths = collectProductImagePaths(product)
  const thumbUrl = paths[0] ? getPublicUrlFromPath(paths[0]) : null
  const base = product.stock_quantity
  const preview = base + delta
  const pathLabel = formatCatalogPath(pathSegments) || '—'

  return (
    <article className="overflow-visible rounded-lg border border-emerald-800/40 bg-zinc-950/25 p-2 shadow-sm ring-1 ring-emerald-900/25 sm:p-3">
      <div className="min-w-0 rounded-lg border border-zinc-800/60 bg-zinc-900/45 p-3">
        <h3 className="mb-1 text-sm font-medium leading-snug text-zinc-100">{product.name}</h3>
        <p className="text-[10px] text-zinc-500">{pathLabel}</p>
        <p className="mt-1 text-xs text-zinc-400">{formatMoneyArs(Number(product.price))}</p>
        <div className="mt-2 flex gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] text-zinc-600">
                sin foto
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-300">
              Stock actual: <span className="font-semibold text-emerald-200">{base}</span>
            </p>
            <p className="text-xs text-zinc-400">
              Cambio pendiente:{' '}
              <span className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {delta >= 0 ? '+' : ''}
                {delta}
              </span>
            </p>
            <p className="text-xs font-medium text-zinc-100">
              Resultado:{' '}
              <span className={preview < 0 ? 'text-rose-400' : 'text-emerald-200'}>{preview}</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Restar uno del ajuste"
                disabled={delta <= -base}
                onClick={() => onDelta(delta - 1)}
                className={minusBtnClass}
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-zinc-100">
                {delta}
              </span>
              <button
                type="button"
                aria-label="Sumar uno al ajuste"
                onClick={() => onDelta(delta + 1)}
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

function StockAdjustGrid({
  products,
  pathSegmentsForProduct,
  deltas,
  setDeltaFor,
}: {
  products: ProductRow[]
  pathSegmentsForProduct: (_p: ProductRow) => [string, string, string | null]
  deltas: Record<string, number>
  setDeltaFor: (productId: string, next: number) => void
}) {
  return (
    <ul className="grid list-none gap-3 sm:grid-cols-2">
      {products.map((p) => {
        const segs = pathSegmentsForProduct(p)
        const d = deltas[p.id] ?? 0
        return (
          <li key={p.id} className="list-none">
            <StockAdjustCard
              product={p}
              pathSegments={segs}
              delta={d}
              onDelta={(next) => setDeltaFor(p.id, next)}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function StockAdjustPanel({
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
  const router = useRouter()
  const treeRootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDetailsElement>(null)
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const tree = useMemo(() => sortCatalogStockAdminView(categories), [categories])

  const pendingCount = useMemo(
    () => Object.values(deltas).filter((d) => d !== 0).length,
    [deltas],
  )

  const setDeltaFor = useCallback((productId: string, next: number) => {
    setDeltas((prev) => {
      const p = findProduct(tree, productId)
      if (!p) return prev
      const clamped = Math.max(-p.stock_quantity, next)
      if (clamped === 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: clamped }
    })
  }, [tree])

  useEffect(() => {
    if (collapseTick === 0) return
    panelRef.current?.removeAttribute('open')
    treeRootRef.current?.querySelectorAll('details[data-stock-branch]').forEach((el) => {
      el.removeAttribute('open')
    })
  }, [collapseTick])

  useEffect(() => {
    if (expandTick === 0) return
    if (panelRef.current) panelRef.current.open = true
    treeRootRef.current?.querySelectorAll('details[data-stock-branch]').forEach((el) => {
      ;(el as HTMLDetailsElement).open = true
    })
  }, [expandTick])

  function panelToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!onUserOpenedPanel || !bulkLockRef) return
    if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedPanel()
  }

  async function applySave() {
    const lines = Object.entries(deltas)
      .filter(([, d]) => d !== 0)
      .map(([product_id, delta]) => ({ product_id, delta }))
    if (lines.length === 0) {
      setConfirmOpen(false)
      return
    }
    setBusy(true)
    setMsg('')
    const sb = createClient()
    const { error } = await sb.rpc('apply_stock_deltas', { deltas: lines })
    setBusy(false)
    setConfirmOpen(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setDeltas({})
    setMsg('Stock actualizado.')
    router.refresh()
  }

  return (
    <section className={`${storeCatalogFrameSubClass} p-4`}>
      <h2 className="text-lg font-semibold text-emerald-100">Ajuste de stock</h2>

      <details
        ref={panelRef}
        open
        onToggle={panelToggle}
        className={`group mt-3 ${storeCatalogFrameSubClass}`}
      >
        <summary className="catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg border-b border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900">
          <span>
            Inventario{' '}
            {pendingCount > 0 ? (
              <span className="text-emerald-400">({pendingCount} con cambios)</span>
            ) : null}
          </span>
          {chevron()}
        </summary>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5">
            <button
              type="button"
              disabled={pendingCount === 0 || busy}
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg border border-yellow-500 bg-[#FFE804] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#FFF44F] hover:border-yellow-400 active:brightness-95 disabled:opacity-40"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              disabled={pendingCount === 0 || busy}
              onClick={() => setDeltas({})}
              className="rounded-lg border border-zinc-500 bg-zinc-800 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 disabled:opacity-40"
            >
              Descartar
            </button>
          </div>
          {msg ? <p className="text-xs text-emerald-400">{msg}</p> : null}

          <div
            ref={treeRootRef}
            className="max-h-[min(70vh,28rem)] overflow-y-auto rounded border border-zinc-800 bg-zinc-950/40 p-2"
          >
            {tree.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No hay productos en el catálogo.</p>
            ) : (
              <div className="space-y-3">
                {tree.map((cat) => {
                  const catProductCount = cat.subcategories.reduce(
                    (n, s) => n + countProductsInSub(s),
                    0,
                  )
                  return (
                    <details key={cat.id} data-stock-branch className={storeCatalogFrameCategoryClass}>
                      <summary className={summaryCategory}>
                        <span className="min-w-0 text-left">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                            Categoría
                          </span>
                          <span className="mt-0.5 block truncate text-base font-semibold text-emerald-50">
                            {upperCategoryLabel(cat.name)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {catProductCount > 0 ? (
                            <span className={storeAccordionCountCategory} title={`${catProductCount} productos`}>
                              {catProductCount}
                            </span>
                          ) : null}
                          {chevron()}
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-emerald-900/20 bg-zinc-950/30 px-2 py-3">
                        {cat.subcategories.map((sub) => {
                          const nSub = countProductsInSub(sub)
                          return (
                            <details key={sub.id} data-stock-branch className={storeCatalogFrameSubClass}>
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
                                    <span className={storeAccordionCountSub} title={`${nSub} productos`}>
                                      {nSub}
                                    </span>
                                  ) : null}
                                  {chevron()}
                                </span>
                              </summary>
                              <div className="space-y-4 border-t border-zinc-800/50 bg-zinc-950/40 px-2 py-3">
                                {sub.products.length > 0 ? (
                                  <StockAdjustGrid
                                    products={sub.products}
                                    pathSegmentsForProduct={() => [cat.name, sub.name, null]}
                                    deltas={deltas}
                                    setDeltaFor={setDeltaFor}
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
                                        <details key={ss.id} data-stock-branch className={storeCatalogFrameSubsubClass}>
                                          <summary className={summarySubsub}>
                                            <span className="min-w-0 text-left">
                                              <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-400/85">
                                                Sub-sub
                                              </span>
                                              <span className="mt-0.5 block truncate text-xs font-medium text-emerald-100">
                                                {upperCategoryLabel(ss.name)}
                                              </span>
                                            </span>
                                            <span className="flex shrink-0 items-center gap-1.5">
                                              {nSs > 0 ? (
                                                <span
                                                  className={storeAccordionCountSubsub}
                                                  title={`${nSs} productos`}
                                                >
                                                  {nSs}
                                                </span>
                                              ) : null}
                                              {chevron()}
                                            </span>
                                          </summary>
                                          <div className="border-t border-emerald-900/20 bg-zinc-950/25 px-1 py-2">
                                            <StockAdjustGrid
                                              products={ss.products}
                                              pathSegmentsForProduct={() => [
                                                cat.name,
                                                sub.name,
                                                ss.name,
                                              ]}
                                              deltas={deltas}
                                              setDeltaFor={setDeltaFor}
                                            />
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

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-save-confirm-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900 p-5 shadow-xl">
            <h3 id="stock-save-confirm-title" className="text-lg font-semibold text-emerald-100">
              ¿Confirmar cambios de stock?
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Se aplicarán <strong className="text-zinc-200">{pendingCount}</strong> productos con
              movimiento distinto de cero. Esta acción actualiza el inventario en la base de datos.
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-300">
              {Object.entries(deltas)
                .filter(([, d]) => d !== 0)
                .map(([id, d]) => {
                  const p = findProduct(tree, id)
                  return (
                    <li key={id}>
                      {p?.name ?? id}: {d > 0 ? '+' : ''}
                      {d}
                    </li>
                  )
                })}
            </ul>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-yellow-500 bg-[#FFE804] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#FFF44F] hover:border-yellow-400 active:brightness-95 disabled:opacity-50"
                onClick={() => void applySave()}
              >
                {busy ? 'Guardando…' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function findProduct(cats: CategoryView[], id: string): ProductRow | undefined {
  for (const c of cats) {
    for (const s of c.subcategories) {
      for (const p of s.products) {
        if (p.id === id) return p
      }
      for (const ss of s.subsubcategorias ?? []) {
        for (const p of ss.products) {
          if (p.id === id) return p
        }
      }
    }
  }
  return undefined
}
