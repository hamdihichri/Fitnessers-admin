import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    const sb = createAdminClient()

    // Aggregate attention-required items
    const [gyms, payments, payouts, errors] = await Promise.all([
        // 1. Pending Gym Verifications
        sb.from('gyms')
            .select('gym_id, name, created_at')
            .eq('rne_verified', false)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(10),

        // 2. Pending Subscription Payments
        sb.from('subscription_payments')
            .select('payment_id, amount_cents, created_at, profiles(full_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10),

        // 3. Pending Gym Payouts
        sb.from('gym_payouts')
            .select('payout_id, amount, created_at, gyms(name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10),

        // 4. Recent Job Errors (Last 24h)
        sb.from('job_run_logs')
            .select('run_id, job_name, started_at')
            .eq('status', 'error')
            .gt('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('started_at', { ascending: false })
            .limit(5)
    ])

    const notifications = [
        ...(gyms.data || []).map(g => ({
            id: `gym-${g.gym_id}`,
            type: 'gym',
            title: 'New Gym Verification',
            message: `${g.name} is awaiting RNE verification.`,
            time: g.created_at,
            link: '/gyms?status=pending'
        })),
        ...(payments.data || []).map(p => ({
            id: `pay-${p.payment_id}`,
            type: 'payment',
            title: 'Pending Payment',
            message: `${(p as any).profiles?.full_name || 'System'} paid ${(p.amount_cents / 100).toFixed(2)} TND.`,
            time: p.created_at,
            link: '/payments?status=pending'
        })),
        ...(payouts.data || []).map(po => ({
            id: `payout-${po.payout_id}`,
            type: 'payout',
            title: 'Withdrawal Request',
            message: `${(po as any).gyms?.name || 'Gym'} requested ${po.amount} Tokens.`,
            time: po.created_at,
            link: '/tokens/payouts'
        })),
        ...(errors.data || []).map(e => ({
            id: `err-${e.run_id}`,
            type: 'error',
            title: 'System Job Failure',
            message: `Job ${e.job_name} failed. Check monitoring.`,
            time: e.started_at,
            link: '/monitoring'
        }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    return NextResponse.json({
        notifications,
        count: notifications.length
    })
}
