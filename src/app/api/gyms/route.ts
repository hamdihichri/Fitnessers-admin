import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  // Use select('*') to avoid missing-column errors when schema evolves
  const { data, error } = await sb.from('gyms')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json()
  const { gym_id, ...updates } = body
  const { error } = await sb.from('gyms').update(updates).eq('gym_id', gym_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
