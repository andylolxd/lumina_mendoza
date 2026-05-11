'use client'

import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs hover:bg-zinc-800"
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
