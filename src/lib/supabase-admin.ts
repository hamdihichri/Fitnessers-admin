// WARNING: Server-only Supabase client using service_role key.
// Do NOT import this file in Client Components!

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

function getJwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

export interface AdminUser {
  user_id: string
  role?: string
  email?: string
}

export async function requireAdmin(): Promise<AdminUser> {
  const cookieStore = await cookies()
  const ogSessionToken = cookieStore.get('og-session')?.value
  const sbAccessToken = cookieStore.get('sb-access-token')?.value

  let userId: string | null = null
  let userEmail: string | undefined = undefined

  // 1. Attempt to verify via Supabase access token cookie if present
  if (sbAccessToken) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(sbAccessToken)
      if (user && !error) {
        userId = user.id
        userEmail = user.email
      }
    } catch {
      // Ignore auth errors and fallback to og-session
    }
  }

  // 2. Check og-session JWT cookie if userId not resolved yet
  if (!userId && ogSessionToken) {
    try {
      const { payload } = await jwtVerify(ogSessionToken, getJwtSecret())
      if (payload.email) {
        userEmail = payload.email as string
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('email', userEmail)
          .maybeSingle()
        if (profile?.user_id) {
          userId = profile.user_id
        }
      }
    } catch {
      // Invalid token
    }
  }

  // 3. Fallback: if we have userEmail but no userId, query auth.users
  if (!userId && userEmail) {
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      const foundAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === userEmail?.toLowerCase())
      if (foundAuthUser) {
        userId = foundAuthUser.id
      }
    } catch {
      // Ignore
    }
  }

  if (!userId && !userEmail) {
    throw new Error('Unauthorized: No valid admin session found')
  }

  // 4. Verify user exists in admin_users table
  let query = supabaseAdmin.from('admin_users').select('*')
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: adminRows, error: adminErr } = await query
  if (adminErr || !adminRows || adminRows.length === 0) {
    throw new Error('Forbidden: User does not exist in admin_users')
  }

  const adminRow = adminRows[0]
  return {
    user_id: adminRow.user_id,
    role: adminRow.role,
    email: userEmail,
  }
}
