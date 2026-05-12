'use client'

import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useCart } from '@/context/cart-context'
import { StoreSessionLogoutButton } from '@/components/store-session-logout-button'
import { StoreCartDrawer } from '@/components/store-cart-drawer'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { ProductImageLightbox, type ProductLightboxPayload } from '@/components/product-image-lightbox'
import { collectProductImagePaths } from '@/lib/product-images'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import { headerNavPillMuted, headerNavPillRose } from '@/lib/store-header-nav'
import type { CategoryRow, ProductRow, ProductVariantRow, SubcategoryRow, SubsubcategoriaRow } from '@/types/catalog'

const storeTitleFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
})

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

const STORE_INFINITE_BG_SRC = '/images/store-infinite-bg.png'
const STORE_HEADER_BG_SRC = '/images/store-header-bg.png'

/** Acordeón tienda — categoría: marco siempre con el mismo borde/anillo que al expandir. */
const storeCatalogFrameCategoryClass =
  'group scroll-mt-24 overflow-hidden rounded-3xl border-2 border-rose-400/70 bg-zinc-900/45 shadow-md shadow-black/35 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200'

const storeCatalogFrameSubClass =
  'group overflow-hidden rounded-xl border-2 border-rose-400/70 bg-zinc-900/45 shadow-md shadow-black/25 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200'

const storeCatalogFrameSubsubClass =
  'group overflow-hidden rounded-lg border-2 border-rose-400/70 bg-rose-950/15 shadow-sm shadow-black/25 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200 sm:ml-1'

/** Summary categoría: hero visual (lógica `<details>` intacta). Subcategorías siguen usando sus clases propias. */
const storeCatalogSummaryCategoryClass =
  'catalog-accordion-summary relative flex min-h-[140px] w-full cursor-pointer list-none items-center justify-between gap-3 overflow-hidden rounded-t-3xl border-0 transition-[filter] duration-200 hover:brightness-[1.03] active:brightness-[0.98] group-open:rounded-b-none sm:min-h-[160px]'

const storeCatalogSummarySubClass =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-3 border-b-2 border-rose-400/60 transition hover:border-rose-300/70'

const storeCatalogSummarySubsubClass =
  'catalog-accordion-summary flex cursor-pointer list-none items-center justify-between gap-2 border-b-2 border-rose-400/60 transition hover:border-rose-300/70'

/** Contador de productos activos a la derecha (misma idea en categoría, subcategoría y sub-sub). */
const storeAccordionCountBadgeBase =
  'inline-flex min-h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none'
const storeAccordionCountCategory = `${storeAccordionCountBadgeBase} border border-white/40 bg-zinc-200/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.22)] backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]`
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

