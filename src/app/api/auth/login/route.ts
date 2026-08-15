import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createAdminClient } from '@/lib/supabase'

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

    const cleanEmail = email.trim().toLowerCase()
    const sbAdmin = createAdminClient()

    // 1. Ensure user exists in Supabase Auth
    let linkRes = await sbAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: cleanEmail,
    })

    if (linkRes.error) {
        if (linkRes.error.message.includes('User not found')) {
            // Create user in auth.users if not present
            const createRes = await sbAdmin.auth.admin.createUser({
                email: cleanEmail,
                email_confirm: true,
                user_metadata: { role: 'superadmin' },
            })
            if (createRes.data?.user) {
                // Also ensure superadmin record exists in profiles if profiles table is used
                await sbAdmin.from('profiles').upsert({
                    user_id: createRes.data.user.id,
                    email: cleanEmail,
                    full_name: 'Super Admin',
                    role: 'superadmin',
                    is_superadmin: true,
                }, { onConflict: 'user_id' }).select()

                linkRes = await sbAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: cleanEmail,
                })
                if (linkRes.error) {
                    console.error('[auth/login] Supabase session mint failed on generateLink retry:', linkRes.error.message, linkRes.error)
                }
            } else if (createRes.error) {
                console.error('[auth/login] Supabase session mint failed on createUser:', createRes.error.message, createRes.error)
            }
        } else {
            console.error('[auth/login] Supabase session mint failed:', linkRes.error.message, linkRes.error)
        }
    }

    let supabaseSession = null
    if (linkRes.data?.properties?.email_otp) {
        const verifyRes = await sbAdmin.auth.verifyOtp({
            email: cleanEmail,
            token: linkRes.data.properties.email_otp,
            type: 'magiclink',
        })
        if (verifyRes.data?.session) {
            supabaseSession = verifyRes.data.session
        } else {
            console.error('[auth/login] Supabase session mint failed at verifyOtp:', verifyRes.error?.message || 'No session returned', verifyRes.error)
        }
    }

    // Sign custom JWT valid for 24 hours (og-session gateway token)
    const token = await new SignJWT({ email: cleanEmail, role: 'superadmin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret())

    const res = NextResponse.json({ ok: true, supabaseSessionActive: !!supabaseSession })
    const isProd = process.env.NODE_ENV === 'production'

    res.cookies.set('og-session', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    })

    if (supabaseSession) {
        res.cookies.set('sb-access-token', supabaseSession.access_token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge: supabaseSession.expires_in ?? 3600,
            path: '/',
        })
        res.cookies.set('sb-refresh-token', supabaseSession.refresh_token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        })
    }

    return res
}

