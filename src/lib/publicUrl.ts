export function getPublicUrlFromPath(imagePath: string | null): string | null {
  if (!imagePath) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/product-images/${encodeURI(imagePath)}`
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  )
}
