import type { CategoryRow, SubcategoryRow } from '@/types/catalog'

export function sortByOrder<T extends { sort_order: number }>(arr: T[] | null | undefined): T[] {
  return [...(arr ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

export type CategoryView = Omit<CategoryRow, 'subcategories'> & {
  subcategories: SubcategoryRow[]
}

/** Árbol completo para edición de stock (activos e inactivos). */
export function sortCatalogStockAdminView(categories: CategoryRow[]): CategoryView[] {
  return sortByOrder(categories)
    .map((c) => ({
      ...c,
      subcategories: sortByOrder(c.subcategories ?? [])
        .map((s) => ({
          ...s,
          products: sortByOrder(s.products ?? []),
          subsubcategorias: sortByOrder(s.subsubcategorias ?? [])
            .map((ss) => ({
              ...ss,
              products: sortByOrder(ss.products ?? []),
            }))
            .filter((ss) => ss.products.length > 0),
        }))
        .filter((s) => s.products.length > 0 || s.subsubcategorias.length > 0),
    }))
    .filter((c) => c.subcategories.length > 0)
}

export function countProductsInSub(node: SubcategoryRow): number {
  const direct = node.products?.length ?? 0
  const inSs =
    node.subsubcategorias?.reduce((n, ss) => n + (ss.products?.length ?? 0), 0) ?? 0
  return direct + inSs
}
