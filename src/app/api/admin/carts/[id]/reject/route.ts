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
    const { data: row, error: fetchErr } = await svc
      .from('shared_carts')
      .select('id, status')
      .eq('id', cartId)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!row) return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 })
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'Este pedido ya no está pendiente' }, { status: 409 })
    }

    const { error } = await svc
      .from('shared_carts')
      .update({ status: 'rejected', accepted_at: null, accepted_by_email: null })
      .eq('id', cartId)
      .eq('status', 'pending')

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
