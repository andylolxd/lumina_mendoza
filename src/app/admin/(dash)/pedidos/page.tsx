import { PedidosPanel, type PedidoListRow } from '@/components/pedidos-panel'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { SharedCartItem } from '@/app/api/carts/route'

function cartTotal(items: unknown): number {
  if (!Array.isArray(items)) return 0
  let s = 0
  for (const raw of items) {
    const it = raw as Partial<SharedCartItem>
    if (typeof it.unit_price !== 'number' || typeof it.quantity !== 'number') continue
    s += it.unit_price * it.quantity
  }
  return s
}

export default async function PedidosPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: carts, error } = await supabase
    .from('shared_carts')
    .select(
      'id, items, status, created_at, accepted_at, accepted_by_email, customer_whatsapp_e164, admin_note',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-rose-100">Pedidos</h1>
        <p className="mt-2 text-sm text-red-400">No se pudieron cargar los pedidos. ¿Corriste la migración 008 en Supabase?</p>
      </div>
    )
  }

  const rows: PedidoListRow[] = (carts ?? []).map((c) => {
    const items = c.items as unknown
    const lineCount = Array.isArray(items) ? items.length : 0
    const status = c.status as PedidoListRow['status']
    const wa = (c as { customer_whatsapp_e164?: string | null }).customer_whatsapp_e164
    const noteRaw = (c as { admin_note?: string | null }).admin_note
    const adminNote =
      typeof noteRaw === 'string' && noteRaw.trim().length > 0 ? noteRaw.trim().slice(0, 500) : null
    return {
      id: c.id,
      status: status === 'accepted' || status === 'rejected' ? status : 'pending',
      created_at: c.created_at,
      accepted_at: c.accepted_at,
      accepted_by_email: c.accepted_by_email,
      customer_whatsapp_e164: typeof wa === 'string' && wa.replace(/\D/g, '').length > 0 ? wa.replace(/\D/g, '') : null,
      admin_note: adminNote,
      total: cartTotal(items),
      lineCount,
    }
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-rose-100">Pedidos</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Los clientes envían el carrito por WhatsApp con un enlace. El stock del depósito{' '}
        <strong className="text-zinc-200">solo se descuenta</strong> cuando tocás «Aceptar venta» (desde acá o desde
        la página del carrito logueada como admin). Una <strong className="text-zinc-300">nota interna</strong> para el
        equipo (envío, recordatorios) la cargás desde «Ver carrito / link cliente» con el pedido pendiente.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        En la pestaña <strong className="text-zinc-400">Historial</strong> podés{' '}
        <strong className="text-zinc-400">eliminar</strong> pedidos aceptados o rechazados para limpiar la lista: el
        enlace del carrito deja de funcionar y no se revierte el stock ya descontado.
      </p>
      <div className="mt-8">
        <PedidosPanel initialRows={rows} />
      </div>
    </div>
  )
}
