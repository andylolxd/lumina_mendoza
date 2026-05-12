import type { SharedCartItem } from '@/app/api/carts/route'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'

function lineLabel(it: SharedCartItem): string {
  const v = it.variant_label?.trim()
  return v ? `${it.name} (${v})` : it.name
}

function oneBullet(it: SharedCartItem): string {
  const sub = it.unit_price * it.quantity
  return `• ${lineLabel(it)} ×${it.quantity} — ${formatMoneyArs(sub)} (${formatMoneyArs(it.unit_price)} c/u)`
}

function itemHasCategoryMeta(it: SharedCartItem): boolean {
  return (
    (typeof it.category_id === 'string' && it.category_id.length > 0) ||
    (typeof it.category_name === 'string' && it.category_name.trim().length > 0)
  )
}

type Group = { sort: number; title: string; lines: SharedCartItem[] }

/**
 * Detalle del carrito para mensajes WhatsApp: por categoría de tienda (ANILLOS, CADENAS, …)
 * si los ítems traen `category_*`; si no, lista plana (carritos viejos).
 */
export function formatSharedCartWhatsAppDetail(items: SharedCartItem[]): string {
  if (items.length === 0) return ''

  const anyMeta = items.some(itemHasCategoryMeta)
  if (!anyMeta) {
    return items.map(oneBullet).join('\n')
  }

  const map = new Map<string, Group>()
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
