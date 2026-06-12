import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [gyms, users, subs, bookings, checkins, payments] = await Promise.all([
    sb.from('gyms').select('gym_id,rne_verified,deleted_at'),
    sb.from('profiles').select('user_id', { count: 'exact', head: true }),
    sb.from('subscriptions').select('status'),
    sb.from('gym_session_bookings').select('booking_id', { count:'exact', head:true }).eq('session_date', today),
    sb.from('gym_checkins').select('checkin_id', { count:'exact', head:true }).gte('checked_in_at', today+'T00:00:00'),
    sb.from('gym_withdraw_requests').select('withdraw_id,requested_amount_cents').eq('status','requested'),
  ])

  const activeGyms = (gyms.data ?? []).filter(g => !g.deleted_at).length
  const pendingGyms = (gyms.data ?? []).filter(g => !g.rne_verified && !g.deleted_at).length
  const activeSubs = (subs.data ?? []).filter(s => s.status === 'active').length
  const pendingAmt = (payments.data ?? []).reduce((s, p) => s + (p as any).requested_amount_cents, 0)

  return NextResponse.json({
    totalGyms: activeGyms, pendingGyms,
    totalUsers: users.count ?? 0,
    activeSubscriptions: activeSubs,
    bookingsToday: bookings.count ?? 0,
    checkinsToday: checkins.count ?? 0,
    pendingPayments: payments.data?.length ?? 0,
    pendingPaymentsAmount: pendingAmt,
  })
}
