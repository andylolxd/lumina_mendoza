import { Suspense } from 'react'
import { LoginForm } from './login-form'

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
