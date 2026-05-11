/** Normaliza el valor JSON de `image_gallery` desde Supabase. */
export function normalizeGallery(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  }
  return []
}

/** Orden: imagen principal (`image_path`) primero, luego galería sin duplicar. */
export function collectProductImagePaths(p: {
  image_path: string | null
  image_gallery?: unknown
}): string[] {
  const paths: string[] = []
  if (p.image_path?.trim()) paths.push(p.image_path.trim())
  for (const x of normalizeGallery(p.image_gallery)) {
    if (!paths.includes(x)) paths.push(x)
  }
  return paths
}
