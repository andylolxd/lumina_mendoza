/** Categorías que siguen en admin pero no se muestran en la tienda pública. */
const STORE_HIDDEN_CATEGORY_KEYS = new Set(['dijes', 'dije'])

function normalizeCategoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function isCategoryHiddenOnStorefront(name: string): boolean {
  return STORE_HIDDEN_CATEGORY_KEYS.has(normalizeCategoryKey(name))
}
