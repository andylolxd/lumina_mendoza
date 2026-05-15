'use client'

import { formatMoneyArs } from '@/lib/format'
import { getPublicUrlFromPath } from '@/lib/publicUrl'
import { useCallback, useEffect, useState } from 'react'

export type ProductLightboxPayload = {
  id: string
  name: string
  description: string | null
  price: number
  /** Rutas de storage (no URLs públicas). */
  imagePaths: string[]
}

export function ProductImageLightbox({
  open,
  payload,
  onClose,
}: {
  open: boolean
  payload: ProductLightboxPayload | null
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)

  const paths = payload?.imagePaths ?? []
  const urls = paths
    .map((p) => getPublicUrlFromPath(p))
    .filter((u): u is string => typeof u === 'string' && u.length > 0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open, payload?.id])

  useEffect(() => {
    if (urls.length === 0) return
    setIndex((i) => Math.min(i, urls.length - 1))
  }, [urls.length])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (urls.length === 0) return
      setIndex((i) => (i + dir + urls.length) % urls.length)
    },
    [urls.length],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, go])

  if (!open || !payload || urls.length === 0) return null

  const src = urls[index] ?? urls[0]

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-2 backdrop-blur-md sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Misma columna que en móvil; en md+ zoom 80% en escritorio */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-lightbox-title"
        className="relative flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-rose-900/40 bg-zinc-950 shadow-2xl shadow-black/60 ring-1 ring-rose-950/30 [max-height:min(88vh,640px)] md:max-w-lg md:[zoom:0.8]"
      >
        <button
          type="button"
          className="absolute right-1.5 top-1.5 z-10 rounded-full border border-zinc-600 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white sm:right-2 sm:top-2 sm:px-2.5 sm:text-sm"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900">
          <div className="relative mx-auto w-full px-2 pt-9 pb-1 sm:px-3 sm:pt-10">
            <div className="relative mx-auto aspect-[4/3] w-full max-h-[min(42vw,220px)] max-w-[320px] overflow-hidden rounded-lg bg-black/40 sm:max-h-[240px] sm:max-w-[340px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={src}
                src={src}
                alt=""
                className="h-full w-full origin-center object-contain transition-opacity duration-300 md:scale-100 scale-[1.32]"
              />
              {urls.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full border border-zinc-600/80 bg-black/55 px-2 py-1.5 text-base text-white backdrop-blur-sm transition hover:bg-black/75 sm:left-2 sm:px-2.5 sm:py-2 sm:text-lg"
                    onClick={() => go(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Foto siguiente"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-zinc-600/80 bg-black/55 px-2 py-1.5 text-base text-white backdrop-blur-sm transition hover:bg-black/75 sm:right-2 sm:px-2.5 sm:py-2 sm:text-lg"
                    onClick={() => go(1)}
                  >
                    ›
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {urls.length > 1 ? (
            <div
              className="flex gap-2 overflow-x-auto px-2 pb-2 pt-1 sm:px-3 sm:pb-3"
              role="tablist"
              aria-label="Miniaturas del producto"
            >
              {urls.map((thumb, i) => (
                <button
                  key={`${thumb}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Ver foto ${i + 1} en grande`}
                  onClick={() => setIndex(i)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-950 transition sm:h-14 sm:w-14 ${
                    i === index
                      ? 'border-rose-400 ring-2 ring-rose-500/40'
                      : 'border-zinc-700 opacity-90 hover:border-zinc-500 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-4 sm:px-4 sm:py-4">
          <h2 id="product-lightbox-title" className="pr-8 text-base font-semibold leading-snug text-rose-100 sm:text-lg">
            {payload.name}
          </h2>
          {payload.description ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">{payload.description}</p>
          ) : null}
          <p className="mt-3 text-lg font-semibold text-rose-300 sm:text-xl">{formatMoneyArs(Number(payload.price))}</p>
          {urls.length > 1 ? (
            <p className="mt-2 text-xs text-zinc-500">
              {index + 1} / {urls.length} · tocá una miniatura o usá ← →
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
