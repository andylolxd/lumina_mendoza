import { CatalogEditor } from '@/components/catalog-editor'
import { requireAdmin } from '@/lib/admin'
import { fetchCategoriesWithNested } from '@/lib/fetch-catalog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CatalogPage() {
  const { supabase } = await requireAdmin()
  const initial = await fetchCategoriesWithNested(supabase)

  return <CatalogEditor initial={initial} />
}
