import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')
  if (!type || !id || (type !== 'user' && type !== 'gym')) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const col = type === 'user' ? 'user_id' : 'gym_id'

  const { data: rows, error } = await supabase
    .from('token_ledger')
    .select('ledger_id, user_id, gym_id, direction, amount, reason, created_at, expires_at')
    .eq(col, type === 'gym' ? Number(id) : id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ledgerRows = rows ?? []

  // No FK on token_ledger, so PostgREST can't embed — fetch profiles/gyms separately and merge
  const userIds = [...new Set(ledgerRows.map(r => r.user_id).filter(Boolean))]
  const gymIds = [...new Set(ledgerRows.map(r => r.gym_id).filter(Boolean))]

  const [{ data: profiles }, { data: gyms }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
    gymIds.length
      ? supabase.from('gyms').select('gym_id, name').in('gym_id', gymIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]))
  const gymMap = new Map((gyms ?? []).map(g => [g.gym_id, g]))

  const enriched = ledgerRows.map(r => ({
    ...r,
    profile: r.user_id ? profileMap.get(r.user_id) ?? null : null,
    gym: r.gym_id ? gymMap.get(r.gym_id) ?? null : null,
  }))

  const total_credit = enriched.filter(r => r.direction === 'credit').reduce((s, r) => s + r.amount, 0)
  const total_debit = enriched.filter(r => r.direction === 'debit').reduce((s, r) => s + r.amount, 0)

  return NextResponse.json({
    rows: enriched,
    summary: {
      total_credit,
      total_debit,
      net: total_credit - total_debit,
      first_entry_at: enriched.length ? enriched[enriched.length - 1].created_at : null,
      entry_count: enriched.length,
    },
  })
}
