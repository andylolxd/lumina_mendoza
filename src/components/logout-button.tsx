'use client'

import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rounded-lg border border-rose-900/45 bg-rose-950/25 px-3 py-2 text-sm font-medium text-rose-100 shadow-sm shadow-black/10 transition hover:border-rose-700/50 hover:bg-rose-900/40"
      onClick={async () => {
        const sb = createClient()
        await sb.auth.signOut()
        router.push('/admin/login')
        router.refresh()
      }}
    >
      Salir
    </button>
  )
}
