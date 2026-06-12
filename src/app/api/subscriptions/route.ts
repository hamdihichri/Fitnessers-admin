export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const sb = createAdminClient()
    const status = req.nextUrl.searchParams.get('status')
    const debug = req.nextUrl.searchParams.get('debug')

    if (debug) {
        const { data } = await sb.from('subscriptions').select('*').limit(1)
        return NextResponse.json(data?.[0] || { message: 'no data' })
    }

    let query = sb.from('subscriptions')
        .select('subscription_id,user_id,plan_id,status,started_at,current_period_end,plans(name,price_cents,billing_period,tokens_per_period),profiles(full_name,email,phone_number,city)')
        .order('started_at', { ascending: false })
        .limit(300)

    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
    const sb = createAdminClient()
    const { subscription_id, status } = await req.json()
    if (!subscription_id) return NextResponse.json({ error: 'subscription_id required' }, { status: 400 })

    const updates: Record<string, unknown> = { status }
    if (status === 'expired') updates.current_period_end = new Date().toISOString()

    const { error } = await sb.from('subscriptions').update(updates).eq('subscription_id', subscription_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
}
