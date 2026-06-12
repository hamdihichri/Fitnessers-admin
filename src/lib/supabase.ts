import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient, parseCookieHeader } from '@supabase/ssr'
import { NextRequest } from 'next/server'

// Browser client (unchanged)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storageKey: 'fitnessers-admin-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Admin client — service role, bypasses RLS, use only for reads
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Server client — forwards the superadmin's session cookie
// auth.uid() will be populated → is_superadmin() works in triggers
export function createServerClient(req: NextRequest) {
  const cookies = parseCookieHeader(req.headers.get('cookie') ?? '')
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies.map(c => ({ name: c.name, value: c.value ?? '' })),
        setAll: () => {}, // read-only in API routes
      },
    }
  )
}

// ── Admin Helpers ─────────────────────────────────────

export async function banUser(userId: string) {
  return supabase.rpc('admin_ban_user', { target_user_id: userId });
}

export async function unbanUser(userId: string) {
  return supabase.rpc('admin_unban_user', { target_user_id: userId });
}

export async function grantTokens(userId: string, amount: number, reason: string) {
  return supabase.rpc('admin_grant_tokens', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
}
export async function pardonCap(gymId: string, userId: string, reason: string) {
  return supabase.rpc('superadmin_pardon_cap', {
    p_gym_id: gymId,
    p_user_id: userId,
    p_reason: reason
  });
}

export async function liftSuspension(gymId: string, userId: string, reason: string) {
  const resp = await fetch('/api/admin/lift-suspension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gym_id: gymId, user_id: userId, reason })
  });
  return resp.json();
}
