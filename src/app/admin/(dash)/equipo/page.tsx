import { AdminTeamPanel } from '@/components/admin-team-panel'
import { getAuthLoginDomain } from '@/lib/auth-login'
import { requireAdmin } from '@/lib/admin'
import { getAdminEmails } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EquipoPage() {
  await requireAdmin()
  let emails: string[] = []
  let serviceError: string | null = null
  try {
    emails = await getAdminEmails()
  } catch (e) {
    serviceError = e instanceof Error ? e.message : 'No se pudo cargar la lista.'
  }

  const loginDomain = getAuthLoginDomain()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-rose-100">Equipo y accesos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestioná quién puede entrar al panel. Requiere <code className="text-zinc-400">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
          en el servidor (.env.local).
        </p>
      </div>

      {serviceError ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-medium">No se pudo usar la API de administración</p>
          <p className="mt-2 text-xs text-amber-200/90">{serviceError}</p>
          <p className="mt-2 text-xs text-zinc-400">
            En Supabase: Project Settings → API → copiá la clave <strong>service_role</strong> (secreta) en{' '}
            <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> y reiniciá el servidor de
            desarrollo.
          </p>
        </div>
      ) : (
        <AdminTeamPanel initialEmails={emails} loginDomain={loginDomain} />
      )}
    </div>
  )
}
