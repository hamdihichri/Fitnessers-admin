import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    const sb = createAdminClient()

    // 1. Fetch requests
    const { data: requests, error: rErr } = await sb.from('gym_women_only_change_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })
    if (!requests?.length) return NextResponse.json([])

    // 2. Extract IDs for batch fetching
    const gymIds = [...new Set(requests.map(r => r.gym_id))]
    const userIds = [...new Set(requests.map(r => r.requested_by))]

    // 3. Fetch gyms and profiles in parallel
    const [gyms, profiles] = await Promise.all([
        sb.from('gyms').select('gym_id, name, city, women_only').in('gym_id', gymIds),
        sb.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
    ])

    // 4. Create lookup maps
    const gymMap = Object.fromEntries((gyms.data ?? []).map(g => [g.gym_id, g]))
    const profileMap = Object.fromEntries((profiles.data ?? []).map(p => [p.user_id, p]))

    // 5. Join manually
    const results = requests.map(r => ({
        ...r,
        gyms: gymMap[r.gym_id] || null,
        profiles: profileMap[r.requested_by] || null
    }))

    return NextResponse.json(results)
}

import { jwtVerify } from 'jose'

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

/**
 * POST body: { request_id, action: 'approve'|'reject', notes?: string }
 */
export async function POST(req: NextRequest) {
    const sb = createAdminClient()
    const { request_id, action, notes = '' } = await req.json()

    if (!request_id || !action) {
        return NextResponse.json({ error: 'request_id and action are required' }, { status: 400 })
    }
    if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    // 1. Get the current admin's identity from JWT
    const token = req.cookies.get('og-session')?.value
    let adminEmail = 'admin@fitnessers.com' // Fallback
    if (token) {
        try {
            const { payload } = await jwtVerify(token, getSecret())
            adminEmail = (payload.email as string) || 'admin@fitnessers.com'
        } catch (e) {
            console.error('JWT verify failed in POST:', e)
        }
    }

    // 1.5. Lookup the UUID for this admin email
    const { data: adminProfile } = await sb
        .from('profiles')
        .select('user_id')
        .eq('email', adminEmail)
        .single()
    const reviewedBy = adminProfile?.user_id || request_id // fallback to anything valid if profile missing, but profiled lookup is safer

    // 2. Fetch the request to get gym_id and requested_value
    const { data: request, error: fetchErr } = await sb
        .from('gym_women_only_change_requests')
        .select('*')
        .eq('request_id', request_id)
        .single()

    if (fetchErr || !request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // 3. Update the request status
    const status = action === 'approve' ? 'approved' : 'rejected'
    const { error: updateErr } = await sb
        .from('gym_women_only_change_requests')
        .update({
            status,
            review_notes: notes,
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewedBy,
            requested_by: request.requested_by // Explicitly preserve to avoid trigger issues
        })
        .eq('request_id', request_id)

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    // 4. If approved, apply the change to the gym
    if (action === 'approve') {
        const { error: gymErr } = await sb
            .from('gyms')
            .update({ women_only: request.requested_value })
            .eq('gym_id', request.gym_id)

        if (gymErr) {
            return NextResponse.json({ error: `Request approved but failed to update gym: ${gymErr.message}` }, { status: 400 })
        }
    }

    return NextResponse.json({ ok: true })
}
