import { Storefront } from '@/components/storefront'
import { fetchCategoriesWithNested } from '@/lib/fetch-catalog'
import { createClient } from '@/lib/supabase/server'
import type { CategoryRow } from '@/types/catalog'

export default async function HomePage() {
  let categories: CategoryRow[] = []
  let isAdminSession = false
  try {
    const supabase = await createClient()
    categories = await fetchCategoriesWithNested(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.email) {
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .maybeSingle()
      isAdminSession = !!adminRow
    }
  } catch {
    /* env o red */
  }

  return <Storefront categories={categories} isAdminSession={isAdminSession} />
}
