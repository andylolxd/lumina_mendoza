'use client'

import { createClient } from '@/lib/supabase/browser'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { normalizeGallery } from '@/lib/product-images'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import {
  storeCatalogFrameCategoryClass,
  storeCatalogFrameSubClass,
  storeCatalogFrameSubsubClass,
} from '@/lib/store-theme'
import type {
  CategoryRow,
  ProductRow,
  ProductVariantRow,
  SubcategoryRow,
  SubsubcategoriaRow,
} from '@/types/catalog'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'

function sortOrder<T extends { sort_order: number }>(arr: T[] | null | undefined) {
  return [...(arr ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

type ProductPatch = Partial<{
  name: string
  price: number
  stock_quantity: number
  active: boolean
  description: string | null
  image_gallery: string[]
}>

type ProductVariantPatch = Partial<{
  size_label: string
  stock_quantity: number
  sort_order: number
  active: boolean
}>

type CatalogCommitOpts = { skipRefresh?: boolean; skipBusy?: boolean }
type AddProductOpts = { requireNumericSize?: boolean }
type ProductDraftFields = {
  name: string
  price: string
  stock: string
  size?: string
  description: string
}

type VariantCatalogActions = {
  addVariant: (
    productId: string,
    sizeLabel: string,
    stockQuantity: number,
    active: boolean,
    opts?: CatalogCommitOpts,
  ) => Promise<void>
  updateVariant: (variantId: string, patch: ProductVariantPatch, opts?: CatalogCommitOpts) => Promise<void>
  deleteVariant: (variantId: string, opts?: CatalogCommitOpts) => Promise<void>
}

function formatSupabaseError(err: { message?: string; code?: string; details?: string; hint?: string }) {
  const parts = [err.message, err.code ? `código: ${err.code}` : '', err.details, err.hint].filter(Boolean)
  return parts.join('\n')
}

function isRingCategoryName(name: string) {
  return upperCategoryLabel(name) === 'ANILLOS'
}

function sanitizeNumericSizeLabel(value: string) {
  return value.replace(/\D+/g, '')
}

const collapseAllBtnClass =
  'shrink-0 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50'

/** Mismo borde rojo que el botón «Eliminar» del catálogo; fondo gris oscuro. */
const catalogDeleteBtnClass =
  'rounded-lg border-2 border-red-500/60 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-red-200 shadow-sm transition hover:border-red-400 hover:bg-zinc-800 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.98]'

const catalogDeleteBtnClassCompact =
  'rounded-lg border-2 border-red-500/60 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-red-200 shadow-sm transition hover:border-red-400 hover:bg-zinc-800 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.98]'

/** Mismo borde que eliminar; fondo gris oscuro. */
const catalogSaveBtnClassCompact =
  'rounded-lg border-2 border-red-500/60 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-100 shadow-sm transition hover:border-red-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.98]'

function getCatalogProductSaveBtnClass(enabled: boolean) {
  return enabled
    ? 'rounded-lg border-2 border-amber-400 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-amber-100 shadow-sm transition hover:border-amber-300 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 active:scale-[0.98] disabled:opacity-50'
    : 'rounded-lg border-2 border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-500 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60'
}

/** Plegado de producto en catálogo: botón rectangular compacto (misma línea que el panel). */
const catalogProductSummarySquareClass =
  'catalog-accordion-summary inline-flex h-10 min-w-[5.25rem] max-w-[7.5rem] w-auto shrink-0 cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded border-2 border-red-500/70 bg-zinc-900 px-1.5 py-1 text-center shadow-sm transition hover:border-red-400 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/55 active:scale-[0.98] group-open:border-red-400 group-open:bg-zinc-900'

function toggleSectionExpanded(
  setOpen: Dispatch<SetStateAction<boolean>>,
  bulkLockRef: MutableRefObject<boolean>,
  onUserExpandedSection: () => void,
) {
  setOpen((prev) => {
    const next = !prev
    if (next && !bulkLockRef.current) queueMicrotask(() => onUserExpandedSection())
    return next
  })
}

const sectionHeaderHitAreaClass =
  'flex min-w-0 flex-1 cursor-pointer select-none items-start gap-2 rounded-lg border border-transparent px-1 py-1.5 transition hover:border-zinc-600/50 hover:bg-zinc-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40'

function CollapseChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CatalogRubroNameHeader({
  busy,
  open,
  onToggleOpen,
  statsWhenCollapsed,
  name,
  onRename,
  onRequestDelete,
  deleteCompact,
  toggleSectionKind,
  chevronBoxClass,
  titleClassName,
  titleSuffix,
  containerClassName = 'mb-2 flex flex-wrap items-center justify-between gap-2',
  deleteAriaLabel = 'Eliminar',
}: {
  busy: boolean
  open: boolean
  onToggleOpen: () => void
  statsWhenCollapsed: ReactNode
  name: string
  onRename: (upperName: string) => Promise<boolean>
  onRequestDelete: () => void
  deleteCompact?: boolean
  toggleSectionKind: string
  chevronBoxClass: string
  titleClassName: string
  titleSuffix?: ReactNode
  containerClassName?: string
  deleteAriaLabel?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [name, editing])

  const delClass = deleteCompact ? catalogDeleteBtnClassCompact : catalogDeleteBtnClass

  function handleToggle() {
    if (editing) return
    onToggleOpen()
  }

  return (
    <div className={containerClassName}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? `Contraer ${toggleSectionKind}` : `Expandir ${toggleSectionKind}`}
        className={sectionHeaderHitAreaClass}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (editing) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleOpen()
          }
        }}
      >
        <span className={`mt-0.5 shrink-0 self-start rounded-md ${chevronBoxClass}`} aria-hidden>
          <CollapseChevron expanded={open} />
        </span>
        {editing ? (
          <>
            <input
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value.toLocaleUpperCase('es-AR'))}
              className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
              disabled={busy}
              aria-label="Nuevo nombre"
              autoFocus
            />
            {titleSuffix ? <span className="shrink-0">{titleSuffix}</span> : null}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-x-2 sm:overflow-hidden">
            <span className="flex min-w-0 items-baseline gap-x-2 sm:min-w-0 sm:flex-1 sm:overflow-hidden">
              <span
                className={`min-w-0 max-sm:whitespace-normal max-sm:break-words sm:truncate ${titleClassName}`}
              >
                {upperCategoryLabel(name)}
              </span>
              {titleSuffix}
            </span>
            {!open && !editing ? (
              <span className="max-sm:w-full max-sm:shrink-0 sm:shrink-0">{statsWhenCollapsed}</span>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              className={catalogSaveBtnClassCompact}
              disabled={busy}
              onClick={async (e) => {
                e.stopPropagation()
                const next = upperCategoryLabel(draft)
                if (!next) {
                  alert('El nombre no puede estar vacío.')
                  return
                }
                const ok = await onRename(next)
                if (ok) setEditing(false)
              }}
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-zinc-800"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                setEditing(false)
                setDraft(name)
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            className={catalogSaveBtnClassCompact}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              setDraft(name)
              setEditing(true)
            }}
          >
            Editar
          </button>
        )}
        <button
          type="button"
          className={delClass}
          disabled={busy || editing}
          aria-label={deleteAriaLabel}
          onClick={(e) => {
            e.stopPropagation()
            onRequestDelete()
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}

function countCategoryStats(cat: CategoryRow): { subs: number; products: number } {
  const subs = cat.subcategories?.length ?? 0
  let products = 0
  for (const s of cat.subcategories ?? []) {
    products += s.products?.length ?? 0
    for (const ss of s.subsubcategorias ?? []) {
      products += ss.products?.length ?? 0
    }
  }
  return { subs, products }
}

function countSubcategoryStats(node: SubcategoryRow): { subsubs: number; products: number } {
  const subsubs = node.subsubcategorias?.length ?? 0
  let products = node.products?.length ?? 0
  for (const ss of node.subsubcategorias ?? []) {
    products += ss.products?.length ?? 0
  }
  return { subsubs, products }
}

/** Misma UX que eliminar categoría: overlay, Escape, borde rojo, resumen opcional. */
function CatalogDangerConfirmDialog({
  title,
  titleId,
  busy,
  onCancel,
  onConfirm,
  children,
  summary,
}: {
  title: string
  titleId: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
  children: ReactNode
  summary?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border-2 border-red-900/55 bg-zinc-900 p-5 shadow-2xl shadow-black/60 ring-1 ring-red-950/30"
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight text-red-200">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-zinc-300">{children}</div>
        {summary ? (
          <div className="mt-4 rounded-xl border border-zinc-700/90 bg-zinc-950/90 px-3 py-2.5 text-xs text-white">
            {summary}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border-2 border-red-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-red-100 shadow-md transition hover:border-red-500 hover:bg-zinc-800 disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function normalizeProductRow(p: ProductRow): ProductRow {
  return { ...p, image_gallery: normalizeGallery(p.image_gallery), variants: p.variants ?? [] }
}

function treeCategories(categories: CategoryRow[]) {
  return sortOrder(categories).map((c) => ({
    ...c,
    subcategories: sortOrder(c.subcategories).map((s) => ({
      ...s,
      products: sortOrder(s.products).map(normalizeProductRow),
      subsubcategorias: sortOrder(s.subsubcategorias).map((ss) => ({
        ...ss,
        products: sortOrder(ss.products).map(normalizeProductRow),
      })),
    })),
  }))
}

export function CatalogEditor({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter()
  const sb = createClient()
  const data = useMemo(() => treeCategories(initial), [initial])

  const [catName, setCatName] = useState('')
  const [busy, setBusy] = useState(false)
  const [collapseAllTick, setCollapseAllTick] = useState(0)
  const [expandAllTick, setExpandAllTick] = useState(0)
  const [showExpandAll, setShowExpandAll] = useState(true)
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
      setCollapseAllTick((n) => n + 1)
      setShowExpandAll(true)
    })
  }

  const handleExpandAll = () => {
    runBulkLocked(() => {
      setExpandAllTick((n) => n + 1)
      setShowExpandAll(false)
    })
  }

  const onUserExpandedSection = () => {
    if (!bulkLockRef.current) setShowExpandAll(false)
  }

  async function refresh() {
    router.refresh()
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catName.trim()) return
    setBusy(true)
    await sb
      .from('categories')
      .insert({ name: upperCategoryLabel(catName), sort_order: Date.now() % 100000 })
    setCatName('')
    setBusy(false)
    await refresh()
  }

  async function addSubcategory(categoryId: string, name: string) {
    if (!name.trim()) return
    setBusy(true)
    const { error } = await sb.from('subcategories').insert({
      category_id: categoryId,
      name: upperCategoryLabel(name),
      sort_order: Date.now() % 100000,
    })
    if (error) {
      alert(error.message)
      setBusy(false)
      return
    }
    setBusy(false)
    await refresh()
  }

  async function addSubsubcategoria(subcategoryId: string, name: string) {
    if (!name.trim()) return
    setBusy(true)
    const { data, error } = await sb
      .from('subsubcategorias')
      .insert({
        subcategory_id: subcategoryId,
        name: upperCategoryLabel(name),
        sort_order: Date.now() % 100000,
      })
      .select('id')
      .maybeSingle()
    if (error) {
      const msg = formatSupabaseError(error)
      if (/subsubcategorias|schema cache|could not find|does not exist/i.test(msg)) {
        alert(
          'Falta la tabla o columnas en Supabase.\n\n' +
            '1) SQL Editor: supabase/migrations/003_subsubcategorias.sql\n' +
            '2) Si sigue fallando el alta: supabase/migrations/004_subsubcategorias_rls_grants.sql\n\n' +
            msg,
        )
      } else if (/row-level security|42501/i.test(msg)) {
        alert(
          'Permisos (RLS): tu usuario no puede insertar en subsubcategorias.\n\n' +
            'Ejecutá en SQL Editor:\nsupabase/migrations/004_subsubcategorias_rls_grants.sql\n\n' +
            msg,
        )
      } else {
        alert(msg)
      }
      setBusy(false)
      return
    }
    if (!data?.id) {
      alert(
        'El insert no devolvió fila (suele ser RLS). Ejecutá en Supabase SQL:\n' +
          'supabase/migrations/004_subsubcategorias_rls_grants.sql',
      )
      setBusy(false)
      return
    }
    setBusy(false)
    await refresh()
  }

  async function renameCategory(id: string, raw: string): Promise<boolean> {
    const next = upperCategoryLabel(raw)
    if (!next) {
      alert('El nombre no puede estar vacío.')
      return false
    }
    setBusy(true)
    const { error } = await sb.from('categories').update({ name: next }).eq('id', id)
    setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return false
    }
    await refresh()
    return true
  }

  async function renameSubcategory(id: string, raw: string): Promise<boolean> {
    const next = upperCategoryLabel(raw)
    if (!next) {
      alert('El nombre no puede estar vacío.')
      return false
    }
    setBusy(true)
    const { error } = await sb.from('subcategories').update({ name: next }).eq('id', id)
    setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return false
    }
    await refresh()
    return true
  }

  async function renameSubsubcategoria(id: string, raw: string): Promise<boolean> {
    const next = upperCategoryLabel(raw)
    if (!next) {
      alert('El nombre no puede estar vacío.')
      return false
    }
    setBusy(true)
    const { error } = await sb.from('subsubcategorias').update({ name: next }).eq('id', id)
    setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return false
    }
    await refresh()
    return true
  }

  async function addProduct(
    subcategoryId: string,
    subsubcategoriaId: string | null,
    fields: ProductDraftFields,
    opts?: AddProductOpts,
  ): Promise<boolean> {
    const requireNumericSize = opts?.requireNumericSize ?? false
    const name = fields.name.trim()
    if (!name) {
      alert('El nombre del producto es obligatorio.')
      return false
    }
    const price = Number(fields.price.replace(',', '.'))
    const stock = Number.parseInt(fields.stock, 10)
    if (!Number.isFinite(price) || price < 0) {
      alert('Precio inválido.')
      return false
    }
    if (!Number.isFinite(stock) || stock < 0) {
      alert('Stock inválido.')
      return false
    }
    const numericSize = sanitizeNumericSizeLabel(fields.size ?? '')
    if (requireNumericSize && !numericSize) {
      alert('En anillos tenés que cargar un talle numérico.')
      return false
    }
    setBusy(true)
    const row: Record<string, unknown> = {
      subcategory_id: subcategoryId,
      name,
      description: fields.description.trim() || null,
      price,
      stock_quantity: stock,
      active: true,
      sort_order: Date.now() % 100000,
    }
    if (subsubcategoriaId) row.subsubcategoria_id = subsubcategoriaId
    else row.subsubcategoria_id = null

    const { data: created, error } = await sb.from('products').insert(row).select('id').maybeSingle()
    if (error) {
      alert(formatSupabaseError(error))
      setBusy(false)
      return false
    }
    if (!created?.id) {
      alert('No se pudo crear el producto.')
      setBusy(false)
      return false
    }
    if (requireNumericSize) {
      const { error: variantError } = await sb.from('product_variants').insert({
        product_id: created.id,
        size_label: numericSize,
        stock_quantity: stock,
        active: true,
        sort_order: Date.now() % 100000,
      })
      if (variantError) {
        const { error: rollbackError } = await sb.from('products').delete().eq('id', created.id)
        alert(
          'No se pudo crear el talle inicial del anillo, así que el producto no se guardó.\n\n' +
            formatSupabaseError(variantError) +
            (rollbackError
              ? `\n\nAdemás, falló la reversión automática del producto: ${formatSupabaseError(rollbackError)}`
              : ''),
        )
        setBusy(false)
        return false
      }
    }
    setBusy(false)
    await refresh()
    return true
  }

  async function updateProduct(id: string, patch: ProductPatch, opts?: CatalogCommitOpts) {
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    if (Object.keys(patch).length > 0) {
      await sb.from('products').update(patch).eq('id', id)
    }
    if (!skipBusy) setBusy(false)
    if (!skipRefresh) await refresh()
  }

  async function addProductVariant(
    productId: string,
    sizeLabel: string,
    stockQuantity: number,
    active: boolean,
    opts?: CatalogCommitOpts,
  ) {
    if (!sizeLabel.trim()) return
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return
    if (typeof active !== 'boolean') active = true
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const { error } = await sb.from('product_variants').insert({
      product_id: productId,
      size_label: sizeLabel.trim(),
      stock_quantity: Math.floor(stockQuantity),
      active,
      sort_order: Date.now() % 100000,
    })
    if (!skipBusy) setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return
    }
    if (!skipRefresh) await refresh()
  }

  async function updateProductVariant(variantId: string, patch: ProductVariantPatch, opts?: CatalogCommitOpts) {
    if (Object.keys(patch).length === 0) return
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const { error } = await sb.from('product_variants').update(patch).eq('id', variantId)
    if (!skipBusy) setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return
    }
    if (!skipRefresh) await refresh()
  }

  async function deleteProductVariant(variantId: string, opts?: CatalogCommitOpts) {
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const { error } = await sb.from('product_variants').delete().eq('id', variantId)
    if (!skipBusy) setBusy(false)
    if (error) {
      alert(formatSupabaseError(error))
      return
    }
    if (!skipRefresh) await refresh()
  }

  const variantCatalogActions: VariantCatalogActions = {
    addVariant: (productId, sizeLabel, stockQuantity, active, opts) =>
      addProductVariant(productId, sizeLabel, stockQuantity, active, opts),
    updateVariant: (variantId, patch, opts) => updateProductVariant(variantId, patch, opts),
    deleteVariant: (variantId, opts) => deleteProductVariant(variantId, opts),
  }

  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<{
    id: string
    name: string
    subs: number
    products: number
  } | null>(null)

  const [pendingSubcategoryDelete, setPendingSubcategoryDelete] = useState<{
    id: string
    name: string
    subsubs: number
    products: number
  } | null>(null)

  const [pendingSubsubDelete, setPendingSubsubDelete] = useState<{
    id: string
    name: string
    products: number
  } | null>(null)

  const [pendingProductDelete, setPendingProductDelete] = useState<{
    id: string
    name: string
    price: number
  } | null>(null)

  async function confirmDeleteCategory() {
    if (!pendingCategoryDelete) return
    setBusy(true)
    const id = pendingCategoryDelete.id
    const { error } = await sb.from('categories').delete().eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setPendingCategoryDelete(null)
    await refresh()
  }

  async function confirmDeleteSubcategory() {
    if (!pendingSubcategoryDelete) return
    setBusy(true)
    const id = pendingSubcategoryDelete.id
    const { error } = await sb.from('subcategories').delete().eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setPendingSubcategoryDelete(null)
    await refresh()
  }

  async function confirmDeleteSubsub() {
    if (!pendingSubsubDelete) return
    setBusy(true)
    const id = pendingSubsubDelete.id
    const { error } = await sb.from('subsubcategorias').delete().eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setPendingSubsubDelete(null)
    await refresh()
  }

  async function confirmDeleteProduct() {
    if (!pendingProductDelete) return
    setBusy(true)
    const id = pendingProductDelete.id
    const { error } = await sb.from('products').delete().eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setPendingProductDelete(null)
    await refresh()
  }

  async function uploadImage(productId: string, file: File | null, opts?: CatalogCommitOpts) {
    if (!file) return
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `${productId}/${Date.now()}-${safe}`
    const { error: upErr } = await sb.storage.from('product-images').upload(path, file, {
      upsert: true,
    })
    if (upErr) {
      alert(upErr.message)
      if (!skipBusy) setBusy(false)
      return
    }
    await sb.from('products').update({ image_path: path }).eq('id', productId)
    if (!skipBusy) setBusy(false)
    if (!skipRefresh) await refresh()
  }

  async function uploadGalleryImage(productId: string, file: File | null, opts?: CatalogCommitOpts) {
    if (!file) return
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `${productId}/${Date.now()}-g-${safe}`
    const { error: upErr } = await sb.storage.from('product-images').upload(path, file, {
      upsert: true,
    })
    if (upErr) {
      alert(upErr.message)
      if (!skipBusy) setBusy(false)
      return
    }
    const { data: row, error: selErr } = await sb
      .from('products')
      .select('image_gallery')
      .eq('id', productId)
      .maybeSingle()
    if (selErr) {
      alert(selErr.message)
      if (!skipBusy) setBusy(false)
      return
    }
    const current = normalizeGallery((row as { image_gallery?: unknown } | null)?.image_gallery)
    if (current.includes(path)) {
      if (!skipBusy) setBusy(false)
      if (!skipRefresh) await refresh()
      return
    }
    await sb.from('products').update({ image_gallery: [...current, path] }).eq('id', productId)
    if (!skipBusy) setBusy(false)
    if (!skipRefresh) await refresh()
  }

  async function removeGalleryPath(productId: string, storagePath: string, opts?: CatalogCommitOpts) {
    const skipBusy = opts?.skipBusy ?? false
    const skipRefresh = opts?.skipRefresh ?? false
    if (!skipBusy) setBusy(true)
    const { data: row, error: selErr } = await sb
      .from('products')
      .select('image_gallery')
      .eq('id', productId)
      .maybeSingle()
    if (selErr) {
      alert(selErr.message)
      if (!skipBusy) setBusy(false)
      return
    }
    const current = normalizeGallery((row as { image_gallery?: unknown } | null)?.image_gallery)
    const next = current.filter((x) => x !== storagePath)
    await sb.from('products').update({ image_gallery: next }).eq('id', productId)
    if (!skipBusy) setBusy(false)
    if (!skipRefresh) await refresh()
  }

  return (
    <div className={`relative space-y-8 ${busy ? 'opacity-70' : ''}`}>
      {pendingCategoryDelete ? (
        <CatalogDangerConfirmDialog
          title="¿Eliminar esta categoría?"
          titleId="delete-cat-title"
          busy={busy}
          onCancel={() => setPendingCategoryDelete(null)}
          onConfirm={() => void confirmDeleteCategory()}
          summary={
            <>
              Resumen actual:{' '}
              <span className="font-semibold text-zinc-300">
                {pendingCategoryDelete.subs} subcategoría{pendingCategoryDelete.subs === 1 ? '' : 's'}
              </span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span className="font-semibold text-zinc-300">
                {pendingCategoryDelete.products} producto{pendingCategoryDelete.products === 1 ? '' : 's'}
              </span>
            </>
          }
        >
          <p>
            Se va a borrar <strong className="text-rose-200">{upperCategoryLabel(pendingCategoryDelete.name)}</strong> y{' '}
            <strong className="text-zinc-100">todo</strong> el contenido asociado de forma permanente:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
            <li>Todas las subcategorías</li>
            <li>Todas las sub-subcategorías</li>
            <li>Todos los productos de ese árbol</li>
          </ul>
        </CatalogDangerConfirmDialog>
      ) : null}

      {pendingSubcategoryDelete ? (
        <CatalogDangerConfirmDialog
          title="¿Eliminar esta subcategoría?"
          titleId="delete-sub-title"
          busy={busy}
          onCancel={() => setPendingSubcategoryDelete(null)}
          onConfirm={() => void confirmDeleteSubcategory()}
          summary={
            <>
              Resumen:{' '}
              <span className="font-semibold text-zinc-300">
                {pendingSubcategoryDelete.subsubs} sub-sub{pendingSubcategoryDelete.subsubs === 1 ? '' : 's'}
              </span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span className="font-semibold text-zinc-300">
                {pendingSubcategoryDelete.products} producto{pendingSubcategoryDelete.products === 1 ? '' : 's'} (en total)
              </span>
            </>
          }
        >
          <p>
            Se va a borrar <strong className="text-rose-200">{upperCategoryLabel(pendingSubcategoryDelete.name)}</strong>{' '}
            y <strong className="text-zinc-100">todo</strong> lo que depende de ella de forma permanente:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
            <li>Todas las sub-subcategorías bajo esta subcategoría</li>
            <li>Los productos de la subcategoría y los de cada sub-sub</li>
          </ul>
        </CatalogDangerConfirmDialog>
      ) : null}

      {pendingSubsubDelete ? (
        <CatalogDangerConfirmDialog
          title="¿Eliminar esta sub-subcategoría?"
          titleId="delete-subsub-title"
          busy={busy}
          onCancel={() => setPendingSubsubDelete(null)}
          onConfirm={() => void confirmDeleteSubsub()}
          summary={
            <>
              Productos afectados:{' '}
              <span className="font-semibold text-zinc-300">
                {pendingSubsubDelete.products} producto{pendingSubsubDelete.products === 1 ? '' : 's'}
              </span>
            </>
          }
        >
          <p>
            Se va a borrar <strong className="text-rose-200">{upperCategoryLabel(pendingSubsubDelete.name)}</strong> y{' '}
            <strong className="text-zinc-100">todos</strong> los productos que solo pertenecen a ese rubro.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
            <li>La sub-subcategoría desaparece del catálogo</li>
            <li>Los productos enlazados a ella se eliminan</li>
          </ul>
        </CatalogDangerConfirmDialog>
      ) : null}

      {pendingProductDelete ? (
        <CatalogDangerConfirmDialog
          title="¿Eliminar este producto?"
          titleId="delete-product-title"
          busy={busy}
          onCancel={() => setPendingProductDelete(null)}
          onConfirm={() => void confirmDeleteProduct()}
          summary={
            <>
              Precio actual:{' '}
              <span className="font-semibold text-zinc-300">{formatMoneyArs(pendingProductDelete.price)}</span>
            </>
          }
        >
          <p>
            Vas a borrar de forma permanente el producto{' '}
            <strong className="text-rose-200">{pendingProductDelete.name}</strong>. No se puede deshacer.
          </p>
        </CatalogDangerConfirmDialog>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-rose-100">Catálogo</h1>
      </div>

      <form
        onSubmit={addCategory}
        className={`flex flex-wrap items-end gap-2 p-4 ${storeCatalogFrameSubClass}`}
      >
        <div>
          <label htmlFor="catalog-new-category-name" className="text-xs text-white">
            Nueva categoría
          </label>
          <input
            id="catalog-new-category-name"
            name="newCategoryName"
            autoComplete="off"
            className="mt-1 block rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={catName}
            onChange={(e) => setCatName(e.target.value.toLocaleUpperCase('es-AR'))}
            placeholder="NOMBRE"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          disabled={busy}
        >
          Agregar categoría
        </button>
      </form>

      {data.length > 0 ? (
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
      ) : null}

      {data.map((cat) => (
        <CategorySection
          key={cat.id}
          cat={cat}
          busy={busy}
          collapseAllTick={collapseAllTick}
          expandAllTick={expandAllTick}
          bulkLockRef={bulkLockRef}
          onUserExpandedSection={onUserExpandedSection}
          onRequestDeleteCategory={() => {
            const st = countCategoryStats(cat)
            setPendingCategoryDelete({
              id: cat.id,
              name: cat.name,
              subs: st.subs,
              products: st.products,
            })
          }}
          onAddSubcategory={(name) => addSubcategory(cat.id, name)}
          onAddSubsub={(subId, name) => addSubsubcategoria(subId, name)}
          onAddProduct={(subId, subsubId, fields, opts) => addProduct(subId, subsubId, fields, opts)}
          onRequestDeleteSubcategory={(ctx) => setPendingSubcategoryDelete(ctx)}
          onRequestDeleteSubsub={(ctx) => setPendingSubsubDelete(ctx)}
          updateProduct={updateProduct}
          onRequestDeleteProduct={(ctx) => setPendingProductDelete(ctx)}
          uploadImage={uploadImage}
          uploadGalleryImage={uploadGalleryImage}
          removeGalleryPath={removeGalleryPath}
          variantCatalogActions={variantCatalogActions}
          onRenameCategory={(name) => renameCategory(cat.id, name)}
          renameSubcategory={renameSubcategory}
          renameSubsubcategoria={renameSubsubcategoria}
        />
      ))}
    </div>
  )
}

function CategorySection({
  cat,
  busy,
  collapseAllTick,
  expandAllTick,
  bulkLockRef,
  onUserExpandedSection,
  onRequestDeleteCategory,
  onAddSubcategory,
  onAddSubsub,
  onAddProduct,
  onRequestDeleteSubcategory,
  onRequestDeleteSubsub,
  updateProduct,
  onRequestDeleteProduct,
  uploadImage,
  uploadGalleryImage,
  removeGalleryPath,
  variantCatalogActions,
  onRenameCategory,
  renameSubcategory,
  renameSubsubcategoria,
}: {
  cat: CategoryRow
  busy: boolean
  collapseAllTick: number
  expandAllTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserExpandedSection: () => void
  onRequestDeleteCategory: () => void
  onAddSubcategory: (name: string) => void
  onAddSubsub: (subcategoryId: string, name: string) => void
  onAddProduct: (
    subcategoryId: string,
    subsubcategoriaId: string | null,
    fields: ProductDraftFields,
    opts?: AddProductOpts,
  ) => Promise<boolean>
  onRequestDeleteSubcategory: (ctx: { id: string; name: string; subsubs: number; products: number }) => void
  onRequestDeleteSubsub: (ctx: { id: string; name: string; products: number }) => void
  updateProduct: (id: string, patch: ProductPatch, opts?: CatalogCommitOpts) => Promise<void>
  onRequestDeleteProduct: (ctx: { id: string; name: string; price: number }) => void
  uploadImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  uploadGalleryImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  removeGalleryPath: (productId: string, storagePath: string, opts?: CatalogCommitOpts) => Promise<void>
  variantCatalogActions: VariantCatalogActions
  onRenameCategory: (name: string) => Promise<boolean>
  renameSubcategory: (id: string, raw: string) => Promise<boolean>
  renameSubsubcategoria: (id: string, raw: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const { subs, products } = countCategoryStats(cat)
  const requireNumericSize = isRingCategoryName(cat.name)

  useEffect(() => {
    if (collapseAllTick === 0) return
    setOpen(false)
  }, [collapseAllTick])

  useEffect(() => {
    if (expandAllTick === 0) return
    setOpen(true)
  }, [expandAllTick])

  return (
    <section className={`${storeCatalogFrameCategoryClass} p-4`}>
      <CatalogRubroNameHeader
        busy={busy}
        open={open}
        onToggleOpen={() => toggleSectionExpanded(setOpen, bulkLockRef, onUserExpandedSection)}
        statsWhenCollapsed={
          <span className="shrink-0 whitespace-nowrap text-[10px] text-white">
            {subs} sub. · {products} prod.
          </span>
        }
        name={cat.name}
        onRename={onRenameCategory}
        onRequestDelete={onRequestDeleteCategory}
        toggleSectionKind="categoría"
        chevronBoxClass="border border-zinc-600 bg-zinc-900 p-1.5 text-white"
        titleClassName="text-lg font-medium tracking-wide text-rose-200"
        containerClassName="mb-3 flex flex-wrap items-center justify-between gap-2"
        deleteAriaLabel="Eliminar categoría"
      />

      {open ? (
        <>
          <SubcategoryForm
            disabled={busy}
            hint="Nueva subcategoría (nivel 2)"
            onAdd={onAddSubcategory}
          />

          {(cat.subcategories ?? []).map((sub) => (
            <SubcategorySection
              key={sub.id}
              node={sub}
              busy={busy}
              collapseAllTick={collapseAllTick}
              expandAllTick={expandAllTick}
              bulkLockRef={bulkLockRef}
              onUserExpandedSection={onUserExpandedSection}
              onAddSubsub={(name) => onAddSubsub(sub.id, name)}
              onAddProduct={(subsubId, fields) =>
                onAddProduct(sub.id, subsubId, fields, { requireNumericSize })
              }
              onRequestDeleteSubcategory={() =>
                onRequestDeleteSubcategory({
                  id: sub.id,
                  name: sub.name,
                  ...countSubcategoryStats(sub),
                })
              }
              onRequestDeleteSubsub={onRequestDeleteSubsub}
              updateProduct={updateProduct}
              onRequestDeleteProduct={onRequestDeleteProduct}
              uploadImage={uploadImage}
              uploadGalleryImage={uploadGalleryImage}
              removeGalleryPath={removeGalleryPath}
              variantCatalogActions={variantCatalogActions}
              renameSubcategory={renameSubcategory}
              renameSubsubcategoria={renameSubsubcategoria}
              requireNumericSize={requireNumericSize}
            />
          ))}
        </>
      ) : null}
    </section>
  )
}

function SubcategorySection({
  node,
  busy,
  collapseAllTick,
  expandAllTick,
  bulkLockRef,
  onUserExpandedSection,
  onAddSubsub,
  onAddProduct,
  onRequestDeleteSubcategory,
  onRequestDeleteSubsub,
  updateProduct,
  onRequestDeleteProduct,
  uploadImage,
  uploadGalleryImage,
  removeGalleryPath,
  variantCatalogActions,
  renameSubcategory,
  renameSubsubcategoria,
  requireNumericSize,
}: {
  node: SubcategoryRow
  busy: boolean
  collapseAllTick: number
  expandAllTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserExpandedSection: () => void
  onAddSubsub: (name: string) => void
  onAddProduct: (
    subsubcategoriaId: string | null,
    fields: ProductDraftFields,
  ) => Promise<boolean>
  onRequestDeleteSubcategory: () => void
  onRequestDeleteSubsub: (ctx: { id: string; name: string; products: number }) => void
  updateProduct: (id: string, patch: ProductPatch, opts?: CatalogCommitOpts) => Promise<void>
  onRequestDeleteProduct: (ctx: { id: string; name: string; price: number }) => void
  uploadImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  uploadGalleryImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  removeGalleryPath: (productId: string, storagePath: string, opts?: CatalogCommitOpts) => Promise<void>
  variantCatalogActions: VariantCatalogActions
  renameSubcategory: (id: string, raw: string) => Promise<boolean>
  renameSubsubcategoria: (id: string, raw: string) => Promise<boolean>
  requireNumericSize: boolean
}) {
  const [open, setOpen] = useState(false)
  const nProducts = node.products?.length ?? 0
  const nSubsubs = node.subsubcategorias?.length ?? 0

  useEffect(() => {
    if (collapseAllTick === 0) return
    setOpen(false)
  }, [collapseAllTick])

  useEffect(() => {
    if (expandAllTick === 0) return
    setOpen(true)
  }, [expandAllTick])

  return (
    <div className={`mt-6 ${storeCatalogFrameSubClass} p-3`}>
      <CatalogRubroNameHeader
        busy={busy}
        open={open}
        onToggleOpen={() => toggleSectionExpanded(setOpen, bulkLockRef, onUserExpandedSection)}
        statsWhenCollapsed={
          <span className="shrink-0 whitespace-nowrap text-[10px] text-white">
            {nProducts} prod. · {nSubsubs} sub-sub
          </span>
        }
        name={node.name}
        onRename={(n) => renameSubcategory(node.id, n)}
        onRequestDelete={onRequestDeleteSubcategory}
        toggleSectionKind="subcategoría"
        chevronBoxClass="border border-zinc-500 bg-zinc-900 p-1.5 text-white"
        titleClassName="text-base font-medium tracking-wide text-white"
        deleteAriaLabel="Eliminar subcategoría"
      />

      {open ? (
        <>
          <SubcategoryForm
            disabled={busy}
            hint={`Sub-subcategoría bajo «${upperCategoryLabel(node.name)}»`}
            buttonLabel="+ Sub-sub"
            placeholder="NOMBRE SUB-SUB"
            onAdd={onAddSubsub}
          />

          <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-white">
            Productos en esta subcategoría
          </p>
          <ProductAddForm
            disabled={busy}
            onAdd={(f) => onAddProduct(null, f)}
            requireNumericSize={requireNumericSize}
          />
          <ProductList
            products={node.products ?? []}
            busy={busy}
            updateProduct={updateProduct}
            onRequestDeleteProduct={onRequestDeleteProduct}
            uploadImage={uploadImage}
            uploadGalleryImage={uploadGalleryImage}
            removeGalleryPath={removeGalleryPath}
            variantCatalogActions={variantCatalogActions}
            requireNumericSize={requireNumericSize}
          />

          {(node.subsubcategorias ?? []).map((ss) => (
            <SubsubSection
              key={ss.id}
              node={ss}
              busy={busy}
              collapseAllTick={collapseAllTick}
              expandAllTick={expandAllTick}
              bulkLockRef={bulkLockRef}
              onUserExpandedSection={onUserExpandedSection}
              onAddProduct={(fields) => onAddProduct(ss.id, fields)}
              onRequestDeleteSubsub={onRequestDeleteSubsub}
              updateProduct={updateProduct}
              onRequestDeleteProduct={onRequestDeleteProduct}
              uploadImage={uploadImage}
              uploadGalleryImage={uploadGalleryImage}
              removeGalleryPath={removeGalleryPath}
              variantCatalogActions={variantCatalogActions}
              renameSubsubcategoria={renameSubsubcategoria}
              requireNumericSize={requireNumericSize}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

function SubsubSection({
  node,
  busy,
  collapseAllTick,
  expandAllTick,
  bulkLockRef,
  onUserExpandedSection,
  onAddProduct,
  onRequestDeleteSubsub,
  updateProduct,
  onRequestDeleteProduct,
  uploadImage,
  uploadGalleryImage,
  removeGalleryPath,
  variantCatalogActions,
  renameSubsubcategoria,
  requireNumericSize,
}: {
  node: SubsubcategoriaRow
  busy: boolean
  collapseAllTick: number
  expandAllTick: number
  bulkLockRef: MutableRefObject<boolean>
  onUserExpandedSection: () => void
  onAddProduct: (fields: ProductDraftFields) => Promise<boolean>
  onRequestDeleteSubsub: (ctx: { id: string; name: string; products: number }) => void
  updateProduct: (id: string, patch: ProductPatch, opts?: CatalogCommitOpts) => Promise<void>
  onRequestDeleteProduct: (ctx: { id: string; name: string; price: number }) => void
  uploadImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  uploadGalleryImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  removeGalleryPath: (productId: string, storagePath: string, opts?: CatalogCommitOpts) => Promise<void>
  variantCatalogActions: VariantCatalogActions
  renameSubsubcategoria: (id: string, raw: string) => Promise<boolean>
  requireNumericSize: boolean
}) {
  const [open, setOpen] = useState(false)
  const nProducts = node.products?.length ?? 0

  useEffect(() => {
    if (collapseAllTick === 0) return
    setOpen(false)
  }, [collapseAllTick])

  useEffect(() => {
    if (expandAllTick === 0) return
    setOpen(true)
  }, [expandAllTick])

  return (
    <div className={`mt-5 ml-2 p-2 pl-3 sm:ml-3 sm:pl-4 ${storeCatalogFrameSubsubClass}`}>
      <CatalogRubroNameHeader
        busy={busy}
        open={open}
        onToggleOpen={() => toggleSectionExpanded(setOpen, bulkLockRef, onUserExpandedSection)}
        statsWhenCollapsed={
          <span className="shrink-0 whitespace-nowrap text-[10px] text-white">{nProducts} prod.</span>
        }
        name={node.name}
        onRename={(n) => renameSubsubcategoria(node.id, n)}
        onRequestDelete={() =>
          onRequestDeleteSubsub({
            id: node.id,
            name: node.name,
            products: node.products?.length ?? 0,
          })
        }
        deleteCompact
        toggleSectionKind="sub-subcategoría"
        chevronBoxClass="border border-zinc-600 bg-zinc-900 p-1.5 text-white"
        titleClassName="text-sm font-medium tracking-wide text-rose-200/90"
        titleSuffix={<span className="shrink-0 text-[10px] font-normal text-white">(sub-sub)</span>}
        deleteAriaLabel="Eliminar sub-subcategoría"
      />
      {open ? (
        <>
          <ProductAddForm disabled={busy} onAdd={onAddProduct} requireNumericSize={requireNumericSize} />
          <ProductList
            products={node.products ?? []}
            busy={busy}
            updateProduct={updateProduct}
            onRequestDeleteProduct={onRequestDeleteProduct}
            uploadImage={uploadImage}
            uploadGalleryImage={uploadGalleryImage}
            removeGalleryPath={removeGalleryPath}
            variantCatalogActions={variantCatalogActions}
            requireNumericSize={requireNumericSize}
          />
        </>
      ) : null}
    </div>
  )
}

const TEMP_VARIANT_ID_PREFIX = 'temp-variant-'

function ProductCatalogRow({
  p,
  busy,
  updateProduct,
  onRequestDeleteProduct,
  uploadImage,
  uploadGalleryImage,
  removeGalleryPath,
  variantCatalogActions,
  requireNumericSize,
}: {
  p: ProductRow
  busy: boolean
  updateProduct: (id: string, patch: ProductPatch, opts?: CatalogCommitOpts) => Promise<void>
  onRequestDeleteProduct: (ctx: { id: string; name: string; price: number }) => void
  uploadImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  uploadGalleryImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  removeGalleryPath: (productId: string, storagePath: string, opts?: CatalogCommitOpts) => Promise<void>
  variantCatalogActions: VariantCatalogActions
  requireNumericSize: boolean
}) {
  const [draftName, setDraftName] = useState(p.name)
  const [draftDescription, setDraftDescription] = useState(p.description ?? '')
  const [draftPrice, setDraftPrice] = useState(String(Number(p.price)))
  const [newTalle, setNewTalle] = useState('')
  const [newStock, setNewStock] = useState('0')
  const [draftStock, setDraftStock] = useState(p.stock_quantity)
  const [localActive, setLocalActive] = useState(p.active)
  const [draftVariants, setDraftVariants] = useState<ProductVariantRow[]>(() => sortOrder(p.variants ?? []))
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])
  const [pendingMainFile, setPendingMainFile] = useState<File | null>(null)
  const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null)
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState<{ file: File; url: string }[]>([])
  const [localGalleryPaths, setLocalGalleryPaths] = useState<string[]>(() => normalizeGallery(p.image_gallery))
  const [removedGalleryPaths, setRemovedGalleryPaths] = useState<string[]>([])

  const variantSig = useMemo(
    () =>
      (p.variants ?? [])
        .map((v) => `${v.id}:${v.size_label}:${v.stock_quantity}:${v.active ? '1' : '0'}`)
        .sort()
        .join('|'),
    [p.variants],
  )
  const gallerySig = useMemo(() => (p.image_gallery ?? []).join('|'), [p.image_gallery])
  const initialGalleryPaths = useMemo(() => normalizeGallery(p.image_gallery), [p.image_gallery])

  useEffect(() => {
    setDraftName(p.name)
    setDraftDescription(p.description ?? '')
    setDraftPrice(String(Number(p.price)))
    setDraftVariants(sortOrder(p.variants ?? []).map((v) => ({ ...v })))
    setRemovedVariantIds([])
    setNewTalle('')
    setNewStock('0')
    setDraftStock(p.stock_quantity)
    setLocalActive(p.active)
    setPendingMainFile(null)
    setMainPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPendingGalleryFiles((prev) => {
      prev.forEach((x) => URL.revokeObjectURL(x.url))
      return []
    })
    setLocalGalleryPaths(initialGalleryPaths)
    setRemovedGalleryPaths([])
  }, [p.id, p.name, p.description, p.price, variantSig, gallerySig, p.stock_quantity, p.active, p.image_path, initialGalleryPaths])

  useEffect(() => {
    if (!mainPreviewUrl) return
    return () => URL.revokeObjectURL(mainPreviewUrl)
  }, [mainPreviewUrl])

  const hasVariants = draftVariants.length > 0
  const serverMainUrl = getPublicUrlFromPath(p.image_path)
  const mainThumbSrc = mainPreviewUrl ?? serverMainUrl
  const draftVariantSig = useMemo(
    () =>
      sortOrder(draftVariants)
        .map((v) => `${v.id}:${v.size_label}:${v.stock_quantity}:${v.active ? '1' : '0'}`)
        .join('|'),
    [draftVariants],
  )
  const hasPendingChanges = useMemo(() => {
    const galleryChanged = localGalleryPaths.join('|') !== initialGalleryPaths.join('|')
    const variantsChanged = draftVariantSig !== variantSig
    return (
      draftName !== p.name ||
      draftDescription !== (p.description ?? '') ||
      draftPrice !== String(Number(p.price)) ||
      (!hasVariants && draftStock !== p.stock_quantity) ||
      localActive !== p.active ||
      variantsChanged ||
      galleryChanged ||
      pendingMainFile !== null ||
      pendingGalleryFiles.length > 0
    )
  }, [
    draftDescription,
    draftName,
    draftPrice,
    draftStock,
    draftVariantSig,
    hasVariants,
    initialGalleryPaths,
    localActive,
    localGalleryPaths,
    p.active,
    p.description,
    p.name,
    p.price,
    p.stock_quantity,
    pendingGalleryFiles.length,
    pendingMainFile,
    variantSig,
  ])

  function pickMainImage(file: File | null) {
    if (!file) return
    setMainPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setPendingMainFile(file)
  }

  function pickGalleryImage(file: File | null) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPendingGalleryFiles((prev) => [...prev, { file, url }])
  }

  function removeLocalGalleryPath(path: string) {
    setLocalGalleryPaths((prev) => prev.filter((x) => x !== path))
    setRemovedGalleryPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
  }

  function removePendingGalleryAt(index: number) {
    setPendingGalleryFiles((prev) => {
      const next = [...prev]
      const [x] = next.splice(index, 1)
      if (x) URL.revokeObjectURL(x.url)
      return next
    })
  }

  function appendNewDraftVariant() {
    const stock = Number.parseInt(newStock, 10)
    const sizeLabel = requireNumericSize ? sanitizeNumericSizeLabel(newTalle) : newTalle.trim()
    if (!sizeLabel) {
      alert('Escribí un talle.')
      return
    }
    if (!Number.isFinite(stock) || stock < 0) {
      alert('Stock inválido.')
      return
    }
    const id = `${TEMP_VARIANT_ID_PREFIX}${crypto.randomUUID()}`
    setDraftVariants((prev) => [
      ...prev,
      {
        id,
        product_id: p.id,
          size_label: sizeLabel,
        stock_quantity: stock,
        active: true,
        sort_order: Date.now() % 100000,
      },
    ])
    setNewTalle('')
    setNewStock('0')
  }

  function removeDraftVariant(id: string, sizeLabel: string) {
    if (!window.confirm(`¿Quitar el talle «${sizeLabel}»? (se aplicará al guardar)`)) return
    if (id.startsWith(TEMP_VARIANT_ID_PREFIX)) {
      setDraftVariants((prev) => prev.filter((x) => x.id !== id))
      return
    }
    setRemovedVariantIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setDraftVariants((prev) => prev.filter((x) => x.id !== id))
  }

  function updateDraftVariant(
    id: string,
    next: Partial<Pick<ProductVariantRow, 'size_label' | 'stock_quantity' | 'active'>>,
  ) {
    setDraftVariants((prev) => prev.map((x) => (x.id === id ? { ...x, ...next } : x)))
  }

  async function saveEdits() {
    if (!hasPendingChanges) return
    const name = draftName.trim()
    if (name.length === 0) {
      alert('El nombre del producto no puede estar vacío.')
      return
    }
    const descRaw = draftDescription
    const desc = descRaw.trim() || null
    const price = Number(draftPrice.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) {
      alert('Precio inválido.')
      return
    }

    for (const row of draftVariants) {
      const sizeLabel = requireNumericSize ? sanitizeNumericSizeLabel(row.size_label) : row.size_label.trim()
      if (!sizeLabel) {
        alert('Ningún talle puede estar vacío.')
        return
      }
      if (requireNumericSize && sizeLabel !== row.size_label) {
        alert('En anillos los talles solo pueden tener números.')
        return
      }
      if (!Number.isFinite(row.stock_quantity) || row.stock_quantity < 0) {
        alert('Stock de talle inválido.')
        return
      }
    }

    const batch: CatalogCommitOpts = { skipRefresh: true, skipBusy: true }

    try {
      if (pendingMainFile) {
        await uploadImage(p.id, pendingMainFile, batch)
        setPendingMainFile(null)
        setMainPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }

      for (const path of removedGalleryPaths) {
        await removeGalleryPath(p.id, path, batch)
      }
      setRemovedGalleryPaths([])

      for (const { file } of pendingGalleryFiles) {
        await uploadGalleryImage(p.id, file, batch)
      }
      setPendingGalleryFiles((prev) => {
        prev.forEach((x) => URL.revokeObjectURL(x.url))
        return []
      })

      for (const id of removedVariantIds) {
        await variantCatalogActions.deleteVariant(id, batch)
      }
      setRemovedVariantIds([])

      for (const row of draftVariants) {
        const sizeLabel = requireNumericSize ? sanitizeNumericSizeLabel(row.size_label) : row.size_label.trim()
        if (row.id.startsWith(TEMP_VARIANT_ID_PREFIX)) {
          await variantCatalogActions.addVariant(p.id, sizeLabel, row.stock_quantity, row.active, batch)
        } else {
          const orig = (p.variants ?? []).find((x) => x.id === row.id)
          if (!orig) continue
          const vpatch: ProductVariantPatch = {}
          const nl = sizeLabel
          if (nl !== orig.size_label) vpatch.size_label = nl
          if (row.stock_quantity !== orig.stock_quantity) vpatch.stock_quantity = row.stock_quantity
          if (row.active !== orig.active) vpatch.active = row.active
          if (Object.keys(vpatch).length > 0) await variantCatalogActions.updateVariant(row.id, vpatch, batch)
        }
      }

      const patch: ProductPatch = {}
      if (name !== p.name) patch.name = name
      const prevDesc = p.description ?? null
      if (desc !== prevDesc) patch.description = desc
      if (price !== Number(p.price)) patch.price = price
      if (!hasVariants && draftStock !== p.stock_quantity) patch.stock_quantity = draftStock
      if (localActive !== p.active) patch.active = localActive

      if (Object.keys(patch).length > 0) {
        await updateProduct(p.id, patch, batch)
      }

      await updateProduct(p.id, {}, { skipRefresh: false, skipBusy: false })
    } catch (e) {
      console.error(e)
      alert('No se pudieron guardar todos los cambios.')
    }
  }

  return (
    <li className="list-none">
      <details className="group grid grid-cols-1 gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/25 p-2 open:border-red-500/45 sm:grid-cols-[auto,minmax(0,1fr)] sm:items-start sm:gap-3 sm:p-3">
        <summary
          className={catalogProductSummarySquareClass}
          title={p.name}
          aria-label={`${p.name}: expandir o contraer edición del producto`}
        >
          <span className="line-clamp-2 max-h-[2.5rem] w-full break-words text-[9px] font-semibold leading-tight text-zinc-100">
            {p.name}
          </span>
        </summary>
        <div className="col-span-full min-w-0 rounded-md border border-zinc-800/70 bg-zinc-950/40 p-2 sm:col-span-1 sm:border-l sm:border-t-0 sm:border-zinc-700/50 sm:pl-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2 text-sm">
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={draftName}
                disabled={busy}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-400"
                value={draftDescription}
                disabled={busy}
                placeholder="Descripción"
                onChange={(e) => setDraftDescription(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <label className="text-xs text-white">
                  Precio
                  <input
                    type="number"
                    step="0.01"
                    className="ml-1 w-24 rounded border border-zinc-700 bg-zinc-950 px-1"
                    value={draftPrice}
                    disabled={busy}
                    onChange={(e) => setDraftPrice(e.target.value)}
                  />
                </label>
                {!hasVariants ? (
                  <label className="text-xs text-white">
                    Stock
                    <input
                      type="number"
                      className="ml-1 w-20 rounded border border-zinc-700 bg-zinc-950 px-1"
                      value={draftStock}
                      min={0}
                      onChange={(e) => setDraftStock(Number.parseInt(e.target.value, 10) || 0)}
                    />
                  </label>
                ) : null}
              </div>
              {hasVariants ? (
                <p className="text-[10px] leading-snug text-amber-200/85">
                  Hay talles: en la tienda el comprador elige talle y el stock es el de cada fila (el número en «Stock» arriba no se
                  usa en la vitrina).
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={catalogSaveBtnClassCompact}
                  onClick={() => setLocalActive((a) => !a)}
                  aria-label={
                    localActive ? 'Marcar como no disponible en tienda' : 'Marcar como disponible en tienda'
                  }
                >
                  {localActive ? 'Disponible' : 'Agotado'}
                </button>
              </div>
              <div className="rounded border border-zinc-800/80 bg-zinc-950/30 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white">Talles (anillos, etc.)</p>
                <table className="mt-1 w-full max-w-md text-left text-[11px] text-zinc-300">
                  <thead>
                    <tr className="text-[10px] uppercase text-white">
                      <th className="pb-0.5 font-medium">Talle</th>
                      <th className="pb-0.5 font-medium">Stock</th>
                      <th className="pb-0.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftVariants.map((v) => (
                      <tr key={v.id} className="border-t border-zinc-800/50 align-middle">
                        <td className="py-1 pr-1">
                          <input
                            className="w-full min-w-[3rem] rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5"
                            value={v.size_label}
                            disabled={busy}
                            inputMode={requireNumericSize ? 'numeric' : undefined}
                            pattern={requireNumericSize ? '[0-9]*' : undefined}
                            onChange={(e) =>
                              updateDraftVariant(v.id, {
                                size_label: requireNumericSize
                                  ? sanitizeNumericSizeLabel(e.target.value)
                                  : e.target.value,
                                stock_quantity: v.stock_quantity,
                              })
                            }
                          />
                        </td>
                        <td className="py-1 pr-1">
                          <input
                            type="number"
                            min={0}
                            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5"
                            value={v.stock_quantity}
                            disabled={busy}
                            onChange={(e) =>
                              updateDraftVariant(v.id, {
                                size_label: v.size_label,
                                stock_quantity: Number.parseInt(e.target.value, 10) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            className={
                              v.stock_quantity < 1
                                ? 'rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 opacity-60'
                                : v.active
                                  ? 'rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-800'
                                  : 'rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800'
                            }
                            disabled={busy || v.stock_quantity < 1}
                            onClick={() => updateDraftVariant(v.id, { active: !v.active })}
                            aria-label={
                              v.stock_quantity < 1
                                ? `Talle «${v.size_label}» sin stock`
                                : v.active
                                  ? `Ocultar talle «${v.size_label}» de la tienda`
                                  : `Mostrar talle «${v.size_label}» en la tienda`
                            }
                          >
                            {v.stock_quantity < 1 ? 'Agotado' : v.active ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-zinc-800/60 pt-2">
                  <label className="text-[10px] text-white">
                    Nuevo talle
                    <input
                      value={newTalle}
                      onChange={(e) =>
                        setNewTalle(requireNumericSize ? sanitizeNumericSizeLabel(e.target.value) : e.target.value)
                      }
                      placeholder="ej. 14"
                      className="ml-1 w-20 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5"
                      inputMode={requireNumericSize ? 'numeric' : undefined}
                      pattern={requireNumericSize ? '[0-9]*' : undefined}
                      disabled={busy}
                    />
                  </label>
                  <label className="text-[10px] text-white">
                    Stock
                    <input
                      type="number"
                      min={0}
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="ml-1 w-16 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5"
                      disabled={busy}
                    />
                  </label>
                  <button
                    type="button"
                    className={catalogSaveBtnClassCompact}
                    disabled={busy}
                    onClick={appendNewDraftVariant}
                  >
                    Agregar talle
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white">
                  Fotos · principal primero en la tienda (se aplican al pulsar Guardar)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id={`product-image-${p.id}`}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      e.target.value = ''
                      pickMainImage(file)
                    }}
                  />
                  <label
                    htmlFor={`product-image-${p.id}`}
                    className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 shrink-0 opacity-90"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M2 3a1 1 0 0 1 1-1h2.5L6.5 1h3l.5 1H13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm8 3.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
                    </svg>
                    Imagen principal
                  </label>
                  <input
                    id={`product-gallery-${p.id}`}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      e.target.value = ''
                      pickGalleryImage(file)
                    }}
                  />
                  <label
                    htmlFor={`product-gallery-${p.id}`}
                    className="inline-flex cursor-pointer select-none items-center gap-1 rounded-lg border border-zinc-500 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-white transition hover:border-zinc-400 hover:bg-zinc-800"
                  >
                    + Otra foto
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="relative inline-block">
                    <span className="absolute -bottom-0.5 left-0.5 rounded bg-zinc-800 px-1 text-[8px] font-semibold text-zinc-100">
                      Principal
                    </span>
                    {mainThumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainThumbSrc} alt="" className="h-14 w-14 rounded border border-rose-800/50 object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-zinc-700 text-[9px] text-zinc-600">
                        —
                      </div>
                    )}
                  </div>
                  {pendingGalleryFiles.map((pg, i) => (
                    <div key={pg.url} className="relative inline-block">
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[10px] leading-none text-white shadow hover:bg-zinc-800"
                        aria-label="Descartar foto nueva"
                        onClick={() => removePendingGalleryAt(i)}
                      >
                        ×
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pg.url} alt="" className="h-14 w-14 rounded border border-amber-700/60 object-cover" />
                    </div>
                  ))}
                  {localGalleryPaths.map((path) => {
                    const gUrl = getPublicUrlFromPath(path)
                    if (!gUrl) return null
                    return (
                      <div key={path} className="relative inline-block">
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[10px] leading-none text-white shadow hover:bg-zinc-800 hover:text-white"
                          aria-label="Quitar foto de galería (al guardar)"
                          onClick={() => removeLocalGalleryPath(path)}
                        >
                          ×
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gUrl} alt="" className="h-14 w-14 rounded border border-zinc-700 object-cover" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-2 text-xs">
              <span className="text-rose-200">{formatMoneyArs(Number(p.price))}</span>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className={getCatalogProductSaveBtnClass(hasPendingChanges)}
                  disabled={busy || !hasPendingChanges}
                  onClick={() => void saveEdits()}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className={catalogDeleteBtnClassCompact}
                  aria-label={`Eliminar producto «${p.name}»`}
                  onClick={() =>
                    onRequestDeleteProduct({
                      id: p.id,
                      name: p.name,
                      price: Number(p.price),
                    })
                  }
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
    </li>
  )
}

function ProductList({
  products,
  busy,
  updateProduct,
  onRequestDeleteProduct,
  uploadImage,
  uploadGalleryImage,
  removeGalleryPath,
  variantCatalogActions,
  requireNumericSize,
}: {
  products: ProductRow[]
  busy: boolean
  updateProduct: (id: string, patch: ProductPatch, opts?: CatalogCommitOpts) => Promise<void>
  onRequestDeleteProduct: (ctx: { id: string; name: string; price: number }) => void
  uploadImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  uploadGalleryImage: (productId: string, file: File | null, opts?: CatalogCommitOpts) => Promise<void>
  removeGalleryPath: (productId: string, storagePath: string, opts?: CatalogCommitOpts) => Promise<void>
  variantCatalogActions: VariantCatalogActions
  requireNumericSize: boolean
}) {
  return (
    <ul className="mt-4 space-y-3">
      {products.map((p) => {
        const variantKey = (p.variants ?? [])
          .map((v) => `${v.id}:${v.size_label}:${v.stock_quantity}:${v.active ? '1' : '0'}`)
          .sort()
          .join('|')
        return (
          <ProductCatalogRow
            key={`${p.id}:${p.name}:${p.price}:${p.stock_quantity}:${p.active}:${p.description ?? ''}:${p.image_path ?? ''}:${p.image_gallery.join('|')}:${variantKey}`}
            p={p}
            busy={busy}
            updateProduct={updateProduct}
            onRequestDeleteProduct={onRequestDeleteProduct}
            uploadImage={uploadImage}
            uploadGalleryImage={uploadGalleryImage}
            removeGalleryPath={removeGalleryPath}
            variantCatalogActions={variantCatalogActions}
            requireNumericSize={requireNumericSize}
          />
        )
      })}
    </ul>
  )
}

function SubcategoryForm({
  disabled,
  hint,
  onAdd,
  buttonLabel,
  placeholder,
}: {
  disabled: boolean
  hint?: string
  onAdd: (name: string) => void
  buttonLabel?: string
  placeholder?: string
}) {
  const id = useId()
  const inputId = `${id}-subcategory-name`
  const [name, setName] = useState('')
  return (
    <form
      className="flex flex-col gap-1 border-t border-zinc-800/60 pt-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(name)
        setName('')
      }}
    >
      {hint ? (
        <label htmlFor={inputId} className="w-full cursor-pointer text-[10px] text-white">
          {hint}
        </label>
      ) : (
        <label htmlFor={inputId} className="sr-only">
          Nombre del rubro
        </label>
      )}
      <input
        id={inputId}
        name="subcategoryName"
        autoComplete="off"
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        placeholder={placeholder ?? 'NOMBRE SUBCATEGORÍA'}
        value={name}
        onChange={(e) => setName(e.target.value.toLocaleUpperCase('es-AR'))}
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        {buttonLabel ?? '+ Subcategoría'}
      </button>
    </form>
  )
}

function ProductAddForm({
  disabled,
  onAdd,
  requireNumericSize = false,
}: {
  disabled: boolean
  onAdd: (f: ProductDraftFields) => Promise<boolean>
  requireNumericSize?: boolean
}) {
  const id = useId()
  const nameId = `${id}-product-name`
  const priceId = `${id}-product-price`
  const sizeId = `${id}-product-size`
  const stockId = `${id}-product-stock`
  const descId = `${id}-product-description`
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [stock, setStock] = useState('0')
  const [description, setDescription] = useState('')
  const canSubmit =
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    stock.trim().length > 0 &&
    (!requireNumericSize || size.trim().length > 0)

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded border border-dashed border-zinc-700 p-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        void (async () => {
          const ok = await onAdd({ name, price, stock, size, description })
          if (!ok) return
          setName('')
          setPrice('')
          setSize('')
          setStock('0')
          setDescription('')
        })()
      }}
    >
      <label htmlFor={nameId} className="sr-only">
        Nombre del producto
      </label>
      <input
        id={nameId}
        name="productName"
        autoComplete="off"
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        placeholder="Producto"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label htmlFor={priceId} className="sr-only">
        Precio
      </label>
      <input
        id={priceId}
        name="productPrice"
        inputMode="decimal"
        autoComplete="off"
        className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        placeholder="Precio"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      {requireNumericSize ? (
        <>
          <label htmlFor={sizeId} className="sr-only">
            Talle
          </label>
          <input
            id={sizeId}
            name="productSize"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="Talle"
            value={size}
            onChange={(e) => setSize(sanitizeNumericSizeLabel(e.target.value))}
          />
        </>
      ) : null}
      <label htmlFor={stockId} className="sr-only">
        Stock
      </label>
      <input
        id={stockId}
        name="productStock"
        inputMode="numeric"
        autoComplete="off"
        className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        placeholder="Stock"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <label htmlFor={descId} className="sr-only">
        Descripción (opcional)
      </label>
      <input
        id={descId}
        name="productDescription"
        autoComplete="off"
        className="min-w-[140px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        type="submit"
        disabled={disabled || !canSubmit}
        className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        + Producto
      </button>
    </form>
  )
}
