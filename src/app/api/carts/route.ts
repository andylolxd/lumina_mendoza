import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseSharedCartItems } from '@/lib/shared-cart-items'

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
    const body = (await req.json()) as { items?: unknown }
    const parsed = parseSharedCartItems(body.items)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('shared_carts')
      .insert({ items: parsed.items })
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
