import { createAdminClient, createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const tab = req.nextUrl.searchParams.get('status') || 'all'

  let query = sb.from('gym_withdraw_requests')
    .select(`
      withdraw_id,
      gym_id,
      request_month,
      requested_amount_cents,
      platform_fee_bps,
      platform_fee_cents,
      payout_amount_cents,
      status,
      created_at,
      updated_at,
      paid_at,
      bank_rib_snapshot,
      bank_rib_name_snapshot,
      bank_tx_ref,
      processed_by,
      rejected_reason,
      gyms!gym_withdraw_requests_gym_id_fkey (
        name,
        city,
        country
      )
    `)
    .order('created_at', { ascending: false }).limit(300)

  if (tab === 'pending') {
    query = query.eq('status', 'requested')
  } else if (tab === 'confirmed') {
    query = query.in('status', ['paid', 'locked'])
  } else if (tab === 'rejected') {
    query = query.eq('status', 'rejected')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify token and get user
  const { data: { user }, error: authError } = await createAdminClient().auth.getUser(bearer)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify superadmin
  const { data: adminRow } = await createAdminClient()
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .single()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { payment_id, status, bank_tx_ref } = await req.json()
  const paid_at = (status === 'paid' || status === 'confirmed')
    ? new Date().toISOString()
    : null
  const finalStatus = (status === 'confirmed') ? 'paid' : status

  // ✅ Use a user-scoped client so auth.uid() resolves inside the RPC
  // The service role client has no JWT context — auth.uid() returns NULL
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
      },
    }
  )

  const { error } = await userClient.rpc('update_withdraw_as_superadmin', {
    p_withdraw_id: payment_id,
    p_status: finalStatus,
    p_paid_at: paid_at,
    p_user_id: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (finalStatus === 'paid') {
    const updatePayload: any = { processed_by: user.id }
    if (bank_tx_ref) {
      updatePayload.bank_tx_ref = bank_tx_ref
    }
    const { error: updateError } = await createAdminClient()
      .from('gym_withdraw_requests')
      .update(updatePayload)
      .eq('withdraw_id', payment_id)
    if (updateError) {
      console.error('Failed to update bank_tx_ref/processed_by:', updateError)
    }
  }

  return NextResponse.json({ ok: true })
}