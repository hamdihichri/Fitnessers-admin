import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const direction = req.nextUrl.searchParams.get('direction')
  const reason = req.nextUrl.searchParams.get('reason')
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString()

  let query = sb.from('token_ledger')
    .select('ledger_id,user_id,direction,amount,reason,created_at,expires_at,gym_id')
    .order('created_at', { ascending: false }).limit(150)
  if (direction) query = query.eq('direction', direction)
  if (reason) query = query.eq('reason', reason)

  const [ledger, todayC, todayD, expiring] = await Promise.all([
    query,
    sb.from('token_ledger').select('amount').eq('direction','credit').gte('created_at', today+'T00:00:00'),
    sb.from('token_ledger').select('amount').eq('direction','debit').gte('created_at', today+'T00:00:00'),
    sb.from('token_ledger').select('amount').eq('direction','credit').lte('expires_at', in7).gt('expires_at', new Date().toISOString()),
  ])

  if (!ledger.data?.length) return NextResponse.json({ rows:[], stats:{} })

  const userIds = [...new Set(ledger.data.map(l => l.user_id))]
  const { data: profiles } = await sb.from('profiles').select('user_id,full_name').in('user_id', userIds)
  const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]))

  const rows = ledger.data.map(l => ({ ...l, profile: pm[l.user_id] ?? null }))
  const totalC = rows.filter(l=>l.direction==='credit').reduce((s,l)=>s+l.amount,0)
  const totalD = rows.filter(l=>l.direction==='debit').reduce((s,l)=>s+l.amount,0)

  return NextResponse.json({
    rows,
    stats: {
      circulation: Math.max(0, totalC - totalD),
      todayCredit: (todayC.data??[]).reduce((s,l)=>s+l.amount,0),
      todayDebit:  (todayD.data??[]).reduce((s,l)=>s+l.amount,0),
      expiringSoon:(expiring.data??[]).reduce((s,l)=>s+l.amount,0),
    }
  })
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { user_id, direction, amount, reason } = await req.json()
  const { error } = await sb.from('token_ledger').insert({ user_id, direction, amount, reason })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
