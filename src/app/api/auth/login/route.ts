import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

export async function POST(req: NextRequest) {
    const { email, password } = await req.json()

    const validEmail = process.env.ADMIN_EMAIL ?? ''
    const validPassword = process.env.ADMIN_PASSWORD ?? ''

    if (
        !email || !password ||
        email.trim().toLowerCase() !== validEmail.toLowerCase() ||
        password !== validPassword
    ) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Sign a JWT valid for 24 hours
    const token = await new SignJWT({ email, role: 'superadmin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret())

    const res = NextResponse.json({ ok: true })
    res.cookies.set('og-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    })
    return res
}
