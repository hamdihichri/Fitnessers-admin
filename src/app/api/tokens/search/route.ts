import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const supabase = createAdminClient()

  const [{ data: users }, { data: gyms }] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, full_name, email, is_banned, photo_path')
      .or(`full_name.ilike.%${q}%,email_lower.ilike.%${q.toLowerCase()}%`)
      .limit(6),
    supabase
      .from('gyms')
      .select('gym_id, name')
      .ilike('name', `%${q}%`)
      .limit(4),
  ])

  const results = [
    ...(users ?? []).map(u => ({
      type: 'user' as const,
      id: u.user_id,
      label: u.full_name ?? u.email ?? 'Unnamed',
      sub: u.email,
      is_banned: u.is_banned,
      photo_path: u.photo_path,
    })),
    ...(gyms ?? []).map(g => ({
      type: 'gym' as const,
      id: String(g.gym_id),
      label: g.name,
    })),
  ]

  return NextResponse.json(results)
}
