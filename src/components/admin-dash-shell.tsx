'use client'

import { StoreCartDrawer } from '@/components/store-cart-drawer'
import { LogoutButton } from '@/components/logout-button'
import { headerNavPillMuted, headerNavPillRose } from '@/lib/store-header-nav'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useCart } from '@/context/cart-context'

function normalizePathname(p: string) {
  const t = p.replace(/\/$/, '')
  return t === '' ? '/' : t
}

/** Ruta actual pertenece a la sección del admin (misma ruta o subruta). */
function isAdminSectionActive(pathname: string, sectionHref: string) {
  const cur = normalizePathname(pathname)
  const base = normalizePathname(sectionHref)
  if (cur === base) return true
  return cur.startsWith(`${base}/`)
}

export function AdminDashShell({ children }: { children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false)
  const { lines } = useCart()
  const cartCount = lines.reduce((n, l) => n + l.quantity, 0)
  const pathname = usePathname() ?? ''
  const norm = normalizePathname(pathname)
  const onCatalogRoot = norm === '/admin'

  const showCatalog = !onCatalogRoot && !isAdminSectionActive(pathname, '/admin/catalog')
  const showStock = !isAdminSectionActive(pathname, '/admin/stock')
  const showPedidos = !isAdminSectionActive(pathname, '/admin/pedidos')
  const showEquipo = !isAdminSectionActive(pathname, '/admin/equipo')

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-zinc-950 to-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-rose-900/40 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 shrink-0">
              <h1 className="text-xl font-semibold tracking-tight text-rose-100">Lumina Mendoza</h1>
              <p className="text-xs text-rose-300/80">Catálogo y pedidos por WhatsApp</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-[min(100%,28rem)] lg:items-end xl:max-w-none">
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-2">
                {showCatalog ? (
                  <Link prefetch={false} href="/admin/catalog" className={headerNavPillRose}>
                    Catálogo
                  </Link>
                ) : null}
                {showStock ? (
                  <Link prefetch={false} href="/admin/stock" className={headerNavPillRose}>
                    Stock
                  </Link>
                ) : null}
                {showPedidos ? (
                  <Link prefetch={false} href="/admin/pedidos" className={headerNavPillRose}>
                    Pedidos
                  </Link>
                ) : null}
                {showEquipo ? (
                  <Link prefetch={false} href="/admin/equipo" className={headerNavPillRose}>
                    Equipo
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-2">
                <Link prefetch={false} href="/" className={headerNavPillMuted}>
                  Ver tienda
                </Link>
                <LogoutButton />
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="relative rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-900/40 hover:bg-rose-500"
                >
                  Carrito
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-rose-700">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <StoreCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} title="Tu carrito" />
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  )
}
