import { AdminDashShell } from '@/components/admin-dash-shell'
import { requireAdmin } from '@/lib/admin'

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return <AdminDashShell>{children}</AdminDashShell>
}
