import { NextResponse } from 'next/server'
import { getAdminEmailFromRequest } from '@/lib/assert-admin-request'
import { createServiceClient } from '@/lib/supabase/service'
import { parseSharedCartItems } from '@/lib/shared-cart-items'
import type { SharedCartItem } from '@/app/api/carts/route'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmailFromRequest()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: cartId } = await ctx.params
  if (!cartId || !/^[0-9a-f-]{36}$/i.test(cartId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const b = body as { items?: unknown; customer_whatsapp_e164?: string | null; admin_note?: string | null }
  const hasItems = b.items !== undefined
  const hasPhone = Object.prototype.hasOwnProperty.call(b, 'customer_whatsapp_e164')
  const hasNote = Object.prototype.hasOwnProperty.call(b, 'admin_note')

  if (!hasItems && !hasPhone && !hasNote) {
    return NextResponse.json(
      { error: 'Enviá items, customer_whatsapp_e164 y/o admin_note' },
      { status: 400 },
    )
  }

  let parsedItems: ReturnType<typeof parseSharedCartItems> | null = null
  if (hasItems) {
    parsedItems = parseSharedCartItems(b.items)
    if (!parsedItems.ok) {
      return NextResponse.json({ error: parsedItems.error }, { status: 400 })
    }
  }

  let phoneDigits: string | null | undefined = undefined
  if (hasPhone) {
    const raw = b.customer_whatsapp_e164
    if (raw === null || raw === '') {
      phoneDigits = null
    } else {
      const digits = String(raw).replace(/\D/g, '')
      if (digits.length < 8 || digits.length > 18) {
        return NextResponse.json({ error: 'Teléfono inválido (8–18 dígitos)' }, { status: 400 })
      }
      phoneDigits = digits
    }
  }

  let noteVal: string | null | undefined = undefined
  if (hasNote) {
    const raw = b.admin_note
    if (raw === null || raw === '') {
      noteVal = null
    } else {
      const t = String(raw).trim().slice(0, 500)
      noteVal = t.length > 0 ? t : null
    }
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
      return NextResponse.json({ error: 'Solo se puede editar un pedido pendiente' }, { status: 409 })
    }

    const updatePayload: {
      items?: SharedCartItem[]
      customer_whatsapp_e164?: string | null
      admin_note?: string | null
    } = {}
    if (parsedItems?.ok) updatePayload.items = parsedItems.items
    if (phoneDigits !== undefined) updatePayload.customer_whatsapp_e164 = phoneDigits
    if (noteVal !== undefined) updatePayload.admin_note = noteVal

    const { error } = await svc
      .from('shared_carts')
      .update(updatePayload)
      .eq('id', cartId)
      .eq('status', 'pending')

    if (error) throw error
    return NextResponse.json({
      ok: true,
      ...(parsedItems?.ok ? { items: parsedItems.items } : {}),
      ...(phoneDigits !== undefined ? { customer_whatsapp_e164: phoneDigits } : {}),
      ...(noteVal !== undefined ? { admin_note: noteVal } : {}),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
