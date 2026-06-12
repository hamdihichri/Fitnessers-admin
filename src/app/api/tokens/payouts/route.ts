import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const sb = createAdminClient()
    const status = req.nextUrl.searchParams.get('status')

    let query = sb.from('gym_payouts')
        .select(`
      payout_id,
      gym_id,
      amount,
      status,
      created_at,
      paid_at,
      notes,
      gym:gyms(name, city)
    `)
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
    const sb = createAdminClient()
    const { payout_id, status, notes } = await req.json()

    const updates: any = { status }
    if (status === 'paid') {
        updates.paid_at = new Date().toISOString()
        updates.notes = notes
    }

    const { error } = await sb.from('gym_payouts')
        .update(updates)
        .eq('payout_id', payout_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
}
