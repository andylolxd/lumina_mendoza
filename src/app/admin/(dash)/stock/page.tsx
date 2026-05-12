import { StockPageContent } from '@/components/stock-page-content'
import { requireAdmin } from '@/lib/admin'
import { fetchCategoriesWithNested } from '@/lib/fetch-catalog'

export default async function StockPage() {
  const { supabase } = await requireAdmin()
  const categories = await fetchCategoriesWithNested(supabase)
  return <StockPageContent categories={categories} />
}
