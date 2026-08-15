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
// auth.uid() will be populated → is_superadmin() works in RPCs/triggers
export function createServerClient(req: NextRequest) {
  const sbAccessToken = req.cookies.get('sb-access-token')?.value

  if (sbAccessToken) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${sbAccessToken}`,
          },
        },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )
  }

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
  const resp = await fetch('/api/admin/ban-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  return resp.json();
}

export async function unbanUser(userId: string) {
  const resp = await fetch('/api/admin/unban-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  return resp.json();
}

export async function grantTokens(userId: string, amount: number, reason: string) {
  const resp = await fetch('/api/admin/grant-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount, reason })
  });
  return resp.json();
}

export async function debitTokens(userId: string, amount: number, reason: string) {
  const resp = await fetch('/api/admin/debit-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount, reason })
  });
  return resp.json();
}

export async function cancelUserSubscription(userId: string, subscriptionId: number, reason?: string) {
  const resp = await fetch('/api/admin/cancel-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, subscription_id: subscriptionId, reason })
  });
  return resp.json();
}

export async function pardonCap(gymId: string, userId: string, reason: string) {
  const resp = await fetch('/api/admin/pardon-cap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gym_id: gymId, user_id: userId, reason })
  });
  return resp.json();
}

export async function liftSuspension(gymId: string, userId: string, reason: string) {
  const resp = await fetch('/api/admin/lift-suspension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gym_id: gymId, user_id: userId, reason })
  });
  return resp.json();
}
