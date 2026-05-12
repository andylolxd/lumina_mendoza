import { createServiceClient } from '@/lib/supabase/service'
import { getAdminEmailIfSession } from '@/lib/admin-optional'
import Link from 'next/link'
import { SharedCartAcceptedClientNotify } from '@/components/shared-cart-accepted-client-notify'
import { SharedCartAdminBar } from '@/components/shared-cart-admin-bar'
import { SharedCartView, type SharedCartProductVisual } from '@/components/shared-cart-view'
import type { SharedCartItem } from '@/app/api/carts/route'
import { collectProductImagePaths } from '@/lib/product-images'
import {
  storeTiendaBackgroundLayerClassName,
  storeTiendaFullBackgroundStyle,
} from '@/lib/store-theme'

type CartStatus = 'pending' | 'accepted' | 'rejected'

function normalizeStatus(s: string | null | undefined): CartStatus {
  if (s === 'accepted' || s === 'rejected') return s
  return 'pending'
}

export default async function SharedCartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let items: SharedCartItem[] = []
  let err = false
  let status: CartStatus = 'pending'
  let acceptedAt: string | null = null
  let acceptedBy: string | null = null
  let customerWhatsappE164: string | null = null
  let adminNote: string | null = null

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('shared_carts')
      .select(
        'items, expires_at, status, accepted_at, accepted_by_email, customer_whatsapp_e164, admin_note',
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !data) err = true
    else {
      if (Array.isArray(data.items)) items = data.items as SharedCartItem[]
      status = normalizeStatus((data as { status?: string }).status)
      acceptedAt = (data as { accepted_at?: string | null }).accepted_at ?? null
      acceptedBy = (data as { accepted_by_email?: string | null }).accepted_by_email ?? null
      customerWhatsappE164 =
        (data as { customer_whatsapp_e164?: string | null }).customer_whatsapp_e164?.replace(/\D/g, '') ?? null
      if (customerWhatsappE164 === '') customerWhatsappE164 = null
      const rawNote = (data as { admin_note?: string | null }).admin_note
      adminNote =
        typeof rawNote === 'string' && rawNote.trim().length > 0 ? rawNote.trim().slice(0, 500) : null
    }
  } catch {
    err = true
  }

  const adminEmail = await getAdminEmailIfSession()
  const isAdmin = adminEmail != null

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
  let productVisuals: SharedCartProductVisual[] = []
  if (!err && productIds.length > 0) {
    try {
      const sb = createServiceClient()
      const { data: prows } = await sb
        .from('products')
        .select('id,name,description,price,image_path,image_gallery')
        .in('id', productIds)
      for (const row of prows ?? []) {
        productVisuals.push({
          product_id: row.id,
          name: row.name,
          description: row.description,
          price: Number(row.price),
          imagePaths: collectProductImagePaths({
            image_path: row.image_path,
            image_gallery: row.image_gallery,
          }),
        })
      }
    } catch {
      productVisuals = []
    }
  }

  return (
    <div className="relative isolate min-h-screen text-zinc-100">
      <div
        className={storeTiendaBackgroundLayerClassName}
        style={storeTiendaFullBackgroundStyle}
        aria-hidden
      />
      <div className="relative z-10 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-center text-sm text-white">
            Lumina Mendoza — carrito compartido
          </p>
          {err ? (
            <p className="text-center text-zinc-400">No se encontró este carrito.</p>
          ) : (
            <>
              <div
                className={`mb-6 rounded-lg border px-3 py-2 text-center text-sm ${
                  status === 'pending'
                    ? 'border-amber-800/50 bg-amber-950/25 text-amber-100'
                    : status === 'accepted'
                      ? 'border-green-800/50 bg-green-950/20 text-green-100'
                      : 'border-zinc-700 bg-zinc-900/50 text-zinc-400'
                }`}
              >
                {status === 'pending'
                  ? 'Pedido pendiente: el stock se descuenta cuando el local acepta la venta.'
                  : status === 'accepted'
                    ? `Venta aceptada${acceptedAt ? ` el ${new Date(acceptedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}${acceptedBy ? ` · ${acceptedBy}` : ''}.`
                    : 'Este pedido fue rechazado o cancelado.'}
              </div>

              <SharedCartView
                cartId={id}
                initialItems={items}
                productVisuals={productVisuals}
                status={status}
                isAdmin={isAdmin}
                initialCustomerWhatsappE164={customerWhatsappE164}
                initialAdminNote={adminNote}
              />

              {isAdmin && status === 'accepted' ? (
                <SharedCartAcceptedClientNotify
                  cartId={id}
                  items={items}
                  initialCustomerWhatsappE164={customerWhatsappE164}
                />
              ) : null}

              {isAdmin && status === 'pending' ? <SharedCartAdminBar cartId={id} status={status} /> : null}
              {isAdmin ? (
                <p className="mt-6 text-center">
                  <Link
                    href="/admin/pedidos"
                    className="text-sm text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
                  >
                    Ir a Pedidos (panel)
                  </Link>
                </p>
              ) : null}
            </>
          )}
          <Link
            href="/"
            className="mt-8 block text-center text-sm text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    </div>
  )
}
