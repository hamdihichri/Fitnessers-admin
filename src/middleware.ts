import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createAdminClient } from '@/lib/supabase'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

function handleUnauthorized(req: NextRequest) {
    const { pathname } = req.nextUrl
    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('og-session')
    res.cookies.delete('sb-access-token')
    res.cookies.delete('sb-refresh-token')
    return res
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Allow public paths & static assets through
    if (pathname.startsWith('/assets/') || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next()
    }

    const token = req.cookies.get('og-session')?.value
    if (!token) {
        return handleUnauthorized(req)
    }

    try {
        await jwtVerify(token, getSecret())
    } catch {
        return handleUnauthorized(req)
    }

    const res = NextResponse.next()

    // Transparently refresh Supabase auth token if access_token expired but refresh_token exists
    const sbAccessToken = req.cookies.get('sb-access-token')?.value
    const sbRefreshToken = req.cookies.get('sb-refresh-token')?.value

    if (!sbAccessToken && sbRefreshToken) {
        try {
            const sbAdmin = createAdminClient()
            const { data, error } = await sbAdmin.auth.refreshSession({ refresh_token: sbRefreshToken })
            if (data?.session) {
                const isProd = process.env.NODE_ENV === 'production'
                res.cookies.set('sb-access-token', data.session.access_token, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'lax',
                    maxAge: data.session.expires_in ?? 3600,
                    path: '/',
                })
                res.cookies.set('sb-refresh-token', data.session.refresh_token, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 30,
                    path: '/',
                })
            }
        } catch {
            // Non-blocking if refresh fails
        }
    }

    return res
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
