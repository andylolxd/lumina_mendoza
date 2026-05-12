import {
  STORE_INSTAGRAM_URL,
  STORE_TIKTOK_URL,
  buildStoreWhatsAppUrl,
} from '@/lib/store-public-links'

const linkClass =
  'rounded-lg border border-zinc-600/80 bg-zinc-900/50 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-rose-500/50 hover:bg-rose-950/25 hover:text-rose-100'

export function StoreFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 border-t border-zinc-800/60 bg-zinc-950/40 px-4 py-10 backdrop-blur-[2px]">
      <div className="mx-auto max-w-5xl">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3"
          aria-label="Redes sociales y contacto"
        >
          <a href={STORE_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Instagram
          </a>
          <a href={STORE_TIKTOK_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            TikTok
          </a>
          <a href={buildStoreWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className={linkClass}>
            WhatsApp
          </a>
        </nav>
        <p className="mt-8 text-center text-[11px] leading-relaxed text-white sm:text-xs">
          © {year} Lumina Mendoza. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
