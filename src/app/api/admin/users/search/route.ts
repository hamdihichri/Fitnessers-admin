import { createAdminClient } from '@/lib/supabase'
import { requireSuperadminSession } from '@/lib/adminAuth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  await requireSuperadminSession()

  const qRaw = req.nextUrl.searchParams.get('q') ?? ''
  const q = qRaw.trim()
  if (q.length < 2) return NextResponse.json([])

  const sb = createAdminClient()

  const { data, error } = await sb
    .from('profiles')
    .select('user_id,full_name,email')
    .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(Array.isArray(data) ? data : [])
}
