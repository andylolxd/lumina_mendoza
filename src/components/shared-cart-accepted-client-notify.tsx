'use client'

import type { SharedCartItem } from '@/app/api/carts/route'
import { formatMoneyArs } from '@/lib/format'
import { formatSharedCartWhatsAppDetail } from '@/lib/whatsapp-cart-detail'
import { appBaseUrl } from '@/lib/publicUrl'
import { combineWhatsAppParts, splitStoredWhatsApp } from '@/lib/whatsapp-cart-parts'
import { useEffect, useMemo, useState } from 'react'

export function SharedCartAcceptedClientNotify({
  cartId,
  items,
  initialCustomerWhatsappE164,
}: {
  cartId: string
  items: SharedCartItem[]
  initialCustomerWhatsappE164: string | null
}) {
  const initialSplit = useMemo(
    () => splitStoredWhatsApp(initialCustomerWhatsappE164),
    [initialCustomerWhatsappE164],
  )
  const [country, setCountry] = useState(initialSplit.country)
  const [local, setLocal] = useState(initialSplit.local)

  useEffect(() => {
    const s = splitStoredWhatsApp(initialCustomerWhatsappE164)
    setCountry(s.country)
    setLocal(s.local)
  }, [initialCustomerWhatsappE164])

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0),
    [items],
  )

  function buildAcceptedMessage(): string {
    const base = appBaseUrl().replace(/\/$/, '')
    const link = `${base}/c/${cartId}`
    const detail = formatSharedCartWhatsAppDetail(items)
    return [
      '¡Hola! *Lumina Mendoza* te confirma que *aceptamos tu pedido* y ya está registrado.',
      '',
      detail,
      '',
      `*Total:* ${formatMoneyArs(subtotal)}`,
      '',
      `Podés revisar el detalle y las fotos acá:`,
      link,
      '',
      '_Gracias por tu compra._',
    ].join('\n')
  }

  function openWhatsAppAccepted() {
    const full = combineWhatsAppParts(country, local)
    if (full.replace(/\D/g, '').length < 8) {
      alert('Completá el código de país y el número del cliente (mínimo 8 dígitos en total).')
      return
    }
    const digits = full.replace(/\D/g, '')
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(buildAcceptedMessage())}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <div className="mt-8 rounded-xl border border-green-800/50 bg-green-950/20 p-4">
      <h3 className="text-sm font-semibold text-green-100">Avisar al cliente por WhatsApp</h3>
      <p className="mt-1 text-xs text-green-200/80">
        Enviá la confirmación de venta aceptada con el detalle y el enlace al pedido.
      </p>
      <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-28">
          <label htmlFor="wa-acc-country" className="block text-xs font-medium text-zinc-400">
            Código país
          </label>
          <input
            id="wa-acc-country"
            name="waAcceptedCountry"
            type="text"
            inputMode="numeric"
            autoComplete="tel-country-code"
            placeholder="549"
            value={country}
            onChange={(e) => setCountry(e.target.value.replace(/\D/g, ''))}
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-2 text-center text-sm tabular-nums text-zinc-100"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="wa-acc-local" className="block text-xs font-medium text-zinc-400">
            Número (sin código país)
          </label>
          <input
            id="wa-acc-local"
            name="waAcceptedLocal"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="2615000000"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={openWhatsAppAccepted}
        className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
      >
        Abrir WhatsApp — pedido aceptado
      </button>
    </div>
  )
}
