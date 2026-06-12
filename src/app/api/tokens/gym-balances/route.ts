import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const sb = createAdminClient()

    // 1. Fetch all gyms
    const { data: gyms, error: gymsError } = await sb.from('gyms')
        .select('gym_id,name,city,venue_type')
        .is('deleted_at', null)

    if (gymsError) return NextResponse.json({ error: gymsError.message }, { status: 500 })

    // 2. Fetch gym_earn credits (what gym actually earned, not raw checkin charges)
    const { data: ledger, error: ledgerError } = await sb.from('token_ledger')
        .select('gym_id,amount')
        .eq('reason', 'gym_earn')
        .eq('direction', 'credit')
        .not('gym_id', 'is', null)

    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 })

    // 3. Fetch all paid payouts from token_ledger (payout_disbursed debits)
    const { data: payouts, error: payoutsError } = await sb.from('token_ledger')
        .select('gym_id,amount')
        .eq('reason', 'payout_disbursed')
        .eq('direction', 'debit')
        .not('gym_id', 'is', null)

    if (payoutsError) {
        console.error('Failed to fetch payout_disbursed:', payoutsError.message)
    }

    // 4. Aggregate earnings
    const earnings: Record<string, number> = {}
    ledger.forEach(entry => {
        const gid = String(entry.gym_id)
        earnings[gid] = (earnings[gid] || 0) + entry.amount
    })

    // 5. Aggregate paid payouts
    const withdrawn: Record<string, number> = {}
    if (payouts) {
        payouts.forEach(p => {
            const gid = String(p.gym_id)
            withdrawn[gid] = (withdrawn[gid] || 0) + p.amount
        })
    }

    // 6. Combine data
    const result = gyms.map(gym => {
        const gid = String(gym.gym_id)
        const collected = earnings[gid] || 0
        const paid = withdrawn[gid] || 0
        const currentBalance = Math.max(0, collected - paid)

        return {
            ...gym,
            total_collected: collected,
            total_withdrawn: paid,
            balance: currentBalance,
            estimated_value: currentBalance * 0.5
        }
    })

    // Sort by balance descending
    result.sort((a, b) => b.balance - a.balance)

    return NextResponse.json(result)
}
