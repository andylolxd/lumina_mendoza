import type { SharedCartItem } from '@/app/api/carts/route'
import type { CartLine } from '@/context/cart-context'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'

/** Una línea de detalle tipo WhatsApp (como lo piden las clientas: nombre — talle x3 — $…). */
export function lineBulletForWhatsApp(
  name: string,
  unitPrice: number,
  quantity: number,
  variantLabel: string | null | undefined,
): string {
  const sub = unitPrice * quantity
  const v = typeof variantLabel === 'string' && variantLabel.trim().length > 0 ? variantLabel.trim() : ''
  const mid = v ? `${name} — ${v}` : name
  return `• ${mid} x${quantity} — ${formatMoneyArs(sub)} (${formatMoneyArs(unitPrice)} c/u)`
}

function oneBullet(it: SharedCartItem): string {
  return lineBulletForWhatsApp(it.name, it.unit_price, it.quantity, it.variant_label)
}

function itemHasCategoryMeta(it: SharedCartItem): boolean {
  return (
    (typeof it.category_id === 'string' && it.category_id.length > 0) ||
    (typeof it.category_name === 'string' && it.category_name.trim().length > 0)
  )
}

type GroupShared = { sort: number; title: string; lines: SharedCartItem[] }

/**
 * Detalle desde el carrito de la tienda (estado local): **siempre** agrupa por categoría principal
 * usando los datos de cada línea (evita depender solo del JSON guardado).
 */
export function formatWhatsAppDetailFromStoreLines(lines: CartLine[]): string {
  if (lines.length === 0) return ''

  const map = new Map<string, { sort: number; title: string; lines: CartLine[] }>()
  for (const l of lines) {
    const hasId = typeof l.categoryId === 'string' && l.categoryId.length > 0
    const nameTrim = (l.categoryName ?? '').trim()
    const key = hasId ? `id:${l.categoryId}` : nameTrim.length > 0 ? `n:${nameTrim.toLocaleLowerCase('es-AR')}` : '__sin_rubro__'
    const title = nameTrim.length > 0 ? nameTrim : 'Otros'
    const sort = Number.isFinite(l.categorySortOrder) ? l.categorySortOrder : 9999

    let g = map.get(key)
    if (!g) {
      g = { sort, title, lines: [] }
      map.set(key, g)
    }
    g.sort = Math.min(g.sort, sort)
    if (g.title === 'Otros' && title !== 'Otros') {
      g.title = title
    }
    g.lines.push(l)
  }

  const groups = [...map.values()].sort(
    (a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
  )

  return groups
    .map((g) => {
      const head = `*${upperCategoryLabel(g.title)}*`
      const body = g.lines
        .map((l) => lineBulletForWhatsApp(l.name, l.unitPrice, l.quantity, l.variantLabel))
        .join('\n')
      return `${head}\n${body}`
    })
    .join('\n\n')
}

/**
 * Detalle desde ítems guardados en `shared_carts`: por categoría si vienen `category_*`;
 * si ningún ítem trae rubro (carritos viejos), lista plana.
 */
export function formatSharedCartWhatsAppDetail(items: SharedCartItem[]): string {
  if (items.length === 0) return ''

  const anyMeta = items.some(itemHasCategoryMeta)
  if (!anyMeta) {
    return items.map(oneBullet).join('\n')
  }

  const map = new Map<string, GroupShared>()
  for (const it of items) {
    const key =
      typeof it.category_id === 'string' && it.category_id.length > 0
        ? `id:${it.category_id}`
        : typeof it.category_name === 'string' && it.category_name.trim().length > 0
          ? `n:${it.category_name.trim().toLocaleLowerCase('es-AR')}`
          : '__sin_rubro__'

    const title =
      typeof it.category_name === 'string' && it.category_name.trim().length > 0
        ? it.category_name.trim()
        : 'Otros'

    const sort =
      typeof it.category_sort_order === 'number' && Number.isFinite(it.category_sort_order)
        ? it.category_sort_order
        : 9999

    let g = map.get(key)
    if (!g) {
      g = { sort, title, lines: [] }
      map.set(key, g)
    }
    g.sort = Math.min(g.sort, sort)
    if (g.title === 'Otros' && title !== 'Otros') {
      g.title = title
    }
    g.lines.push(it)
  }

  const groups = [...map.values()].sort(
    (a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
  )

  return groups
    .map((g) => {
      const head = `*${upperCategoryLabel(g.title)}*`
      const body = g.lines.map(oneBullet).join('\n')
      return `${head}\n${body}`
    })
    .join('\n\n')
}
