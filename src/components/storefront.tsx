'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useCart } from '@/context/cart-context'
import { StoreSessionLogoutButton } from '@/components/store-session-logout-button'
import { StoreCartDrawer } from '@/components/store-cart-drawer'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { ProductImageLightbox, type ProductLightboxPayload } from '@/components/product-image-lightbox'
import { collectProductImagePaths } from '@/lib/product-images'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import { headerNavPillRose } from '@/lib/store-header-nav'
import type { CategoryRow, ProductRow, ProductVariantRow, SubcategoryRow, SubsubcategoriaRow } from '@/types/catalog'

function sortByOrder<T extends { sort_order: number }>(arr: T[] | null | undefined) {
  return [...(arr ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

type CategoryView = Omit<CategoryRow, 'subcategories'> & {
  subcategories: SubcategoryRow[]
}

/** Referencia estable para `p.variants ?? []` y no disparar efectos en cada render. */
const EMPTY_PRODUCT_VARIANTS: ProductVariantRow[] = []

function isStoreVariantListed(v: Pick<ProductVariantRow, 'active'>) {
  return v.active ?? true
}

/** Talle por defecto: preferir con stock; si no hay, primer talle activo (se puede pedir igual). */
function pickDefaultStoreVariantId(variants: ProductVariantRow[]) {
  const listed = variants.filter((v) => isStoreVariantListed(v))
  if (listed.length === 0) return null
  const withStock = listed.find((v) => v.stock_quantity >= 1)
  return (withStock ?? listed[0])!.id
}

function storeVariantDataKey(variants: ProductVariantRow[] | null | undefined) {
  const vs = variants ?? EMPTY_PRODUCT_VARIANTS
  return vs
    .map((v) => `${v.id}:${v.stock_quantity}:${isStoreVariantListed(v) ? '1' : '0'}`)
    .sort()
    .join('|')
}

const collapseAllBtnClass =
  'shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-rose-600/50 hover:bg-zinc-700 hover:text-rose-100'

/** Acordeón tienda: misma lógica de borde/anillo que el catálogo admin (rosa al abrir). */
const storeCatalogFrameCategoryClass =
  'group scroll-mt-24 overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-900/40 shadow-md shadow-black/25 ring-1 ring-zinc-800/35 transition-[border-color,box-shadow,ring-width,ring-color] duration-200 open:border-rose-400/70 open:bg-zinc-900/50 open:shadow-md open:shadow-rose-950/15 open:ring-2 open:ring-rose-400/25'

const storeCatalogFrameSubClass =
  'group overflow-hidden rounded-xl border-2 border-zinc-800/80 bg-zinc-950/20 shadow-md shadow-black/25 ring-1 ring-zinc-800/30 transition-[border-color,box-shadow,ring-width,ring-color] duration-200 open:border-rose-400/70 open:bg-zinc-900/45 open:shadow-md open:ring-2 open:ring-rose-400/25'

const storeCatalogFrameSubsubClass =
  'group overflow-hidden rounded-lg border-2 border-zinc-800/70 bg-zinc-950/10 shadow-sm ring-1 ring-zinc-800/30 transition-[border-color,box-shadow,ring-width,ring-color] duration-200 open:border-rose-400/70 open:bg-rose-950/15 open:shadow-sm open:ring-2 open:ring-rose-400/25 sm:ml-1'

const storeCatalogSummaryCategoryClass =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-3 border-b-2 border-rose-900/35 transition hover:border-rose-600/45 group-open:border-rose-400/60'

const storeCatalogSummarySubClass =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-3 border-b-2 border-zinc-700/45 transition hover:border-zinc-500/55 group-open:border-rose-400/60'

const storeCatalogSummarySubsubClass =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b-2 border-rose-900/35 transition hover:border-rose-800/50 group-open:border-rose-400/60'

/** Contador de productos activos a la derecha (misma idea en categoría, subcategoría y sub-sub). */
const storeAccordionCountBadgeBase =
  'inline-flex min-h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none'
const storeAccordionCountCategory = `${storeAccordionCountBadgeBase} border-rose-800/55 bg-rose-950/70 text-rose-50 shadow-sm shadow-black/20`
const storeAccordionCountSub = `${storeAccordionCountBadgeBase} border-zinc-500/75 bg-zinc-950/85 text-zinc-100 shadow-sm shadow-black/15`
const storeAccordionCountSubsub = `${storeAccordionCountBadgeBase} border-rose-800/55 bg-black/35 text-rose-50 shadow-sm shadow-rose-950/20`

function useDetailsBulkRefs(collapseTick: number, expandTick: number) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (collapseTick === 0) return
    ref.current?.removeAttribute('open')
  }, [collapseTick])
  useEffect(() => {
    if (expandTick === 0) return
    if (ref.current) ref.current.open = true
  }, [expandTick])
  return ref
}

