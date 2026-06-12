import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const sb = createAdminClient()
  const { key, value_int } = await req.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
  const { error } = await sb
    .from('platform_settings')
    .update({ value_int, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
