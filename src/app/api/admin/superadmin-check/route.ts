import { requireSuperadminSession } from '@/lib/adminAuth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await requireSuperadminSession()
    return NextResponse.json({ ok: true, is_superadmin: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ ok: false, is_superadmin: false, error: msg }, { status: 200 })
  }
}

