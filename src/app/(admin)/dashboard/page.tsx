'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KpiCard, Card, Spinner, Badge, UserCell, providerBadge, PageHeader } from '@/components/ui'
import { fmtDate, fmtTND, timeAgo } from '@/lib/utils'
import { RefreshCw, TrendingUp, Activity, Users } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, padding: '0 4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                background: 'rgba(215,242,244,0.18)',
                height: `${Math.max((d.value / max) * 100, 4)}%`,
                transition: 'height 0.6s var(--ease-out-expo)',
                position: 'relative',
              }}
              title={`${d.label}: ${d.value}`}
            />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1 }}>{d.label.slice(-2)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [s, p, m, a] = await Promise.all([
      fetchJson('/api/dashboard'),
      fetchJson('/api/payments?status=pending'),
      fetchJson('/api/monitoring'),
      fetchJson('/api/analytics'),
    ])
    setStats(s); setPayments(Array.isArray(p) ? p.slice(0, 6) : []); setHealth(m); setAnalytics(a)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const jobErrors = health ? health.jobLogs.filter((j: any) => j.status === 'error').length : 0
  const cronFails = health ? health.cronAudit.filter((c: any) => !c.ok).length : 0
  const checkinRate = stats?.bookingsToday > 0 ? Math.round((stats.checkinsToday / stats.bookingsToday) * 100) : 0

  const signupChartData = (analytics?.signupsByMonth ?? []).map((r: any) => ({
    label: r.month, value: r.count
  }))
  const activeSubsChartData = (analytics?.activeSubsByMonth ?? []).map((r: any) => ({
    label: r.month, value: r.count
  }))

  return (
    <div className="page-enter">
      <PageHeader
        title="Overview"
        crumb="Dashboard"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ gap: 6 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Gyms" value={stats?.totalGyms ?? '—'} sub={stats ? `${stats.pendingGyms} pending` : ''} subColor={stats?.pendingGyms > 0 ? '#F59E0B' : 'var(--text-muted)'} accent="blue" />
        <KpiCard label="Total Users" value={stats?.totalUsers ?? '—'} sub="registered" accent="green" />
        <KpiCard label="Active Subs" value={stats?.activeSubscriptions ?? '—'} sub="subscriptions" accent="purple" />
        <KpiCard label="Bookings Today" value={stats?.bookingsToday ?? '—'} sub="sessions booked" accent="amber" />
        <KpiCard label="Check-ins Today" value={stats?.checkinsToday ?? '—'} sub={`${checkinRate}% rate`} subColor={checkinRate > 60 ? '#10B981' : 'var(--text-muted)'} accent="green" />
        <KpiCard label="Pending Payments" value={stats?.pendingPayments ?? '—'} sub={stats ? fmtTND(stats.pendingPaymentsAmount) : ''} subColor={stats?.pendingPayments > 0 ? '#F59E0B' : 'var(--text-muted)'} accent="red" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>User Signups — Last 6 Months</span>
              </div>
              {analytics && (
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: analytics.signupGrowth >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: analytics.signupGrowth >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {analytics.signupGrowth >= 0 ? '+' : ''}{analytics.signupGrowth}% vs last month
                </span>
              )}
            </div>
            {analytics ? <BarChart data={signupChartData} label="New Users per Month" /> : <Spinner />}
          </div>
        </Card>
        <Card>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} style={{ color: '#10B981' }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Active Subscriptions — Last 6 Months</span>
              </div>
              {analytics && (
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: analytics.subsGrowth >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: analytics.subsGrowth >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {analytics.subsGrowth >= 0 ? '+' : ''}{analytics.subsGrowth}% vs last month
                </span>
              )}
            </div>
            {analytics ? <BarChart data={activeSubsChartData} label="New Subs per Month" /> : <Spinner />}
          </div>
        </Card>
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Pending Payments */}
        <Card title="Pending Payments" action={<a href="/payments" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>View all →</a>}>
          {loading ? <Spinner /> : payments.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>🎉 No pending payments</div>
          ) : (
            <div>
              {payments.map((p: any) => (
                <div 
                  key={p.withdraw_id} 
                  onClick={() => router.push('/payments')}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.gyms?.name ?? 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gyms?.city}, {p.gyms?.country}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', fontSize: 13, flexShrink: 0 }}>{fmtTND(p.requested_amount_cents)}</div>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' 
                  }}>
                    {new Date(p.request_month).toLocaleDateString('fr-TN', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* System Health */}
        <Card title="System Health" action={<a href="/monitoring" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Details →</a>}>
          {!health ? <Spinner /> : (
            <div style={{ padding: '4px 0' }}>
              {[
                { label: 'Job Runner', dot: jobErrors === 0 ? 'green' : 'red', value: jobErrors === 0 ? 'Healthy' : `${jobErrors} errors`, sub: health.jobLogs[0] ? timeAgo(health.jobLogs[0].started_at) : 'No data' },
                { label: 'Cron Audit', dot: cronFails === 0 ? 'green' : 'amber', value: cronFails === 0 ? 'All OK' : `${cronFails} failures`, sub: 'Last 50 runs' },
                { label: 'Token Ledger', dot: 'green', value: 'Connected', sub: `${health.totalJobRows.toLocaleString()} log rows` },
                { label: 'Database', dot: 'green', value: 'Live', sub: 'Service role connected' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className={`h-dot h-dot-${row.dot}`} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.sub}</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: row.dot === 'green' ? '#10B981' : row.dot === 'red' ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent job logs */}
      <Card title="Recent Job Activity">
        {!health ? <Spinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead><tr>
                <th>Job Name</th><th>Status</th><th>Started</th><th>Duration</th><th>Message</th>
              </tr></thead>
              <tbody>
                {health.jobLogs.slice(0, 8).map((j: any) => (
                  <tr key={j.run_id} className={j.status === 'error' ? 'row-error' : ''}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)' }}>{j.job_name}</td>
                    <td><Badge label={j.status} /></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{timeAgo(j.started_at)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{j.duration_ms ? j.duration_ms + 'ms' : '—'}</td>
                    <td style={{ fontSize: 11, color: j.status === 'error' ? '#EF4444' : 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {j.error_message || j.message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
