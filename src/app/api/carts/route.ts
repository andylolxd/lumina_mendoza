import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SharedCartItem = {
  product_id: string
  name: string
  unit_price: number
  quantity: number
  /** Si el ítem es una variante (talle de anillo, etc.). */
  variant_id?: string | null
  variant_label?: string | null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { items?: SharedCartItem[] }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items vacío' }, { status: 400 })
    }
    for (const it of body.items) {
      if (
        typeof it.product_id !== 'string' ||
        typeof it.name !== 'string' ||
        typeof it.unit_price !== 'number' ||
        typeof it.quantity !== 'number' ||
        it.quantity < 1
      ) {
        return NextResponse.json({ error: 'item inválido' }, { status: 400 })
      }
      if (it.variant_id != null && typeof it.variant_id !== 'string') {
        return NextResponse.json({ error: 'item inválido (variant_id)' }, { status: 400 })
      }
      if (it.variant_label != null && typeof it.variant_label !== 'string') {
        return NextResponse.json({ error: 'item inválido (variant_label)' }, { status: 400 })
      }
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('shared_carts')
      .insert({ items: body.items })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: 'No se pudo guardar el carrito' },
      { status: 500 },
    )
  }
}
