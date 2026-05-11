/** Parte código país (solo dígitos) y resto nacional, para UI de dos recuadros. */

export function splitStoredWhatsApp(stored: string | null | undefined): { country: string; local: string } {
  if (!stored?.trim()) return { country: '549', local: '' }
  const d = stored.replace(/\D/g, '')
  if (d.startsWith('549') && d.length > 3) return { country: '549', local: d.slice(3) }
  if (d.startsWith('598') && d.length > 3) return { country: '598', local: d.slice(3) }
  if (d.startsWith('595') && d.length > 3) return { country: '595', local: d.slice(3) }
  if (d.startsWith('56') && d.length > 2 && !d.startsWith('549')) return { country: '56', local: d.slice(2) }
  if (d.startsWith('54') && d.length > 2) return { country: '54', local: d.slice(2) }
  return { country: '549', local: d }
}

export function combineWhatsAppParts(country: string, local: string): string {
  return `${country.replace(/\D/g, '')}${local.replace(/\D/g, '')}`
}
