import type { CSSProperties } from 'react'

export const STORE_HEADER_BG_SRC = '/images/store-header-bg.png'
export const STORE_INFINITE_BG_SRC = '/images/store-infinite-bg.png'

/** Capa de fondo pixelada (misma que la tienda). */
export const storeInfiniteBgLayerStyle: CSSProperties = {
  backgroundImage: `url(${STORE_INFINITE_BG_SRC})`,
  backgroundRepeat: 'repeat',
  backgroundPosition: 'center top',
  backgroundSize: 'min(320px, 38vw) auto',
  imageRendering: 'pixelated',
}

/** Marco categoría (tienda / admin catálogo y árbol stock). */
export const storeCatalogFrameCategoryClass =
  'group scroll-mt-24 overflow-hidden rounded-3xl border-2 border-rose-400/70 bg-zinc-900/45 shadow-md shadow-black/35 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200'

export const storeCatalogFrameSubClass =
  'group overflow-hidden rounded-xl border-2 border-rose-400/70 bg-zinc-900/45 shadow-md shadow-black/25 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200'

export const storeCatalogFrameSubsubClass =
  'group overflow-hidden rounded-lg border-2 border-rose-400/70 bg-rose-950/15 shadow-sm shadow-black/25 ring-2 ring-rose-400/25 transition-[border-color,box-shadow,ring-width,ring-color] duration-200 sm:ml-1'
