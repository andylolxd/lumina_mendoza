/** Redes y WhatsApp de la tienda (fallback si falta env). */
const DEFAULT_WHATSAPP_E164_DIGITS = '5492617123282'

export const STORE_INSTAGRAM_URL = 'https://www.instagram.com/luminamendoza/?hl=es'
export const STORE_TIKTOK_URL = 'https://www.tiktok.com/@lumina.mendoza'

/** Dígitos E.164 sin + (ej. 5492617123282). */
export function getStoreWhatsAppE164Digits(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_E164
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length >= 10 && d.length <= 15) return d
  return DEFAULT_WHATSAPP_E164_DIGITS
}

export function buildStoreWhatsAppUrl(prefilledText?: string): string {
  const digits = getStoreWhatsAppE164Digits()
  const base = `https://wa.me/${digits}`
  if (!prefilledText?.trim()) return base
  return `${base}?text=${encodeURIComponent(prefilledText)}`
}
