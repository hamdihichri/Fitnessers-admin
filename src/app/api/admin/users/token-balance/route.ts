import { createAdminClient } from '@/lib/supabase'
import { requireSuperadminSession } from '@/lib/adminAuth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  await requireSuperadminSession()

  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const sb = createAdminClient()
  const { data, error } = await sb
    .from('token_ledger')
    .select('direction,amount')
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let balance = 0
  for (const row of data ?? []) {
    balance += row.direction === 'credit' ? row.amount : -row.amount
  }

  return NextResponse.json({ user_id, balance: Math.max(0, balance) })
}
