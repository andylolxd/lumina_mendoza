import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

/**
 * Renueva cookies de sesión en casi todas las rutas (incluye la tienda en /) para que
 * al volver del catálogo público la sesión de admin siga válida. Excluye estáticos de Next e imágenes.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
