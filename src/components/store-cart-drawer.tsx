'use client'

import { useMemo, useState } from 'react'
import { useCart, type CartLine } from '@/context/cart-context'
import { formatMoneyArs, upperCategoryLabel } from '@/lib/format'
import { appBaseUrl, getPublicUrlFromPath } from '@/lib/publicUrl'
import type { SharedCartItem } from '@/app/api/carts/route'

type StoreCartDrawerProps = {
  open: boolean
  onClose: () => void
  /** Título del panel (ej. admin puede usar el mismo texto). */
  title?: string
}

export function StoreCartDrawer({ open, onClose, title = 'Tu carrito' }: StoreCartDrawerProps) {
  const { lines, removeLine, setQty, subtotal, clear } = useCart()
  const [sending, setSending] = useState(false)

  const cartLineGroups = useMemo(() => {
    const map = new Map<
      string,
      { categoryId: string; categoryName: string; categorySortOrder: number; lines: CartLine[] }
    >()
    for (const l of lines) {
      const key = l.categoryId
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          categoryId: l.categoryId,
          categoryName: l.categoryName,
          categorySortOrder: l.categorySortOrder,
          lines: [l],
        })
      } else {
        cur.lines.push(l)
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        a.categorySortOrder - b.categorySortOrder ||
        a.categoryName.localeCompare(b.categoryName, 'es'),
    )
  }, [lines])

  async function handleComprar() {
    if (lines.length === 0) return
    setSending(true)
    try {
      const items: SharedCartItem[] = lines.map((l) => ({
        product_id: l.productId,
        name: l.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
        ...(l.variantId
          ? { variant_id: l.variantId, variant_label: l.variantLabel ?? undefined }
          : {}),
      }))
      const res = await fetch('/api/carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const js = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !js.id) throw new Error(js.error ?? 'Error')

      const base = appBaseUrl()
      const cartUrl = `${base}/c/${js.id}`
      const detail = lines
        .map((l) => {
          const t = l.unitPrice * l.quantity
          return `• ${l.name} x${l.quantity} — ${formatMoneyArs(t)} (${formatMoneyArs(l.unitPrice)} c/u)`
        })
        .join('\n')
      const msg = [
        '¡Hola! Quiero comprar en *Lumina Mendoza*:',
        '',
        detail,
        '',
        `*Total:* ${formatMoneyArs(subtotal)}`,
        '',
        `Ver mi carrito: ${cartUrl}`,
        '',
        '_El stock del depósito lo confirma el local al aceptar el pedido._',
      ].join('\n')

      const phone = process.env.NEXT_PUBLIC_WHATSAPP_E164 ?? ''
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error(e)
      alert('No se pudo preparar WhatsApp. Revisá la configuración del sitio.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <button
        type="button"
        className="min-h-0 min-w-0 flex-1 cursor-default border-0 bg-transparent p-0"
        aria-label="Cerrar carrito"
        onMouseDown={() => onClose()}
      />
      <div className="flex h-full w-full max-w-md shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <p className="text-sm text-zinc-500">Todavía no agregaste productos.</p>
          ) : (
            <div className="space-y-6">
              {cartLineGroups.map((group) => (
                <section key={group.categoryId} aria-label={group.categoryName}>
                  <h3 className="mb-2 border-b border-zinc-800 pb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300/90">
                    {upperCategoryLabel(group.categoryName)}
                  </h3>
                  <ul className="space-y-4">
                    {group.lines.map((l) => {
                      const thumb = l.imagePath ? getPublicUrlFromPath(l.imagePath) : null
                      return (
                        <li
                          key={`${l.productId}-${l.variantId ?? 'base'}`}
                          className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3"
                        >
                          <div className="flex gap-3">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                className="h-16 w-16 shrink-0 rounded-lg border border-zinc-700/80 object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[9px] text-zinc-600">
                                sin foto
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2">
                                <span className="text-sm font-medium leading-snug">{l.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeLine(l.productId, l.variantId)}
                                  className="shrink-0 text-xs text-rose-400 hover:underline"
                                >
                                  Quitar
                                </button>
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded border border-zinc-700"
                                  onClick={() => setQty(l.productId, l.variantId, l.quantity - 1)}
                                >
                                  −
                                </button>
                                <span className="w-8 text-center">{l.quantity}</span>
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded border border-zinc-700"
                                  onClick={() => setQty(l.productId, l.variantId, l.quantity + 1)}
                                >
                                  +
                                </button>
                                <span className="ml-auto text-rose-200">
                                  {formatMoneyArs(l.unitPrice * l.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-zinc-800 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-zinc-400">Subtotal</span>
            <span className="font-semibold text-rose-100">{formatMoneyArs(subtotal)}</span>
          </div>
          <p className="mb-3 text-[11px] leading-snug text-zinc-500">
            Podés pedir más cantidad de la que figura en depósito: el descuento de stock lo hace el local cuando confirma
            el pago.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => clear()}
              className="flex-1 rounded-lg border border-zinc-600 py-2.5 text-sm"
            >
              Vaciar
            </button>
            <button
              type="button"
              disabled={lines.length === 0 || sending}
              onClick={() => void handleComprar()}
              className="flex-[2] rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40"
            >
              {sending ? '…' : 'Comprar por WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
