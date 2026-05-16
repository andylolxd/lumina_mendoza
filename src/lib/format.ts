export function formatMoneyArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Categorías y subcategorías siempre en mayúsculas (es-AR). */
export function upperCategoryLabel(name: string): string {
  return name.trim().toLocaleUpperCase('es-AR')
}
