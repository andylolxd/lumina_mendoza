'use client'

import { StoreCartDrawer } from '@/components/store-cart-drawer'
import { LogoutButton } from '@/components/logout-button'
import { headerNavPillMuted, headerNavPillRose } from '@/lib/store-header-nav'
import { STORE_HEADER_BG_SRC, storeInfiniteBgLayerStyle } from '@/lib/store-theme'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useCart } from '@/context/cart-context'

const adminTitleFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
})

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
    <div className="flex min-h-screen flex-col text-zinc-100">
      <header className="sticky top-0 z-40 overflow-hidden border-b border-zinc-800/50">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-left-top bg-no-repeat"
          style={{ backgroundImage: `url(${STORE_HEADER_BG_SRC})` }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 shrink-0">
              <h1
                className={`m-0 bg-[linear-gradient(118deg,#fff5f0_0%,#f0d4cc_22%,#d4a088_52%,#c08081_78%,#a86f6f_100%)] bg-clip-text text-xl font-semibold leading-tight tracking-[0.03em] text-transparent sm:text-[1.35rem] ${adminTitleFont.className}`}
              >
                Lumina Mendoza
              </h1>
              <p className="mt-1 font-sans text-[0.6875rem] font-medium leading-snug tracking-wide text-amber-200/88 sm:text-xs">
                Catálogo y pedidos por WhatsApp
              </p>
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
                  className={`relative ${headerNavPillRose}`}
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
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={storeInfiniteBgLayerStyle}
          aria-hidden
        />
        <div className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-3 sm:pt-4">{children}</div>
      </div>
    </div>
  )
}
