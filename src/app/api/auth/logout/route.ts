import { NextResponse } from 'next/server'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 0,
        path: '/',
    }
    res.cookies.set('og-session', '', cookieOpts)
    res.cookies.set('sb-access-token', '', cookieOpts)
    res.cookies.set('sb-refresh-token', '', cookieOpts)
    return res
}
