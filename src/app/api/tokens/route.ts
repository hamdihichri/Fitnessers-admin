import { createAdminClient, createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = createServerClient(req)
  const sbAdmin = createAdminClient()
  const direction = req.nextUrl.searchParams.get('direction')
  const reason = req.nextUrl.searchParams.get('reason')
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString()

  let query = sbAdmin.from('token_ledger')
    .select('ledger_id,user_id,direction,amount,reason,created_at,expires_at,gym_id')
    .order('created_at', { ascending: false }).limit(150)
  if (direction) query = query.eq('direction', direction)
  if (reason) query = query.eq('reason', reason)

  const [ledger, todayC, todayD, expiring, economy] = await Promise.all([
    query,
    sbAdmin.from('token_ledger').select('amount').eq('direction','credit').gte('created_at', today+'T00:00:00'),
    sbAdmin.from('token_ledger').select('amount').eq('direction','debit').gte('created_at', today+'T00:00:00'),
    sbAdmin.from('token_ledger').select('amount').eq('direction','credit').lte('expires_at', in7).gt('expires_at', new Date().toISOString()),
    sb.rpc('get_admin_token_overview')
  ])

  if (!ledger.data?.length) return NextResponse.json({ rows:[], stats:{}, economySummary: economy.data ?? null })

  const userIds = [...new Set(ledger.data.map(l => l.user_id).filter(Boolean))]
  const gymIds = [...new Set(ledger.data.map(l => l.gym_id).filter(Boolean))]

  const [{ data: profiles }, { data: gyms }] = await Promise.all([
    userIds.length
      ? sbAdmin.from('profiles').select('user_id,full_name,email').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
    gymIds.length
      ? sbAdmin.from('gyms').select('gym_id,name').in('gym_id', gymIds)
      : Promise.resolve({ data: [] }),
  ])

  const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]))
  const gm = Object.fromEntries((gyms ?? []).map(g => [g.gym_id, g]))

  const rows = ledger.data.map(l => ({
    ...l,
    profile: l.user_id ? pm[l.user_id] ?? null : null,
    gym: l.gym_id ? gm[l.gym_id] ?? null : null
  }))
  const totalC = rows.filter(l=>l.direction==='credit').reduce((s,l)=>s+l.amount,0)
  const totalD = rows.filter(l=>l.direction==='debit').reduce((s,l)=>s+l.amount,0)

  return NextResponse.json({
    rows,
    stats: {
      circulation: Math.max(0, totalC - totalD),
      todayCredit: (todayC.data??[]).reduce((s,l)=>s+l.amount,0),
      todayDebit:  (todayD.data??[]).reduce((s,l)=>s+l.amount,0),
      expiringSoon:(expiring.data??[]).reduce((s,l)=>s+l.amount,0),
    },
    economySummary: economy.data ?? null
  })
}

export async function POST(req: NextRequest) {
  const sb = createServerClient(req)
  const { user_id, direction, amount, reason } = await req.json()
  const { error } = await sb.from('token_ledger').insert({ user_id, direction, amount, reason })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