export function Storefront({
  categories,
  isAdminSession = false,
}: {
  categories: CategoryRow[]
  isAdminSession?: boolean
}) {
  const { lines, removeLine, setQty } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [collapseTick, setCollapseTick] = useState(0)
  const [expandTick, setExpandTick] = useState(0)
  const [showExpandAll, setShowExpandAll] = useState(false)
  const bulkLockRef = useRef(false)

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

  const handleDetailsToggle = () => {
    if (bulkLockRef.current) return
    setShowExpandAll(false)
  }

  const sortedCategories = useMemo((): CategoryView[] => {
    return sortByOrder(categories).map((c) => ({
      ...c,
      subcategories: sortByOrder(c.subcategories).map((s) => ({
        ...s,
        products: sortByOrder(s.products?.filter((p) => p.active)),
        subsubcategorias: sortByOrder(s.subsubcategorias).map((ss) => ({
          ...ss,
          products: sortByOrder(ss.products?.filter((p) => p.active)),
        })),
      })),
    }))
  }, [categories])

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-zinc-950 to-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-rose-900/40 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-rose-100">
              Lumina Mendoza
            </h1>
            <p className="text-xs text-rose-300/80">Catálogo y pedidos por WhatsApp</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2.5">
            {isAdminSession ? (
              <>
                <Link prefetch={false} href="/admin/catalog" className={headerNavPillRose}>
                  Catálogo
                </Link>
                <Link prefetch={false} href="/admin/stock" className={headerNavPillRose}>
                  Stock
                </Link>
                <Link prefetch={false} href="/admin/pedidos" className={headerNavPillRose}>
                  Pedidos
                </Link>
                <Link prefetch={false} href="/admin/equipo" className={headerNavPillRose}>
                  Equipo
                </Link>
                <StoreSessionLogoutButton />
              </>
            ) : (
              <Link
                href="/admin/login"
                className="rounded-lg border border-zinc-600 bg-zinc-900/40 px-3 py-2.5 text-sm font-medium text-zinc-300 shadow-sm shadow-black/10 hover:bg-zinc-800"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-900/40 hover:bg-rose-500"
            >
              Carrito
              {lines.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-rose-700">
                  {lines.reduce((n, l) => n + l.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {sortedCategories.length === 0 ? (
          <p className="text-center text-zinc-400">
            Pronto vas a ver el catálogo aquí. Configurá Supabase y cargá productos
            desde el panel admin.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
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
            <div className="space-y-10">
              {sortedCategories.map((cat) => (
                <CategoryStoreDetails
                  key={cat.id}
                  cat={cat}
                  collapseTick={collapseTick}
                  expandTick={expandTick}
                  bulkLockRef={bulkLockRef}
                  onUserOpenedDetail={handleDetailsToggle}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <StoreCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}

function countActiveProductsInSub(node: SubcategoryRow): number {
  const direct = node.products?.length ?? 0
  const inSs =
    node.subsubcategorias?.reduce((n, ss) => n + (ss.products?.length ?? 0), 0) ?? 0
  return direct + inSs
}

function AccordionChevron({ className }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180 ${className ?? ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
    </svg>
  )
}

function CategoryStoreDetails({
  cat,
  collapseTick,
  expandTick,
  bulkLockRef,
  onUserOpenedDetail,
}: {
  cat: CategoryView
  collapseTick: number
  expandTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserOpenedDetail: () => void
}) {
  const catRef = useDetailsBulkRefs(collapseTick, expandTick)
  const subs = cat.subcategories ?? []
  const catProductCount = subs.reduce((n, s) => n + countActiveProductsInSub(s), 0)
  return (
    <details
      ref={catRef}
      id={`cat-${cat.id}`}
      onToggle={(e) => {
        if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedDetail()
      }}
      className={storeCatalogFrameCategoryClass}
    >
      <summary
        className={`${storeCatalogSummaryCategoryClass} rounded-t-xl bg-gradient-to-r from-rose-950/50 to-zinc-900/40 px-4 py-3.5 hover:from-rose-900/55 hover:to-zinc-800/50 active:scale-[0.998]`}
      >
        <span className="min-w-0 text-left">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">
            Categoría
          </span>
          <span className="mt-0.5 block truncate text-lg font-semibold tracking-wide text-rose-50">
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
          <AccordionChevron className="text-rose-300/80" />
        </span>
      </summary>
      <div className="border-t border-rose-900/20 bg-zinc-950/40 px-3 py-4 sm:px-4">
        {subs.length > 0 ? (
          <div className="space-y-4">
            {subs.map((sub) => (
              <SubcategoryStoreSection
                key={sub.id}
                node={sub}
                storeCategoryMeta={{
                  id: cat.id,
                  name: cat.name,
                  sortOrder: cat.sort_order,
                }}
                collapseTick={collapseTick}
                expandTick={expandTick}
                bulkLockRef={bulkLockRef}
                onUserOpenedDetail={onUserOpenedDetail}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function SubcategoryStoreSection({
  node,
  storeCategoryMeta,
  collapseTick,
  expandTick,
  bulkLockRef,
  onUserOpenedDetail,
}: {
  node: SubcategoryRow
  storeCategoryMeta: { id: string; name: string; sortOrder: number }
  collapseTick: number
  expandTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserOpenedDetail: () => void
}) {
  const subRef = useDetailsBulkRefs(collapseTick, expandTick)
  const [productGridEpoch, setProductGridEpoch] = useState(0)
  const subs = node.subsubcategorias ?? []
  const direct = node.products ?? []
  const hasSubs = subs.length > 0
  const hasDirect = direct.length > 0
  const nProducts = countActiveProductsInSub(node)

  return (
    <details
      ref={subRef}
      onToggle={(e) => {
        if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedDetail()
        if (e.currentTarget.open) setProductGridEpoch((n) => n + 1)
      }}
      className={storeCatalogFrameSubClass}
    >
      <summary
        className={`${storeCatalogSummarySubClass} rounded-t-lg bg-gradient-to-r from-zinc-800/70 to-zinc-900/50 px-3 py-3 hover:from-zinc-700/80 hover:to-zinc-800/60 active:scale-[0.998] sm:px-4`}
      >
        <span className="min-w-0 text-left">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Subcategoría
          </span>
          <span className="mt-0.5 block truncate text-base font-medium tracking-wide text-zinc-100">
            {upperCategoryLabel(node.name)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {nProducts > 0 ? (
            <span
              className={storeAccordionCountSub}
              title={`${nProducts} producto${nProducts === 1 ? '' : 's'}`}
            >
              {nProducts}
            </span>
          ) : null}
          <AccordionChevron className="text-zinc-400" />
        </span>
      </summary>
      <div className="space-y-4 border-t border-zinc-800/50 bg-zinc-950/30 px-3 py-4 sm:px-4">
        {hasDirect ? (
          <ProductStoreGrid
            key={`${expandTick}-${productGridEpoch}`}
            products={direct}
            storeCategoryMeta={storeCategoryMeta}
          />
        ) : null}

        {hasSubs ? (
          <div className={hasDirect ? 'space-y-3 border-t border-zinc-800/50 pt-4' : 'space-y-3'}>
            {subs.map((ss) => (
              <SubsubStoreSection
                key={ss.id}
                node={ss}
                storeCategoryMeta={storeCategoryMeta}
                collapseTick={collapseTick}
                expandTick={expandTick}
                bulkLockRef={bulkLockRef}
                onUserOpenedDetail={onUserOpenedDetail}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function SubsubStoreSection({
  node,
  storeCategoryMeta,
  collapseTick,
  expandTick,
  bulkLockRef,
  onUserOpenedDetail,
}: {
  node: SubsubcategoriaRow
  storeCategoryMeta: { id: string; name: string; sortOrder: number }
  collapseTick: number
  expandTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserOpenedDetail: () => void
}) {
  const ssRef = useDetailsBulkRefs(collapseTick, expandTick)
  const [productGridEpoch, setProductGridEpoch] = useState(0)
  const list = node.products ?? []
  const n = list.length
  return (
    <details
      ref={ssRef}
      onToggle={(e) => {
        if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedDetail()
        if (e.currentTarget.open) setProductGridEpoch((k) => k + 1)
      }}
      className={storeCatalogFrameSubsubClass}
    >
      <summary
        className={`${storeCatalogSummarySubsubClass} rounded-t-lg bg-rose-950/35 px-3 py-2.5 hover:bg-rose-900/45 active:scale-[0.998] sm:px-3.5`}
      >
        <span className="min-w-0 text-left">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">
            Sub-sub
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium tracking-wide text-rose-100">
            {upperCategoryLabel(node.name)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {n > 0 ? (
            <span
              className={storeAccordionCountSubsub}
              title={`${n} producto${n === 1 ? '' : 's'}`}
            >
              {n}
            </span>
          ) : null}
          <AccordionChevron className="h-4 w-4 text-rose-400/90" />
        </span>
      </summary>
      <div className="border-t border-rose-900/25 bg-zinc-950/20 px-2 py-3 sm:px-3">
        {list.length > 0 ? (
          <ProductStoreGrid
            key={`${expandTick}-${productGridEpoch}`}
            products={list}
            storeCategoryMeta={storeCategoryMeta}
          />
        ) : null}
      </div>
    </details>
  )
}

function StoreProductLine({
  p,
  storeCategoryMeta,
  onOpenPhotos,
}: {
  p: ProductRow
  storeCategoryMeta: { id: string; name: string; sortOrder: number }
  onOpenPhotos: () => void
}) {
  const { lines, addLine, setQty } = useCart()
  const variants = useMemo(() => p.variants ?? EMPTY_PRODUCT_VARIANTS, [p.variants])
  const hasVariants = variants.length > 0

  const defaultVariantId = useMemo(
    () => (hasVariants ? pickDefaultStoreVariantId(variants) : null),
    [hasVariants, variants],
  )

  const [variantId, setVariantId] = useState<string | null>(() =>
    pickDefaultStoreVariantId(p.variants ?? EMPTY_PRODUCT_VARIANTS),
  )

  useEffect(() => {
    if (!hasVariants) return
    const stillOk =
      variantId != null && variants.some((v) => v.id === variantId && isStoreVariantListed(v))
    if (!stillOk && defaultVariantId != null) setVariantId(defaultVariantId)
  }, [hasVariants, variants, variantId, defaultVariantId])

  const selected = variantId ? (variants.find((v) => v.id === variantId) ?? null) : null
  const displayStock = hasVariants ? (selected ? selected.stock_quantity : 0) : p.stock_quantity
  const cartVid = hasVariants ? variantId : null
  const qty =
    lines.find((l) => l.productId === p.id && (l.variantId ?? null) === (cartVid ?? null))?.quantity ?? 0
  const noActiveVariants = hasVariants && !variants.some((v) => isStoreVariantListed(v))
  const addBlocked = noActiveVariants
  const unitPrice = Number(p.price)
  const paths = collectProductImagePaths(p)
  const thumbUrl = paths[0] ? getPublicUrlFromPath(paths[0]) : null

  const displayName =
    hasVariants && selected ? `${p.name} — talle ${selected.size_label}` : p.name

  return (
    <article className="overflow-visible rounded-lg border border-red-500/45 bg-zinc-950/25 p-2 shadow-md ring-1 ring-red-500/25 sm:p-3">
      <div className="min-w-0 rounded-lg border border-zinc-800/60 bg-zinc-900/45 p-3">
        <h3 className="mb-2 text-sm font-medium leading-snug text-zinc-100">{p.name}</h3>
        <div className="flex gap-3">
          {paths.length > 0 ? (
            <button
              type="button"
              onClick={onOpenPhotos}
              className="group/img relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800 text-left ring-zinc-600 transition hover:ring-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label={`Ver fotos de ${p.name}`}
            >
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt=""
                  className="h-full w-full object-cover transition duration-200 group-hover/img:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">foto</div>
              )}
              {paths.length > 1 ? (
                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-zinc-200">
                  +{paths.length - 1}
                </span>
              ) : null}
            </button>
          ) : (
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800 text-[10px] text-zinc-600">
              sin foto
            </div>
          )}
          <div className="min-w-0 flex-1">
            {p.description ? (
              <p className="line-clamp-2 text-xs text-zinc-500">{p.description}</p>
            ) : null}
            <p className="mt-2 text-rose-300">{formatMoneyArs(unitPrice)}</p>
            {hasVariants ? (
              <div className="mt-2">
                <label
                  htmlFor={`store-product-variant-${p.id}`}
                  className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500"
                >
                  Talle
                </label>
                <select
                  id={`store-product-variant-${p.id}`}
                  name={`product_variant_${p.id}`}
                  autoComplete="off"
                  className="mt-1 w-full max-w-[12rem] rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                  value={variantId ?? ''}
                  disabled={noActiveVariants}
                  onChange={(e) => {
                    const next = e.target.value
                    setVariantId(next.length > 0 ? next : null)
                  }}
                >
                  {noActiveVariants ? <option value="">Sin talles disponibles</option> : null}
                  {variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={!isStoreVariantListed(v)}>
                      {v.size_label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {noActiveVariants ? (
              <p className="mt-1 text-xs text-zinc-500">No disponible por el momento</p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={qty <= 0}
                aria-label="Quitar uno del carrito"
                onClick={() => setQty(p.id, cartVid, qty - 1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-rose-700/50 bg-zinc-950/90 text-lg font-semibold leading-none text-rose-100 shadow-inner shadow-black/20 transition hover:border-rose-500/70 hover:bg-rose-950/50 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-zinc-100">
                {qty}
              </span>
              <button
                type="button"
                disabled={addBlocked}
                aria-label="Sumar uno al carrito"
                onClick={() => {
                  const firstPath = collectProductImagePaths(p)[0] ?? null
                  addLine({
                    productId: p.id,
                    variantId: cartVid,
                    variantLabel: selected?.size_label ?? null,
                    name: displayName,
                    unitPrice,
                    maxStock: displayStock,
                    imagePath: firstPath,
                    categoryId: storeCategoryMeta.id,
                    categoryName: storeCategoryMeta.name,
                    categorySortOrder: storeCategoryMeta.sortOrder,
                  })
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-rose-500/60 bg-gradient-to-b from-rose-600 to-rose-800 text-lg font-semibold leading-none text-white shadow-md shadow-rose-950/40 transition hover:from-rose-500 hover:to-rose-700 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
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

function ProductStoreGrid({
  products,
  storeCategoryMeta,
}: {
  products: ProductRow[]
  storeCategoryMeta: { id: string; name: string; sortOrder: number }
}) {
  const [lightbox, setLightbox] = useState<ProductLightboxPayload | null>(null)

  return (
    <>
      <ProductImageLightbox
        open={lightbox != null}
        payload={lightbox}
        onClose={() => setLightbox(null)}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => {
          const paths = collectProductImagePaths(p)
          const unitPrice = Number(p.price)
          const variantDataKey = storeVariantDataKey(p.variants)
          const openPreview = () => {
            if (paths.length === 0) return
            setLightbox({
              id: p.id,
              name: p.name,
              description: p.description,
              price: unitPrice,
              imagePaths: paths,
            })
          }
          return (
            <li key={p.id} className="list-none">
              <StoreProductLine
                key={`${p.id}:${variantDataKey}`}
                p={p}
                storeCategoryMeta={storeCategoryMeta}
                onOpenPhotos={openPreview}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}
