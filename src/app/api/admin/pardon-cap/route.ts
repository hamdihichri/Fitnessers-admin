import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { gym_id, user_id, reason } = await req.json()
    if (!gym_id || !user_id) {
      return NextResponse.json({ error: { message: 'gym_id and user_id required' } }, { status: 400 })
    }

    const sb = createServerClient(req)
    const { data, error } = await sb.rpc('superadmin_pardon_cap', {
      p_gym_id: gym_id,
      p_user_id: user_id,
      p_reason: reason,
    })

    if (error) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 })
    }

    return NextResponse.json({ data, error: null })
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}
