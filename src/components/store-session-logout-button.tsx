'use client'

import { createClient } from '@/lib/supabase/browser'
import { headerNavPillRose } from '@/lib/store-header-nav'
import { useRouter } from 'next/navigation'

/** Cierra sesión y vuelve a la tienda (no al login de admin). */
export function StoreSessionLogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className={headerNavPillRose}
      onClick={async () => {
        const sb = createClient()
        await sb.auth.signOut()
        router.refresh()
        router.push('/')
      }}
    >
      Salir
    </button>
  )
}
