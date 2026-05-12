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
      const { data: ok } = await supabase.rpc('current_user_is_admin')
      isAdminSession = ok === true
    }
  } catch {
    /* env o red */
  }

  return <Storefront categories={categories} isAdminSession={isAdminSession} />
}
