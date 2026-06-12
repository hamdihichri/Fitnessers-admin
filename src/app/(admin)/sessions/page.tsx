'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, FilterBar, PageHeader } from '@/components/ui'
import { Search, RefreshCw, Clock, Users, Tag, Ticket } from 'lucide-react'

function fmt(t?: string | null) {
    return t ? t.slice(0, 5) : '—'
}

function formatPrice(val?: number | null) {
    if (val == null) return '—'
    return val.toLocaleString('fr-DZ', { minimumFractionDigits: 0 }) + ' tok'
}

export default function SessionsPage() {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [showOnlyCurrent, setShowOnlyCurrent] = useState(true)

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const data = await fetch('/api/sessions?t=' + Date.now(), { cache: 'no-store' }).then(res => res.json())
            if (data.error) {
                setError(data.error)
                setData([])
            } else {
                setData(Array.isArray(data) ? data : [])
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const id = setInterval(load, 60_000)
        return () => clearInterval(id)
    }, [])

    const filtered = useMemo(() =>
        data.filter(item => {
            const q = search.toLowerCase()
            const matchesSearch = !q ||
                item.gym_name?.toLowerCase().includes(q) ||
                item.city?.toLowerCase().includes(q)

            if (showOnlyCurrent) {
                return matchesSearch && item.is_current
            }
            return matchesSearch
        }),
        [data, search, showOnlyCurrent]
    )

    const totalBookings = data.reduce((s, i) => s + i.bookings_count, 0)
    const totalCheckins = data.reduce((s, i) => s + i.checkins_count, 0)

    return (
        <div className="page-enter">
            <PageHeader title="Live Sessions" crumb="Sessions" />

            <FilterBar>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="og-input"
                        style={{ paddingLeft: 30, width: '100%' }}
                        placeholder="Search gym or city…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={showOnlyCurrent}
                            onChange={e => setShowOnlyCurrent(e.target.checked)}
                            style={{ width: 14, height: 14 }}
                        />
                        Happening Now
                    </label>
                </div>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={12} /> Refresh
                </button>
            </FilterBar>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <StatPill label="Total Open Today" value={data.length} />
                <StatPill label="Happening Now" value={data.filter(i => i.is_current).length} />
                <StatPill label="Filtered" value={filtered.length} />
            </div>

            {error && (
                <div className="alert-banner alert-red" style={{ marginBottom: 16 }}>
                    <span>❌</span>
                    <span><strong>Database Error:</strong> {error}</span>
                </div>
            )}

            <Card>
                {loading ? <Spinner /> : filtered.length === 0 ? (
                    <EmptyState message={error ? 'Error loading data' : 'No sessions are currently open'} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="og-table">
                            <thead>
                                <tr>
                                    <th>Gym</th>
                                    <th>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Time Window</span>
                                    </th>
                                    <th>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={11} /> Default Price</span>
                                    </th>
                                    <th>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ticket size={11} /> Session Price</span>
                                    </th>
                                    <th>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> Bookings</span>
                                    </th>
                                    <th>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> Check-ins</span>
                                    </th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item: any) => {
                                    const s = item.active_session
                                    const hasDiscount =
                                        s.discounted_token_price != null &&
                                        item.default_token_price != null &&
                                        s.discounted_token_price < item.default_token_price

                                    return (
                                        <tr key={item.gym_id + '-' + s.weekly_session_id}>
                                            {/* Gym */}
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.gym_name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.city}</div>
                                                {s.women_only && (
                                                    <Badge label="Women only" variant="purple" />
                                                )}
                                            </td>

                                            {/* Time window */}
                                            <td>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                                    {fmt(s.start_time)} – {fmt(s.end_time)}
                                                </span>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.duration_minutes} min</div>
                                            </td>

                                            {/* Default price */}
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                                                {formatPrice(item.default_token_price)}
                                            </td>

                                            {/* Session / discounted price */}
                                            <td>
                                                {s.discounted_token_price != null ? (
                                                    <span style={{
                                                        fontFamily: 'var(--font-mono)',
                                                        fontSize: 13,
                                                        color: hasDiscount ? 'var(--accent-green)' : 'inherit',
                                                        fontWeight: hasDiscount ? 600 : 400,
                                                    }}>
                                                        {formatPrice(s.discounted_token_price)}
                                                        {hasDiscount && (
                                                            <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--accent-green)', opacity: 0.8 }}>↓</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                                )}
                                            </td>

                                            {/* Bookings */}
                                            <td style={{ textAlign: 'center' }}>
                                                <Badge label={String(item.bookings_count)} variant={item.bookings_count > 0 ? 'blue' : 'grey'} />
                                            </td>

                                            {/* Check-ins */}
                                            <td style={{ textAlign: 'center' }}>
                                                <Badge label={String(item.checkins_count)} variant={item.checkins_count > 0 ? 'green' : 'grey'} />
                                            </td>

                                            {/* Status */}
                                            <td>
                                                <Badge label="🟢 live" variant="green" />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    )
}
