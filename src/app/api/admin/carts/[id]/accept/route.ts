import { NextResponse } from 'next/server'
import { getAdminEmailFromRequest } from '@/lib/assert-admin-request'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmailFromRequest()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: cartId } = await ctx.params
  if (!cartId || !/^[0-9a-f-]{36}$/i.test(cartId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const svc = createServiceClient()
    const { data, error } = await svc.rpc('accept_shared_cart', {
      p_cart_id: cartId,
      p_admin_email: adminEmail,
    })
    if (error) throw error

    const result = data as { ok?: boolean; error?: string; status?: string } | null
    if (!result?.ok) {
      const err = result?.error ?? 'unknown'
      if (err === 'not_found') return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 })
      if (err === 'already_processed') {
        return NextResponse.json(
          { error: 'Este pedido ya fue procesado', status: result?.status },
          { status: 409 },
        )
      }
      if (err === 'insufficient_stock') {
        return NextResponse.json(
          { error: 'No hay stock suficiente en depósito para uno o más ítems. Ajustá stock o el pedido.' },
          { status: 400 },
        )
      }
      if (err === 'variant_required') {
        return NextResponse.json(
          { error: 'Ítem sin talle en un producto con variantes (carrito antiguo o datos incompletos).' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: 'No se pudo aceptar el pedido' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
