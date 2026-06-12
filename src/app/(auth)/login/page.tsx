'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabaseBrowser'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error ?? 'Login failed')
                setLoading(false)
                return
            }

            const sb = createBrowserClient()
            const { error: sbErr } = await sb.auth.signInWithPassword({ email, password })
            if (sbErr) {
                await fetch('/api/auth/logout', { method: 'POST' })
                setError('Supabase session failed: ' + sbErr.message)
                setLoading(false)
                return
            }
            router.replace('/dashboard')
        } catch {
            setError('Network error. Please try again.')
            setLoading(false)
        }
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>

            {/* Background grid decoration */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(79,107,244,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(79,107,244,0.04) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
            }} />

            {/* Glow blobs */}
            <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,107,244,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Left panel — branding */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '60px 64px', position: 'relative',
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                        background: 'linear-gradient(135deg, #2D3FBF, #4F6BF4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(79,107,244,0.3)',
                    }}>
                        <Dumbbell size={22} color="#fff" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.4px', color: 'var(--text-primary)' }}>Fitnessers</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Panel</div>
                    </div>
                </div>

                <h1 style={{ fontWeight: 800, fontSize: 40, letterSpacing: '-1px', lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: 16, maxWidth: 420 }}>
                    Superadmin<br />
                    <span style={{ background: 'linear-gradient(90deg, #4F6BF4, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Control Center
                    </span>
                </h1>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 380 }}>
                    Manage gyms, users, payments, and the full platform from one place.
                    Restricted to authorised administrators only.
                </p>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 32, marginTop: 48 }}>
                    {[
                        { label: 'Gyms', icon: '🏋️' },
                        { label: 'Users', icon: '👤' },
                        { label: 'Payments', icon: '💳' },
                        { label: 'Tokens', icon: '🪙' },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel — form */}
            <div style={{
                width: 440, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px 40px',
            }}>
                <div style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: '40px 36px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
                }}>
                    {/* Form header */}
                    <div style={{ marginBottom: 32 }}>
                        <h2 style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 6, color: 'var(--text-primary)' }}>
                            Sign in
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Enter your admin credentials to continue
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 9,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 10, padding: '12px 14px', marginBottom: 20,
                            color: '#EF4444', fontSize: 13, fontWeight: 500,
                        }}>
                            <AlertCircle size={15} style={{ flexShrink: 0 }} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                        {/* Email */}
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                                Admin Email
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="admin@fitnessers.com"
                                    required
                                    autoComplete="email"
                                    className="og-input"
                                    style={{ width: '100%', paddingLeft: 38 }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="og-input"
                                    style={{ width: '100%', paddingLeft: 38, paddingRight: 40 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(v => !v)}
                                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                                >
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: 8,
                                width: '100%', padding: '12px', borderRadius: 10,
                                background: loading ? 'rgba(79,107,244,0.5)' : 'linear-gradient(135deg, #4F6BF4, #6B83F6)',
                                color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontFamily: 'var(--font-jakarta)',
                                transition: 'all 0.2s',
                                boxShadow: loading ? 'none' : '0 4px 16px rgba(79,107,244,0.35)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            {loading ? (
                                <>
                                    <div className="spin" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                                    Signing in...
                                </>
                            ) : 'Sign in →'}
                        </button>
                    </form>

                    {/* Footer note */}
                    <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        🔒 Restricted to authorised admins only
                    </div>
                </div>
            </div>
        </div>
    )
}
