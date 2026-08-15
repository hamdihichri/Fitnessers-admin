import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { user_id, subscription_id, reason } = await req.json()
    if (!user_id || !subscription_id) {
      return NextResponse.json({ error: { message: 'user_id and subscription_id required' } }, { status: 400 })
    }

    const sb = createServerClient(req)
    const { data, error } = await sb.rpc('admin_cancel_subscription', {
      p_user_id: user_id,
      p_subscription_id: subscription_id,
      p_reason: reason ?? null,
    })

    if (error) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 })
    }

    return NextResponse.json({ data, error: null })
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}
