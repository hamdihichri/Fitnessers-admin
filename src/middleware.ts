import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Allow public paths through
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next()
    }

    const token = req.cookies.get('og-session')?.value

    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
        await jwtVerify(token, getSecret())
        return NextResponse.next()
    } catch {
        // Token expired or invalid
        const res = NextResponse.redirect(new URL('/login', req.url))
        res.cookies.delete('og-session')
        return res
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
