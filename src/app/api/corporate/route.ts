import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const companyId = req.nextUrl.searchParams.get('company_id')

  if (companyId) {
    const [company, hrAdmins, sub, invites] = await Promise.all([
      sb.from('companies').select('*').eq('company_id', companyId).maybeSingle(),
      sb.from('company_employees').select('*, profiles(full_name,email)').eq('company_id', companyId).eq('role', 'admin'),
      sb.from('company_subscriptions').select('*, company_seat_entitlements(*), company_subscription_seats(seat_id, status, user_id, assigned_at, profiles(full_name, email))').eq('company_id', companyId).eq('status', 'active').order('started_at', { ascending: false }).maybeSingle(),
      sb.from('company_invites').select('*').eq('company_id', companyId).eq('status', 'pending')
    ])
    return NextResponse.json({
      company: company.data,
      hrAdmins: hrAdmins.data ?? [],
      subscription: sub.data,
      invites: invites.data ?? []
    })
  }

  const [companies, subs, seats, hrAdminsListing] = await Promise.all([
    sb.from('companies').select('*').order('created_at', { ascending:false }),
    sb.from('company_subscriptions').select('*, companies(name)').order('created_at', { ascending:false }),
    sb.from('company_subscription_seats')
      .select('*, company_subscriptions(company_id, companies(name)), profiles(full_name,email)')
      .order('created_at', { ascending:false }).limit(200),
    sb.from('company_employees').select('company_id, profiles(full_name, email)').eq('role', 'admin')
  ])
  return NextResponse.json({
    companies: companies.data ?? [],
    subscriptions: subs.data ?? [],
    seats: seats.data ?? [],
    hrAdminsListing: hrAdminsListing.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json()
  const { type, ...data } = body

  if (type === 'company') {
    const { error } = await sb.from('companies').insert({ ...data, country: data.country ?? 'Tunisia' })
    if (error) return NextResponse.json({ error: error.message }, { status:400 })
  } else if (type === 'assign') {
    const { error } = await sb.from('company_subscription_seats').update({
      user_id: data.user_id, status: 'assigned', assigned_at: new Date().toISOString()
    }).eq('seat_id', data.seat_id)
    if (error) return NextResponse.json({ error: error.message }, { status:400 })
  } else if (type === 'unassign') {
    const { error } = await sb.from('company_subscription_seats').update({
      user_id: null, status: 'unassigned', unassigned_at: new Date().toISOString()
    }).eq('seat_id', data.seat_id)
    if (error) return NextResponse.json({ error: error.message }, { status:400 })
  } else if (type === 'invite') {
    const { error } = await sb.from('company_invites').insert({
      company_id: data.company_id, email: data.email.toLowerCase().trim()
    })
    if (error) return NextResponse.json({ error: error.message }, { status:400 })
  } else if (type === 'cancel_invite') {
    const { error } = await sb.from('company_invites').update({ status: 'cancelled' }).eq('invite_id', data.invite_id)
    if (error) return NextResponse.json({ error: error.message }, { status:400 })
  } else if (type === 'create_subscription') {
    const { data: sub, error } = await sb.from('company_subscriptions').insert({
      company_id: data.company_id,
      corporate_plan_id: data.plan_id,
      seats_purchased: data.seats,
      status: 'pending_payment',
      price_per_seat_cents: data.price_per_seat_cents
    }).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(sub)
  }
  return NextResponse.json({ ok:true })
}

export async function PATCH(req: NextRequest) {
  const sb = createAdminClient()
  const { company_id, ...updates } = await req.json()
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const { error } = await sb.from('companies').update(updates).eq('company_id', company_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
