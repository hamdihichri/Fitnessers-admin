import { cookies } from 'next/headers'
import { jwtVerify, JWTPayload } from 'jose'
import { createAdminClient } from '@/lib/supabase'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

export type AdminSessionPayload = JWTPayload & {
  email?: string
  role?: string
}

export async function requireSuperadminSession(): Promise<AdminSessionPayload> {
  const token = (await cookies()).get('og-session')?.value
  if (!token) throw new Error('Unauthorized')

  const { payload } = await jwtVerify(token, getSecret())
  const p = payload as AdminSessionPayload
  if (p.role !== 'superadmin') throw new Error('Forbidden')
  return p
}

export async function requireDbSuperadmin(): Promise<{ session: AdminSessionPayload; user_id: string }> {
  const session = await requireSuperadminSession()
  const email = session.email?.trim().toLowerCase()
  if (!email) throw new Error('Unauthorized')

  const sb = createAdminClient()
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile?.user_id) throw new Error('Unauthorized')

  const { data: isAdmin, error: adminError } = await sb.rpc('is_superadmin', { p_user_id: profile.user_id })
  if (adminError) throw new Error(adminError.message)
  if (!isAdmin) throw new Error('Forbidden')

  return { session, user_id: profile.user_id }
}
