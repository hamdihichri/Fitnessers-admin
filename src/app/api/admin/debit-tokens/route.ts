import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { user_id, amount, reason } = await req.json()
    if (!user_id || !amount) {
      return NextResponse.json({ error: { message: 'user_id and amount required' } }, { status: 400 })
    }

    const sb = createServerClient(req)
    const { data, error } = await sb.rpc('admin_debit_tokens', {
      p_user_id: user_id,
      p_amount: amount,
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
