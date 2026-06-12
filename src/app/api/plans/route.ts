import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    const sb = createAdminClient()
    const { data: plans, error } = await sb.from('plans')
        .select('plan_id,name,price_cents,billing_period,tokens_per_period')
        .order('price_cents', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(plans)
}

export async function PATCH(req: NextRequest) {
    const sb = createAdminClient()
    const { plan_id, ...updates } = await req.json()

    if (!plan_id) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })

    const { error } = await sb.from('plans').update(updates).eq('plan_id', plan_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
}
