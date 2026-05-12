import type { SharedCartItem } from '@/app/api/carts/route'

export function parseSharedCartItems(items: unknown): { ok: true; items: SharedCartItem[] } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'items vacío' }
  }
  const out: SharedCartItem[] = []
  for (const raw of items) {
    if (raw == null || typeof raw !== 'object') return { ok: false, error: 'item inválido' }
    const it = raw as Record<string, unknown>
    if (
      typeof it.product_id !== 'string' ||
      typeof it.name !== 'string' ||
      typeof it.unit_price !== 'number' ||
      typeof it.quantity !== 'number' ||
      it.quantity < 1
    ) {
      return { ok: false, error: 'item inválido' }
    }
    if (it.variant_id != null && typeof it.variant_id !== 'string') {
      return { ok: false, error: 'item inválido (variant_id)' }
    }
    if (it.variant_label != null && typeof it.variant_label !== 'string') {
      return { ok: false, error: 'item inválido (variant_label)' }
    }
    if (it.category_id != null && typeof it.category_id !== 'string') {
      return { ok: false, error: 'item inválido (category_id)' }
    }
    if (it.category_name != null && typeof it.category_name !== 'string') {
      return { ok: false, error: 'item inválido (category_name)' }
    }
    if (
      it.category_sort_order != null &&
      (typeof it.category_sort_order !== 'number' || !Number.isFinite(it.category_sort_order))
    ) {
      return { ok: false, error: 'item inválido (category_sort_order)' }
    }
    const line: SharedCartItem = {
      product_id: it.product_id,
      name: it.name,
      unit_price: it.unit_price,
      quantity: Math.floor(it.quantity),
    }
    if (line.quantity < 1) return { ok: false, error: 'cantidad inválida' }
    if (it.variant_id != null) line.variant_id = it.variant_id as string
    if (it.variant_label != null) line.variant_label = it.variant_label as string
    if (it.category_id != null && (it.category_id as string).length > 0) {
      line.category_id = it.category_id as string
    }
    if (it.category_name != null && (it.category_name as string).trim().length > 0) {
      line.category_name = (it.category_name as string).trim()
    }
    if (it.category_sort_order != null) {
      line.category_sort_order = Math.floor(it.category_sort_order as number)
    }
    out.push(line)
  }
  return { ok: true, items: out }
}
