import { upperCategoryLabel } from '@/lib/format'

/** Ruta de visualización CAT / SUB / SUBSUB. */
export function formatCatalogPath(parts: (string | null | undefined)[]): string {
  return parts.map((p) => upperCategoryLabel(p ?? '')).filter(Boolean).join(' / ')
}
