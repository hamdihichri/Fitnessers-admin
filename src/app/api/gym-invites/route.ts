import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { gym_name, owner_email } = await req.json()

    if (!gym_name || !owner_email) {
      return NextResponse.json({ error: 'Missing gym_name or owner_email' }, { status: 400 })
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-gym-invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.ADMIN_FUNCTION_SECRET!,
        },
        body: JSON.stringify({
          gym_name,
          owner_email,
          actor_user_id: '51a1ea96-73b4-4a4f-be84-3575f0670366',
        }),
      }
    )

    const json = await res.json()
    return NextResponse.json(json, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
