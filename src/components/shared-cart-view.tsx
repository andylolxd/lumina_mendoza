'use client'

import type { SharedCartItem } from '@/app/api/carts/route'
import { formatMoneyArs } from '@/lib/format'
import { appBaseUrl, getPublicUrlFromPath } from '@/lib/publicUrl'
import { ProductImageLightbox, type ProductLightboxPayload } from '@/components/product-image-lightbox'
import { combineWhatsAppParts, splitStoredWhatsApp } from '@/lib/whatsapp-cart-parts'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const MAX_LINE_QTY = 999

export type SharedCartProductVisual = {
  product_id: string
  name: string
  description: string | null
  price: number
  imagePaths: string[]
}

type CartStatus = 'pending' | 'accepted' | 'rejected'

export function SharedCartView({
  cartId,
  initialItems,
  productVisuals,
  status,
  isAdmin,
  initialCustomerWhatsappE164,
  initialAdminNote = null,
}: {
  cartId: string
  initialItems: SharedCartItem[]
  productVisuals: SharedCartProductVisual[]
  status: CartStatus
  isAdmin: boolean
  initialCustomerWhatsappE164: string | null
  /** Nota interna (panel Pedidos); solo editable si el pedido sigue pendiente. */
  initialAdminNote?: string | null
}) {
  const router = useRouter()
  const [items, setItems] = useState<SharedCartItem[]>(initialItems)
  const [lightbox, setLightbox] = useState<ProductLightboxPayload | null>(null)
  const initialSplit = useMemo(
    () => splitStoredWhatsApp(initialCustomerWhatsappE164),
    [initialCustomerWhatsappE164],
  )
  const [waCountry, setWaCountry] = useState(initialSplit.country)
  const [waLocal, setWaLocal] = useState(initialSplit.local)
  const [saveBusy, setSaveBusy] = useState(false)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [noteBusy, setNoteBusy] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState(initialAdminNote ?? '')

  const visualByProduct = useMemo(() => {
    const m = new Map<string, SharedCartProductVisual>()
    for (const v of productVisuals) m.set(v.product_id, v)
    return m
  }, [productVisuals])

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    const s = splitStoredWhatsApp(initialCustomerWhatsappE164)
    setWaCountry(s.country)
    setWaLocal(s.local)
  }, [initialCustomerWhatsappE164])

  useEffect(() => {
    setAdminNote(initialAdminNote ?? '')
  }, [initialAdminNote])

  const canEdit = isAdmin && status === 'pending'

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0),
    [items],
  )

  function combinedPhoneDigits(): string {
    return combineWhatsAppParts(waCountry, waLocal).replace(/\D/g, '')
  }

  /** `null` = borrar en servidor; `undefined` = número incompleto (no usar); string = guardar */
  function phonePayloadForApi(): string | null | undefined {
    const localDigits = waLocal.replace(/\D/g, '')
    if (localDigits.length === 0) return null
    const d = combinedPhoneDigits()
    if (d.length < 8 || d.length > 18) return undefined
    return d
  }

  function setQty(index: number, q: number) {
    const n = Math.min(MAX_LINE_QTY, Math.max(1, Math.floor(q)))
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: n } : it)))
  }

  function removeLine(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (items.length === 0) {
      setSaveErr('Agregá al menos un ítem (no se puede guardar vacío).')
      return
    }
    setSaveBusy(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/admin/carts/${cartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ items }),
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setSaveErr(js.error ?? 'No se pudo guardar')
        return
      }
      router.refresh()
    } catch {
      setSaveErr('Error de red')
    } finally {
      setSaveBusy(false)
    }
  }

  async function saveAdminNote(next: string | null) {
    setNoteBusy(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/admin/carts/${cartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ admin_note: next }),
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setSaveErr(js.error ?? 'No se pudo guardar la nota')
        return
      }
      router.refresh()
    } catch {
      setSaveErr('Error de red')
    } finally {
      setNoteBusy(false)
    }
  }

  async function savePhoneOnly() {
    setPhoneBusy(true)
    setSaveErr(null)
    try {
      const phone = phonePayloadForApi()
      if (phone === undefined) {
        setSaveErr('El número debe tener al menos 8 dígitos en total (código + número), o vaciá el segundo recuadro para borrar.')
        setPhoneBusy(false)
        return
      }
      const res = await fetch(`/api/admin/carts/${cartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          customer_whatsapp_e164: phone,
        }),
      })
      const js = (await res.json()) as { error?: string }
      if (!res.ok) {
        setSaveErr(js.error ?? 'No se pudo guardar el número')
        return
      }
      router.refresh()
    } catch {
      setSaveErr('Error de red')
    } finally {
      setPhoneBusy(false)
    }
  }

  function buildClientMessage(): string {
    const base = appBaseUrl().replace(/\/$/, '')
    const link = `${base}/c/${cartId}`
    const detail = items
      .map((l) => {
        const t = l.unit_price * l.quantity
        return `• ${l.name} ×${l.quantity} — ${formatMoneyArs(t)} (${formatMoneyArs(l.unit_price)} c/u)`
      })
      .join('\n')
    return [
      '¡Hola! Te pasamos el detalle del pedido (*Lumina Mendoza*):',
      '',
      detail,
      '',
      `*Total:* ${formatMoneyArs(subtotal)}`,
      '',
      `Podés ver el pedido con fotos en este enlace:`,
      link,
      '',
      '_Precios y disponibilidad sujetos a confirmación del local._',
    ].join('\n')
  }

  function openWhatsAppToClient() {
    const digits = combinedPhoneDigits()
    if (digits.length < 8) {
      alert('Completá código de país y número (mínimo 8 dígitos en total, ej. 549 + 2615000000).')
      return
    }
    const msg = buildClientMessage()
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  function openLightbox(line: SharedCartItem) {
    const vis = visualByProduct.get(line.product_id)
    const paths = vis?.imagePaths?.length ? vis.imagePaths : []
    if (paths.length === 0) return
    setLightbox({
      id: line.product_id,
      name: line.name,
      description: vis?.description ?? null,
      price: line.unit_price,
      imagePaths: paths,
    })
  }

  return (
    <>
      <ProductImageLightbox open={lightbox != null} payload={lightbox} onClose={() => setLightbox(null)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it, idx) => {
          const vis = visualByProduct.get(it.product_id)
          const paths = vis?.imagePaths?.length ? vis.imagePaths : []
          const thumb = paths[0] ? getPublicUrlFromPath(paths[0]) : null
          return (
            <article
              key={`${idx}-${it.product_id}-${it.variant_id ?? 'x'}`}
              className="overflow-hidden rounded-xl border border-red-500/40 bg-zinc-900/40 shadow-md ring-1 ring-red-500/20"
            >
              <div className="flex gap-3 p-3">
                {thumb ? (
                  <button
                    type="button"
                    onClick={() => openLightbox(it)}
                    className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-800 text-left ring-zinc-600 transition hover:ring-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    aria-label={`Ver fotos de ${it.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                    {paths.length > 1 ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-zinc-200">
                        +{paths.length - 1}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[10px] text-zinc-500">
                    sin foto
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-zinc-100">{it.name}</h3>
                  <p className="mt-1 text-xs text-rose-200/90">
                    {formatMoneyArs(it.unit_price)} c/u · sublínea{' '}
                    <span className="font-semibold">{formatMoneyArs(it.unit_price * it.quantity)}</span>
                  </p>
                  {canEdit ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-950 text-lg leading-none text-zinc-200 hover:bg-zinc-800"
                        aria-label="Menos cantidad"
                        onClick={() => setQty(idx, it.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{it.quantity}</span>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-600/60 bg-rose-900/40 text-lg leading-none text-rose-50 hover:bg-rose-800/50"
                        aria-label="Más cantidad"
                        onClick={() => setQty(idx, it.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="ml-auto text-xs text-rose-400 underline hover:text-rose-300"
                      >
                        Quitar del pedido
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">Cantidad: {it.quantity}</p>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <p className="mt-6 flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-800 pt-4 text-base font-semibold">
        <span>Total</span>
        <span className="text-rose-100">{formatMoneyArs(subtotal)}</span>
      </p>

      {isAdmin && !canEdit && initialAdminNote ? (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/35 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nota interna</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{initialAdminNote}</p>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-8 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="border-b border-zinc-800 pb-6">
            <h3 className="text-sm font-semibold text-rose-200">Nota interna</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Solo la ve el equipo. Se muestra en <strong className="text-zinc-400">Pedidos</strong> junto al estado del
              pedido. Podés borrarla cuando quieras.
            </p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej. enviar a Rivadavia, retira por depósito…"
              className="mt-3 w-full resize-y rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-600/50 focus:outline-none focus:ring-1 focus:ring-rose-800/40"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={noteBusy}
                onClick={() => void saveAdminNote(adminNote.trim() === '' ? null : adminNote.trim().slice(0, 500))}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {noteBusy ? 'Guardando…' : 'Guardar nota'}
              </button>
              <button
                type="button"
                disabled={noteBusy}
                onClick={() => {
                  setAdminNote('')
                  void saveAdminNote(null)
                }}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
              >
                Borrar nota
              </button>
              <span className="text-[11px] text-zinc-600">{adminNote.length}/500</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-rose-200">Guardar cambios al pedido</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Ajustá cantidades o quitá productos antes de enviarle al cliente. Luego tocá Guardar.
            </p>
            {saveErr ? <p className="mt-2 text-sm text-amber-300">{saveErr}</p> : null}
            <button
              type="button"
              disabled={saveBusy || items.length === 0}
              onClick={() => void save()}
              className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {saveBusy ? 'Guardando…' : 'Guardar pedido'}
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-semibold text-rose-200">Enviar pedido por WhatsApp</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Código de país (por defecto Argentina 549) y el número sin repetir el código. Usá «Solo guardar número»
              para guardarlo en el pedido (así queda al aceptar la venta y para el aviso de confirmación). Luego podés
              abrir WhatsApp con el detalle y el enlace.
            </p>
            <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-28">
                <label htmlFor="shared-cart-wa-country" className="block text-xs font-medium text-zinc-400">
                  Código país
                </label>
                <input
                  id="shared-cart-wa-country"
                  name="clientWhatsAppCountry"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel-country-code"
                  placeholder="549"
                  value={waCountry}
                  onChange={(e) => setWaCountry(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-2 text-center text-sm tabular-nums text-zinc-100"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="shared-cart-wa-local" className="block text-xs font-medium text-zinc-400">
                  Número (sin código país)
                </label>
                <input
                  id="shared-cart-wa-local"
                  name="clientWhatsAppLocal"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="2615000000"
                  value={waLocal}
                  onChange={(e) => setWaLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={phoneBusy}
                onClick={() => void savePhoneOnly()}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
              >
                {phoneBusy ? '…' : 'Solo guardar número'}
              </button>
              <button
                type="button"
                onClick={openWhatsAppToClient}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
              >
                Abrir WhatsApp con este pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
