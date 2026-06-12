import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = createAdminClient()
  const now = new Date()

  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }

  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const [churnedUsers, users, subs, bookings, checkins, withdrawFees, withdrawFeesByMonth, checkinRows, feeSetting, planStats, planMonthlyRaw] =
    await Promise.all([
      sb.rpc('count_churned_users'),
      sb.from('profiles').select('user_id', { count: 'exact', head: true }),
      sb.from('subscriptions').select('subscription_id', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('gym_session_bookings').select('booking_id', { count: 'exact', head: true }),
      sb.from('gym_checkins').select('checkin_id', { count: 'exact', head: true }),

      // ✅ CORRECT revenue source: platform fees on paid withdrawals
      sb.from('gym_withdraw_requests')
        .select('platform_fee_cents')
        .eq('status', 'paid'),

      // ✅ CORRECT revenue by month
      sb.from('gym_withdraw_requests')
        .select('platform_fee_cents, updated_at')
        .eq('status', 'paid')
        .gte('updated_at', months[0] + '-01T00:00:00'),

      sb.from('gym_checkins')
        .select('checked_in_at')
        .gte('checked_in_at', days[0] + 'T00:00:00'),

      // Fee setting for superadmin control
      sb.from('platform_settings')
        .select('value_int')
        .eq('key', 'gym_withdraw_fee_bps')
        .single(),

      // Subscribers per plan (KPI cards)
      sb.from('plans').select(`
        plan_id, name, billing_period, price_cents,
        subscriptions(subscription_id, status)
      `),

      // Subscriptions per plan per month (last 6 months)
      sb.from('subscriptions')
        .select('plan_id, started_at, plans(name, billing_period)')
        .gte('started_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

  const planKpis = (planStats.data ?? []).map((p: any) => ({
    plan_id: p.plan_id,
    name: p.name,
    billing_period: p.billing_period,
    price_cents: p.price_cents,
    total_subs: p.subscriptions?.length ?? 0,
    active_subs: p.subscriptions?.filter((s: any) => s.status === 'active').length ?? 0,
  }))

  // Group by plan + month (use name + period to disambiguate)
  const planMonthlyMap: Record<string, Record<string, number>> = {}
  for (const s of planMonthlyRaw.data ?? []) {
    const planName = (s.plans as any)?.name ?? 'Unknown'
    const billingPeriod = (s.plans as any)?.billing_period ?? ''
    const key = `${planName}_${billingPeriod}`
    const m = s.started_at?.slice(0, 7) // YYYY-MM
    if (!m) continue
    if (!planMonthlyMap[key]) planMonthlyMap[key] = {}
    planMonthlyMap[key][m] = (planMonthlyMap[key][m] ?? 0) + 1
  }

  // Build charts for ALL plans (even those with 0 subs in range)
  const planCharts = planKpis.map((plan: any) => ({
    plan_id: plan.plan_id,
    name: plan.name,
    billing_period: plan.billing_period,
    data: months.map(m => ({ label: m.slice(5), value: planMonthlyMap[`${plan.name}_${plan.billing_period}`]?.[m] ?? 0 })),
  }))

  // Total revenue = sum of platform fees on paid withdrawals
  const totalRevenueCents = (withdrawFees.data ?? [])
    .reduce((s, r) => s + (r.platform_fee_cents ?? 0), 0)

  // Revenue per month
  const revenueByMonth: Record<string, number> = {}
  months.forEach(m => (revenueByMonth[m] = 0))
  for (const r of withdrawFeesByMonth.data ?? []) {
    const m = r.updated_at?.slice(0, 7)
    if (m && revenueByMonth[m] !== undefined) revenueByMonth[m] += r.platform_fee_cents ?? 0
  }

  // Check-ins per day
  const checkinsByDay: Record<string, number> = {}
  days.forEach(d => (checkinsByDay[d] = 0))
  for (const c of checkinRows.data ?? []) {
    const d = c.checked_in_at?.slice(0, 10)
    if (d && checkinsByDay[d] !== undefined) checkinsByDay[d]++
  }

  // Top gyms by check-in
  const { data: topGymsRaw } = await sb
    .from('gym_checkins')
    .select('gym_id, gyms(name, city)')
    .not('gym_id', 'is', null)
    .limit(500)

  const gymCounts: Record<string, { name: string; city: string; count: number }> = {}
  for (const c of topGymsRaw ?? []) {
    const gid = c.gym_id
    if (!gid) continue
    if (!gymCounts[gid]) gymCounts[gid] = { name: (c.gyms as any)?.name ?? '—', city: (c.gyms as any)?.city ?? '—', count: 0 }
    gymCounts[gid].count++
  }
  const topGyms = Object.entries(gymCounts)
    .map(([gym_id, v]) => ({ gym_id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({
    churnedUsers: (churnedUsers.data as number) ?? 0,
    totalUsers: users.count ?? 0,
    activeSubs: subs.count ?? 0,
    totalBookings: bookings.count ?? 0,
    totalCheckins: checkins.count ?? 0,
    totalRevenueCents,
    feeBps: feeSetting.data?.value_int ?? 1000,  // current withdrawal fee rate
    planKpis,
    planCharts,
    revenueByMonth: months.map(m => ({ month: m, cents: revenueByMonth[m] })),
    checkinsByDay: days.map(d => ({ day: d, count: checkinsByDay[d] })),
    topGyms,
  })
}
