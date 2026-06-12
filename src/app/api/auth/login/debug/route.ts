import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    const sb = createAdminClient()
    const { data, error } = await sb.from('subscriptions').select('*').limit(1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data?.[0] || { message: 'no data' })
}
