import type { CategoryRow, ProductRow, ProductVariantRow } from '@/types/catalog'

export type StoreCatalogTotals = {
  /** Productos activos distintos en tienda. */
  productCount: number
  /** Unidades en stock (talles sumados si hay variantes). */
  unitCount: number
  /** Suma del precio de cada producto una vez (sin multiplicar stock). */
  catalogPriceSum: number
  /** Σ precio × stock (valor si se vendiera todo el stock a precio de lista). */
  stockValue: number
}

function isVariantListed(v: Pick<ProductVariantRow, 'active'>) {
  return v.active ?? true
}

function effectiveStock(p: ProductRow): number {
  const variants = p.variants ?? []
  const listed = variants.filter((v) => isVariantListed(v))
  if (listed.length > 0) {
    return listed.reduce((n, v) => n + Math.max(0, v.stock_quantity), 0)
  }
  return Math.max(0, p.stock_quantity)
}

function accumulateProduct(p: ProductRow, acc: StoreCatalogTotals) {
  const price = Number(p.price)
  if (!Number.isFinite(price) || price < 0) return
  const stock = effectiveStock(p)
  acc.productCount += 1
  acc.unitCount += stock
  acc.catalogPriceSum += price
  acc.stockValue += price * stock
}

/** Totales del catálogo visible en tienda (solo productos `active`). */
export function computeStoreCatalogTotals(categories: CategoryRow[]): StoreCatalogTotals {
  const acc: StoreCatalogTotals = {
    productCount: 0,
    unitCount: 0,
    catalogPriceSum: 0,
    stockValue: 0,
  }
  const seen = new Set<string>()

  for (const cat of categories) {
    for (const sub of cat.subcategories ?? []) {
      for (const p of sub.products ?? []) {
        if (!p.active || seen.has(p.id)) continue
        seen.add(p.id)
        accumulateProduct(p, acc)
      }
      for (const ss of sub.subsubcategorias ?? []) {
        for (const p of ss.products ?? []) {
          if (!p.active || seen.has(p.id)) continue
          seen.add(p.id)
          accumulateProduct(p, acc)
        }
      }
    }
  }

  return acc
}
