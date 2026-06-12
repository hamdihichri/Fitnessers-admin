import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = createAdminClient()
  const { data: profiles } = await sb.from('profiles')
    .select('user_id,full_name,email,city,gender,phone_number,created_at,is_banned')
    .order('created_at', { ascending: false }).limit(300)

  if (!profiles?.length) return NextResponse.json([])

  const userIds = profiles.map(p => p.user_id)
  const [subs, ledger, seats] = await Promise.all([
    sb.from('subscriptions')
      .select('user_id,status,plan_id,plans(name)')
      .in('user_id', userIds)
      .eq('status', 'active'),
    sb.from('token_ledger')
      .select('user_id,direction,amount')
      .in('user_id', userIds),
    sb.from('company_subscription_seats')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'assigned'),
  ])

  const subsMap = Object.fromEntries((subs.data ?? []).map(s => [s.user_id, s]))
  const corpSet = new Set((seats.data ?? []).map(c => c.user_id))
  const balMap: Record<string, number> = {}
  for (const l of ledger.data ?? []) {
    balMap[l.user_id] = (balMap[l.user_id] ?? 0) + (l.direction === 'credit' ? l.amount : -l.amount)
  }

  return NextResponse.json(profiles.map(p => ({
    ...p,
    sub: subsMap[p.user_id] ?? null,
    balance: Math.max(0, balMap[p.user_id] ?? 0),
    isCorporate: corpSet.has(p.user_id),
  })))
}
