export function getPublicUrlFromPath(imagePath: string | null): string | null {
  if (!imagePath) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/product-images/${encodeURI(imagePath)}`
}

/** Dominio público en enlaces compartidos (WhatsApp, etc.). */
export const CANONICAL_APP_ORIGIN = 'https://luminamendoza.shop'

export function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!fromEnv) return 'http://localhost:3000'
  if (/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv
  if (/\.vercel\.app/i.test(fromEnv)) return CANONICAL_APP_ORIGIN
  return fromEnv
}
