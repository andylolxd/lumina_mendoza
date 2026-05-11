import { LogoutButton } from '@/components/logout-button'
import { requireAdmin } from '@/lib/admin'
import Link from 'next/link'

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <Link prefetch={false} href="/admin/catalog" className="font-semibold text-rose-200">
          Lumina — Admin
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link prefetch={false} href="/admin/catalog" className="text-zinc-300 hover:text-white">
            Catálogo
          </Link>
          <Link prefetch={false} href="/admin/stock" className="text-zinc-300 hover:text-white">
            Stock
          </Link>
          <Link prefetch={false} href="/admin/equipo" className="text-zinc-300 hover:text-white">
            Equipo
          </Link>
          <Link prefetch={false} href="/" className="text-zinc-400 hover:text-zinc-200">
            Ver tienda
          </Link>
          <LogoutButton />
        </nav>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
    </div>
  )
}
