import { formatMoneyArs } from '@/lib/format'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import type { SharedCartItem } from '@/app/api/carts/route'

export default async function SharedCartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let items: SharedCartItem[] = []
  let err = false
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('shared_carts')
      .select('items, expires_at')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) err = true
    else if (Array.isArray(data.items)) items = data.items as SharedCartItem[]
  } catch {
    err = true
  }

  const total = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-center text-sm text-rose-300">
          Lumina Mendoza — carrito compartido
        </p>
        {err ? (
          <p className="text-center text-zinc-400">No se encontró este carrito.</p>
        ) : (
          <>
            <ul className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              {items.map((it, i) => (
                <li key={`${it.product_id}-${i}`} className="text-sm">
                  <span className="font-medium">{it.name}</span>
                  <span className="text-zinc-400"> × {it.quantity}</span>
                  <div className="text-rose-200">
                    {formatMoneyArs(Number(it.unit_price) * it.quantity)}{' '}
                    <span className="text-xs text-zinc-500">
                      ({formatMoneyArs(Number(it.unit_price))} c/u)
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex justify-between border-t border-zinc-800 pt-4 text-base font-semibold">
              Total <span>{formatMoneyArs(total)}</span>
            </p>
          </>
        )}
        <Link
          href="/"
          className="mt-8 block text-center text-sm text-rose-400 underline hover:text-rose-300"
        >
          Volver al catálogo
        </Link>
      </div>
    </div>
  )
}
