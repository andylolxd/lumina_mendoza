import { StockPageContent } from '@/components/stock-page-content'
import type { MozoProduct } from '@/components/stock-mozo'
import { formatCatalogPath } from '@/lib/catalog-tree'
import { requireAdmin } from '@/lib/admin'

type SaleLine = {
  quantity: number
  unit_price: number
  products: { name: string } | null
}

type Sale = {
  id: string
  sold_at: string
  in_person_sale_lines: SaleLine[] | null
}

export default async function StockPage() {
  const { supabase } = await requireAdmin()

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const salesQuery = supabase
    .from('in_person_sales')
    .select(
      `
      id,
      sold_at,
      in_person_sale_lines (
        quantity,
        unit_price,
        products ( name )
      )
    `,
    )
    .gte('sold_at', start.toISOString())
    .order('sold_at', { ascending: false })

  const subsubsQuery = supabase.from('subsubcategorias').select('id, name')

  const productsQuery = supabase
    .from('products')
    .select(
      `
      id,
      name,
      price,
      stock_quantity,
      image_path,
      subsubcategoria_id,
      subcategories (
        id,
        name,
        categories ( name )
      )
    `,
    )
    .order('name')

  const [{ data: rawSales }, { data: rawSubsubs }, { data: prows }] = await Promise.all([
    salesQuery,
    subsubsQuery,
    productsQuery,
  ])

  const sales = (rawSales ?? []) as unknown as Sale[]

  const subsubNameById = new Map(
    ((rawSubsubs ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
  )

  const products: MozoProduct[] = (prows ?? []).map((r: unknown) => {
    const row = r as {
      id: string
      name: string
      price: number
      stock_quantity: number
      image_path: string | null
      subsubcategoria_id?: string | null
      subcategories:
        | { name: string; categories: { name: string } | null }
        | { name: string; categories: { name: string } | null }[]
        | null
    }
    const sub = Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories
    const catName = sub?.categories?.name ?? ''
    const subName = sub?.name ?? ''
    const ssName = row.subsubcategoria_id
      ? subsubNameById.get(String(row.subsubcategoria_id)) ?? ''
      : ''
    const pathLabel = formatCatalogPath([catName, subName, ssName || null])
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      stock_quantity: row.stock_quantity,
      image_path: row.image_path,
      pathLabel: pathLabel || '—',
    }
  })

  return <StockPageContent products={products} sales={sales} />
}
