'use client'

import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

/** Cierra sesión y vuelve a la tienda (no al login de admin). */
export function StoreSessionLogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-500 bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
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