/** Diamante lineal junto al título (tono oro rosa, alineado con las tarjetas de categoría). */
function StoreHeaderDiamond({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 text-[#e8b4a0] ${className ?? ''}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M10 3.2L16.2 9.9 10 16.7 3.8 9.9 10 3.2z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  )
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
    <div className="min-h-screen text-zinc-100">
      <header className="sticky top-0 z-40 overflow-hidden border-b border-zinc-800/50">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-left-top bg-no-repeat"
          style={{ backgroundImage: `url(${STORE_HEADER_BG_SRC})` }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <div className={`flex flex-wrap items-baseline gap-x-2 ${storeTitleFont.className}`}>
              <h1 className="m-0 bg-[linear-gradient(118deg,#fff5f0_0%,#f0d4cc_22%,#d4a088_52%,#c08081_78%,#a86f6f_100%)] bg-clip-text text-[1.35rem] font-semibold leading-tight tracking-[0.03em] text-transparent sm:text-[1.65rem]">
                Lumina Mendoza
              </h1>
              <StoreHeaderDiamond className="relative top-px h-[0.95rem] w-[0.95rem] sm:h-[1.05rem] sm:w-[1.05rem]" />
            </div>
            <p className="mt-1 font-sans text-[0.6875rem] font-medium leading-snug tracking-wide text-amber-200/88 sm:text-[0.8125rem]">
              Catálogo y pedidos por WhatsApp
            </p>
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
              <Link href="/admin/login" className={`${headerNavPillMuted} px-4`}>
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={`relative ${headerNavPillRose}`}
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

      <div className="relative w-full">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${STORE_INFINITE_BG_SRC})`,
            backgroundRepeat: 'repeat',
            backgroundPosition: 'center top',
            backgroundSize: 'min(320px, 38vw) auto',
            imageRendering: 'pixelated',
          }}
          aria-hidden
        />
        <main className="relative z-10 mx-auto max-w-5xl px-4 pb-8 pt-3 sm:pt-4">
          <div className="space-y-10">
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
                <div className="space-y-5 sm:space-y-6">
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
          </div>
        </main>
      </div>

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

/** Primera foto de catálogo en la categoría (orden de subcategorías y productos); solo UI. */
function pickCategoryHeroImagePath(cat: CategoryView): string | null {
  for (const sub of cat.subcategories ?? []) {
    for (const p of sub.products ?? []) {
      const paths = collectProductImagePaths(p)
      if (paths[0]) return paths[0]
    }
    for (const ss of sub.subsubcategorias ?? []) {
      for (const p of ss.products ?? []) {
        const paths = collectProductImagePaths(p)
        if (paths[0]) return paths[0]
      }
    }
  }
  return null
}

function normalizeCategoryNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Banners en `public/images/` (copiados desde Desktop/categorias).
 * Varias claves por si en Supabase el nombre está en singular/plural.
 */
const CATEGORY_HERO_PUBLIC_BY_NAME: Record<string, string> = {
  arito: '/images/category-hero-arito.png',
  aritos: '/images/category-hero-arito.png',
  anillo: '/images/category-hero-anillo.png',
  anillos: '/images/category-hero-anillo.png',
  cadena: '/images/category-hero-cadena.png',
  cadenas: '/images/category-hero-cadena.png',
  dijes: '/images/category-hero-dijes.png',
  pulsera: '/images/category-hero-pulseras.png',
  pulseras: '/images/category-hero-pulseras.png',
  tobillera: '/images/category-hero-tobilleras.png',
  tobilleras: '/images/category-hero-tobilleras.png',
}

function pickCategoryHeroPublicUrl(cat: CategoryView): string | null {
  const key = normalizeCategoryNameKey(cat.name)
  return CATEGORY_HERO_PUBLIC_BY_NAME[key] ?? null
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
  const heroPublicUrl = pickCategoryHeroPublicUrl(cat)
  const heroStoragePath = heroPublicUrl ? null : pickCategoryHeroImagePath(cat)
  const heroUrl =
    heroPublicUrl ?? (heroStoragePath ? getPublicUrlFromPath(heroStoragePath) : null)

  return (
    <details
      ref={catRef}
      id={`cat-${cat.id}`}
      onToggle={(e) => {
        if (e.currentTarget.open && !bulkLockRef.current) onUserOpenedDetail()
      }}
      className={storeCatalogFrameCategoryClass}
    >
      <summary className={storeCatalogSummaryCategoryClass}>
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover brightness-[1.07] contrast-[1.02]"
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-950/95 via-zinc-950 to-zinc-950"
            aria-hidden
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/78 via-zinc-950/38 to-transparent sm:via-zinc-950/28"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-zinc-950/25"
          aria-hidden
        />
        <span className="relative z-20 min-w-0 flex-1 px-4 py-4 text-left sm:px-5 sm:py-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">
            Categoría
          </span>
          <span className="mt-1 block truncate text-xl font-bold uppercase tracking-[0.08em] text-zinc-50 drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)] sm:text-2xl">
            {upperCategoryLabel(cat.name)}
          </span>
        </span>
        <span className="relative z-20 flex shrink-0 items-center gap-2.5 pr-4 sm:pr-5">
          {catProductCount > 0 ? (
            <span
              className={storeAccordionCountCategory}
              title={`${catProductCount} producto${catProductCount === 1 ? '' : 's'}`}
            >
              {catProductCount}
            </span>
          ) : null}
          <AccordionChevron className="h-5 w-5 shrink-0 text-amber-100/90 drop-shadow-md sm:h-6 sm:w-6" />
        </span>
      </summary>
      <div className="border-t border-amber-900/25 bg-zinc-950/50 px-3 py-4 sm:px-4">
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
