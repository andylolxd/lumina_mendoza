import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeGallery } from '@/lib/product-images'
import type {
  CategoryRow,
  ProductRow,
  ProductVariantRow,
  SubcategoryRow,
  SubsubcategoriaRow,
} from '@/types/catalog'

const PRODUCT_SELECT = [
  'id',
  'subcategory_id',
  'subsubcategoria_id',
  'name',
  'description',
  'price',
  'stock_quantity',
  'image_path',
  'image_gallery',
  'active',
  'sort_order',
].join(', ')

function sortByOrder<T extends { sort_order: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.sort_order - b.sort_order)
}

function sortVariantsByOrder(variants: ProductVariantRow[]): ProductVariantRow[] {
  return [...variants].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.size_label.localeCompare(b.size_label, undefined, { numeric: true }),
  )
}

type SubFlat = Pick<SubcategoryRow, 'id' | 'name' | 'sort_order'> & { category_id: string }
type SubsubFlat = Pick<SubsubcategoriaRow, 'id' | 'name' | 'sort_order'> & { subcategory_id: string }

/**
 * Categorías → subcategorías → subsubcategorías + productos (consultas planas y ensamble en memoria).
 */
export async function fetchCategoriesWithNested(
  supabase: SupabaseClient,
): Promise<CategoryRow[]> {
  const [catRes, subRes, ssRes, prodRes, varRes] = await Promise.all([
    supabase.from('categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
    supabase
      .from('subcategories')
      .select('id, category_id, name, sort_order')
      .order('category_id', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('subsubcategorias')
      .select('id, subcategory_id, name, sort_order')
      .order('subcategory_id', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('products').select(PRODUCT_SELECT).order('sort_order', { ascending: true }),
    supabase
      .from('product_variants')
      .select('id, product_id, size_label, stock_quantity, active, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  if (catRes.error) {
    console.error('[fetch-catalog] categories:', catRes.error.message)
    return []
  }

  const cats = (catRes.data ?? []) as Pick<CategoryRow, 'id' | 'name' | 'sort_order'>[]
  if (cats.length === 0) return []

  if (subRes.error) {
    console.error('[fetch-catalog] subcategories:', subRes.error.message)
    return cats.map((c) => ({ ...c, subcategories: [] }))
  }

  if (ssRes.error) {
    console.error('[fetch-catalog] subsubcategorias:', ssRes.error.message)
  }

  if (prodRes.error) {
    console.error('[fetch-catalog] products:', prodRes.error.message)
  }

  if (varRes.error) {
    console.error('[fetch-catalog] product_variants:', varRes.error.message)
  }

  const variantsByProduct = new Map<string, ProductVariantRow[]>()
  for (const row of (varRes.data ?? []) as unknown as ProductVariantRow[]) {
    if (!row?.product_id) continue
    if (!variantsByProduct.has(row.product_id)) variantsByProduct.set(row.product_id, [])
    variantsByProduct.get(row.product_id)!.push({
      ...row,
      active: (row as unknown as { active?: boolean }).active ?? true,
    })
  }

  const subs = sortByOrder((subRes.data ?? []) as unknown as SubFlat[])
  const subsubs = ssRes.error
    ? []
    : sortByOrder((ssRes.data ?? []) as unknown as SubsubFlat[])
  const rawProducts = (prodRes.data ?? []) as unknown as (Omit<ProductRow, 'image_gallery'> & { image_gallery?: unknown })[]
  const products: ProductRow[] = rawProducts.map((r) => ({
    ...r,
    image_gallery: normalizeGallery(r.image_gallery),
    variants: sortVariantsByOrder(variantsByProduct.get(r.id) ?? []),
  }))

  const productsBySub = new Map<string, ProductRow[]>()
  const productsBySubsub = new Map<string, ProductRow[]>()

  for (const p of products) {
    const sid = p.subcategory_id
    if (!sid) continue
    if (p.subsubcategoria_id) {
      const ssid = String(p.subsubcategoria_id)
      if (!productsBySubsub.has(ssid)) productsBySubsub.set(ssid, [])
      productsBySubsub.get(ssid)!.push(p)
    } else {
      if (!productsBySub.has(sid)) productsBySub.set(sid, [])
      productsBySub.get(sid)!.push(p)
    }
  }

  for (const [, list] of productsBySub) sortByOrder(list)
  for (const [, list] of productsBySubsub) sortByOrder(list)

  const subsubBySubId = new Map<string, SubsubcategoriaRow[]>()
  for (const ss of subsubs) {
    const row: SubsubcategoriaRow = {
      id: ss.id,
      subcategory_id: ss.subcategory_id,
      name: ss.name,
      sort_order: ss.sort_order,
      products: productsBySubsub.get(ss.id) ?? [],
    }
    if (!subsubBySubId.has(ss.subcategory_id)) subsubBySubId.set(ss.subcategory_id, [])
    subsubBySubId.get(ss.subcategory_id)!.push(row)
  }

  const subsByCategory = new Map<string, SubcategoryRow[]>()
  for (const s of subs) {
    const sub: SubcategoryRow = {
      id: s.id,
      category_id: s.category_id,
      name: s.name,
      sort_order: s.sort_order,
      products: productsBySub.get(s.id) ?? [],
      subsubcategorias: subsubBySubId.get(s.id) ?? [],
    }
    if (!subsByCategory.has(s.category_id)) subsByCategory.set(s.category_id, [])
    subsByCategory.get(s.category_id)!.push(sub)
  }

  return cats.map((c) => ({
    ...c,
    subcategories: subsByCategory.get(c.id) ?? [],
  }))
}

export type ProductWithStorePath = {
  product: ProductRow
  /** Segmentos para `formatCatalogPath` (sub-sub `null` si el producto va directo bajo la subcategoría). */
  pathSegments: [string, string, string | null]
}

/**
 * Recorre el árbol como la tienda: categoría → subcategoría → productos directos → sub-subcategorías → productos.
 * Orden por `sort_order` en cada nivel (igual que `Storefront`); no filtra por `active` (panel stock).
 */
export function flattenProductsWithStorePaths(categories: CategoryRow[]): ProductWithStorePath[] {
  const out: ProductWithStorePath[] = []
  for (const c of sortByOrder(categories)) {
    for (const s of sortByOrder(c.subcategories ?? [])) {
      for (const p of sortByOrder(s.products)) {
        out.push({ product: p, pathSegments: [c.name, s.name, null] })
      }
      for (const ss of sortByOrder(s.subsubcategorias)) {
        for (const p of sortByOrder(ss.products)) {
          out.push({ product: p, pathSegments: [c.name, s.name, ss.name] })
        }
      }
    }
  }
  return out
}
