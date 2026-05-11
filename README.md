# Lumina Mendoza — tienda + admin + stock

Next.js (App Router) pensado para **Vercel**, base **Supabase** (Postgres + Auth + Storage).

## Funciones

- **Tienda pública** (`/`): catálogo por categoría y subcategoría, carrito, **Comprar por WhatsApp** con texto detallado (productos, precios, total) y **link al carrito guardado** (`/c/[id]`) para que vean el mismo pedido.
- **Admin** (`/admin/login`): solo emails cargados en `admin_users` + usuarios creados en Supabase Auth. **Catálogo** para CRUD e **imágenes** (bucket `product-images`).
- **Stock** (`/admin/stock`): **Venta en persona** (modo mozo: listado de productos, ticket, confirmar venta) llama a `register_in_person_sale` y **descuenta stock**. **Historial del día** (desde medianoche, hora local del servidor).

## Setup Supabase

1. Creá un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecutá el archivo [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql).
3. Descomentá y editá al final del script los **INSERT** de `admin_users` con los dos emails que usarán el panel.
4. En **Authentication → Users**, creá esas cuentas (email/contraseña) o habilitá el proveedor que prefieras.
5. Confirmá que el bucket `product-images` exista (el SQL lo crea). Si fallan políticas de Storage por versión, creá el bucket desde el panel y ajustá políticas según la documentación actual.

Si el trigger `products_updated_at` da error de sintaxis en tu versión de Postgres, probá cambiar `execute function` por `execute procedure` en esa línea.

## Variables de entorno

Copiá [.env.example](.env.example) a `.env.local`:

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (dashboard nuevo); alternativa: `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** — API de carritos y página `/c/[id]` |
| `NEXT_PUBLIC_WHATSAPP_E164` | WhatsApp negocio, solo dígitos (ej. `5492615000000`) |
| `NEXT_PUBLIC_APP_URL` | URL pública del sitio (en Vercel, tu dominio) |

Helpers en [`src/utils/supabase/`](src/utils/supabase/): cliente servidor (con `cookies`), cliente navegador y `updateSession` para el middleware.

**Login admin:** el campo es *Usuario*. Por detrás Supabase sigue usando email: si no escribís `@`, se arma `usuario@lumina.local` (configurable con `NEXT_PUBLIC_AUTH_LOGIN_DOMAIN`). Los usuarios en Auth y las filas de `admin_users` deben usar ese mismo email sintético (ej. crear usuario `maria` → email en dashboard `maria@lumina.local`).

## Desarrollo

```bash
npm install
npm run dev
```

## Deploy Vercel

- Importá el repo/carpeta del proyecto.
- Configurá las mismas variables de entorno (incluida `SUPABASE_SERVICE_ROLE_KEY` en **Secrets**).
- Build: `npm run build`, output por defecto de Next.js.

## Notas

- El aviso de múltiples `package-lock.json` en el escritorio es por un lockfile en una carpeta padre; podés fijar `turbopack.root` en `next.config` o trabajar el repo aislado.
- Next 16 puede avisar que `middleware` está deprecado a favor de `proxy`; la sesión de Supabase sigue funcionando con el middleware actual hasta migrar según la doc oficial.
