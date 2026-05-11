'use server'

import { usernameOrEmailToSupabaseEmail } from '@/lib/auth-login'
import { requireAdmin } from '@/lib/admin'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type ActionResult = { ok: true; message?: string; mustReauth?: boolean } | { ok: false; error: string }

export async function getAdminEmails(): Promise<string[]> {
  await requireAdmin()
  const svc = createServiceRoleClient()
  const { data } = await svc.from('admin_users').select('email').order('email')
  return (data ?? []).map((r: { email: string }) => r.email)
}

async function findAuthUserIdByEmail(serviceEmail: string): Promise<string | null> {
  const admin = createServiceRoleClient()
  const target = serviceEmail.trim().toLowerCase()
  let page = 1
  const perPage = 200
  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const u = data.users.find((x) => x.email?.toLowerCase() === target)
    if (u) return u.id
    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

function normalizeEmail(input: string): string {
  return usernameOrEmailToSupabaseEmail(input)
}

/** Crea usuario en Auth (confirmado) + fila en admin_users. */
export async function createAdminUserAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    if (!username) return { ok: false, error: 'Completá el usuario.' }
    if (password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }

    const email = normalizeEmail(username)
    if (!email) return { ok: false, error: 'Usuario inválido.' }

    const svc = createServiceRoleClient()

    const { data: existing } = await svc.from('admin_users').select('email').eq('email', email).maybeSingle()
    if (existing) return { ok: false, error: 'Ese email ya está en la lista de administradores.' }

    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) {
      return {
        ok: false,
        error:
          createErr.message +
          ' Si el usuario ya existe en Authentication, usá “Vincular usuario existente”.',
      }
    }
    if (!created.user?.id) return { ok: false, error: 'No se pudo crear el usuario en Auth.' }

    const { error: insErr } = await svc.from('admin_users').insert({ email })
    if (insErr) {
      await svc.auth.admin.deleteUser(created.user.id)
      return { ok: false, error: insErr.message }
    }

    return { ok: true, message: `Administrador creado: ${email}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return { ok: false, error: msg }
  }
}

/** Solo agrega la fila en admin_users (el usuario ya debe existir en Authentication). */
export async function linkExistingAuthAdminAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    const username = String(formData.get('link_username') ?? '').trim()
    const email = normalizeEmail(username)
    if (!email) return { ok: false, error: 'Usuario o email inválido.' }

    const svc = createServiceRoleClient()
    const uid = await findAuthUserIdByEmail(email)
    if (!uid) return { ok: false, error: 'No hay ningún usuario en Authentication con ese email.' }

    const { data: existing } = await svc.from('admin_users').select('email').eq('email', email).maybeSingle()
    if (existing) return { ok: false, error: 'Ese administrador ya está en la lista.' }

    const { error: insErr } = await svc.from('admin_users').insert({ email })
    if (insErr) return { ok: false, error: insErr.message }
    return { ok: true, message: `Vinculado: ${email}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return { ok: false, error: msg }
  }
}

export async function setAdminPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    const target = String(formData.get('pwd_email') ?? '').trim()
    const password = String(formData.get('new_password') ?? '')
    if (!target) return { ok: false, error: 'Elegí un administrador.' }
    if (password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }

    const email = target.includes('@') ? target.trim().toLowerCase() : normalizeEmail(target)
    const svc = createServiceRoleClient()
    const { data: row } = await svc.from('admin_users').select('email').eq('email', email).maybeSingle()
    if (!row) return { ok: false, error: 'Ese email no está en la lista de administradores.' }

    const uid = await findAuthUserIdByEmail(email)
    if (!uid) return { ok: false, error: 'No hay usuario en Authentication con ese email. Creá el usuario primero o usá “Nuevo administrador”.' }

    const { error } = await svc.auth.admin.updateUserById(uid, { password })
    if (error) return { ok: false, error: error.message }
    return { ok: true, message: `Contraseña actualizada para ${email}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return { ok: false, error: msg }
  }
}

export async function changeAdminLoginEmailAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireAdmin()
  try {
    const oldInput = String(formData.get('old_login') ?? '').trim()
    const newUsername = String(formData.get('new_username') ?? '').trim()
    if (!oldInput || !newUsername) return { ok: false, error: 'Completá usuario actual y nuevo usuario.' }

    const oldEmail = oldInput.includes('@') ? oldInput.toLowerCase() : normalizeEmail(oldInput)
    const newEmail = normalizeEmail(newUsername)
    if (!oldEmail || !newEmail) return { ok: false, error: 'Formato de usuario inválido.' }
    if (oldEmail === newEmail) return { ok: false, error: 'El nuevo usuario es igual al actual.' }

    const svc = createServiceRoleClient()
    const { data: row } = await svc.from('admin_users').select('email').eq('email', oldEmail).maybeSingle()
    if (!row) return { ok: false, error: 'El usuario actual no está en la lista de administradores.' }

    const { data: clash } = await svc.from('admin_users').select('email').eq('email', newEmail).maybeSingle()
    if (clash) return { ok: false, error: 'El nuevo email ya está usado por otro administrador.' }

    const uid = await findAuthUserIdByEmail(oldEmail)
    if (!uid) return { ok: false, error: 'No hay usuario en Authentication con el email actual.' }

    const { error: upErr } = await svc.auth.admin.updateUserById(uid, { email: newEmail })
    if (upErr) return { ok: false, error: upErr.message }

    const { error: delErr } = await svc.from('admin_users').delete().eq('email', oldEmail)
    if (delErr) return { ok: false, error: `Auth actualizado pero tabla admin_users: ${delErr.message}` }

    const { error: insErr } = await svc.from('admin_users').insert({ email: newEmail })
    if (insErr) return { ok: false, error: `Auth y fila vieja: revisá admin_users manualmente. ${insErr.message}` }

    const self = user.email?.toLowerCase() === oldEmail.toLowerCase()
    return {
      ok: true,
      message: self
        ? `Inicio de sesión cambiado a ${newEmail}. Volvé a entrar con el nuevo usuario.`
        : `Inicio de sesión actualizado: ${oldEmail} → ${newEmail}`,
      mustReauth: self,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return { ok: false, error: msg }
  }
}

export async function removeAdminAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireAdmin()
  try {
    const target = String(formData.get('remove_email') ?? '').trim()
    if (!target) return { ok: false, error: 'Elegí un administrador.' }
    const email = target.includes('@') ? target.toLowerCase() : normalizeEmail(target)

    const svc = createServiceRoleClient()
    const { data: rows } = await svc.from('admin_users').select('email')
    const count = rows?.length ?? 0
    if (count <= 1) return { ok: false, error: 'No podés eliminar el único administrador.' }

    const { data: row } = await svc.from('admin_users').select('email').eq('email', email).maybeSingle()
    if (!row) return { ok: false, error: 'Ese email no está en la lista.' }

    const { error: delDb } = await svc.from('admin_users').delete().eq('email', email)
    if (delDb) return { ok: false, error: delDb.message }

    const uid = await findAuthUserIdByEmail(email)
    if (uid) {
      await svc.auth.admin.deleteUser(uid)
    }

    const self = user.email?.toLowerCase() === email.toLowerCase()
    return {
      ok: true,
      message: self ? 'Te quitaste del panel. La sesión se cerrará.' : `Eliminado: ${email}`,
      mustReauth: self,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return { ok: false, error: msg }
  }
}
