import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { gym_id, user_id, reason } = await req.json()
    if (!gym_id || !user_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const sb = createAdminClient()
    
    // Call the RPC using service role to bypass ownership checks
    const { data, error } = await sb.rpc('unsuspend_user_from_gym', {
      p_gym_id: gym_id,
      p_user_id: user_id
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Optional: Log the reason if there's a table for it, or just return success
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
