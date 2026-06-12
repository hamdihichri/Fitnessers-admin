import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    const sb = createAdminClient()

    const { count, error } = await sb
        .from('gym_women_only_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ count: count || 0 })
}
