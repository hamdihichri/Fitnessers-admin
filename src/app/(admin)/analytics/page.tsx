'use client'
import { useEffect, useState } from 'react'
import { Card, Spinner, PageHeader, StatPill, Badge } from '@/components/ui'
import { fmtTND } from '@/lib/utils'
import { TrendingUp, Activity, Users, Building2 } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'

function BarChart({ data, formatter = (v: number) => String(v), color = 'var(--accent-blue)' }: {
  data: { label: string; value: number }[]
  formatter?: (v: number) => string
  color?: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            {d.value > 0 ? formatter(d.value) : ''}
          </div>
          <div
            style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              background: color === 'var(--accent-blue)' ? 'rgba(215,242,244,0.18)' : 'rgba(16,185,129,0.15)',
              height: `${Math.max((d.value / max) * 80, 3)}%`,
              transition: 'height 0.6s var(--ease-out-expo)',
              cursor: 'default',
            }}
            title={`${d.label}: ${formatter(d.value)}`}
          />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.2, marginTop: 2 }}>
            {d.label.slice(-5)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fee Settings State
  const [feeBps, setFeeBps] = useState<number>(1000)
  const [feeInput, setFeeInput] = useState<string>('10')
  const [savingFee, setSavingFee] = useState(false)


  async function load() {
    setLoading(true)
    const d = await fetchJson('/api/analytics')
    setData(d)
    
    // Initialize fee state
    if (d?.feeBps !== undefined) {
      setFeeBps(d.feeBps)
      setFeeInput((d.feeBps / 100).toFixed(1))
    }
    
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const revenueData = (data?.revenueByMonth ?? []).map((r: any) => ({
    label: r.month, value: r.cents / 100
  }))
  const checkinData = (data?.checkinsByDay ?? []).map((c: any) => ({
    label: c.day.slice(5), value: c.count
  }))

  const totalRevenue = data?.totalRevenueCents ?? 0

  // Save handler
  async function saveFee() {
    setSavingFee(true)
    const bps = Math.round(parseFloat(feeInput) * 100)
    if (isNaN(bps) || bps < 0 || bps > 5000) {
      setSavingFee(false)
      return
    }
    try {
      await fetch('/api/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'gym_withdraw_fee_bps', value_int: bps })
      })
      setFeeBps(bps)
    } finally {
      setSavingFee(false)
    }
  }


  return (
    <div className="page-enter">
      <PageHeader title="Analytics" crumb="Analytics" actions={
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      } />

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Gyms', value: data?.totalGyms ?? '—', icon: Building2, color: 'var(--accent-blue)' },
          { label: 'Total Users', value: data?.totalUsers ?? '—', icon: Users, color: '#8B5CF6' },
          { label: 'Active Subs', value: data?.activeSubs ?? '—', icon: TrendingUp, color: '#10B981' },
          { label: 'Total Check-ins', value: data?.totalCheckins ?? '—', icon: Activity, color: '#F59E0B' },
          { label: 'Total Revenue', value: loading ? '—' : fmtTND(totalRevenue), icon: TrendingUp, color: '#10B981' },
        ].map(kpi => (
          <div key={kpi.label} className="og-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>{kpi.label}</span>
              <kpi.icon size={14} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {loading ? '…' : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Fee Settings Section */}
      <div style={{ marginBottom: 20 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1 }}>
                WITHDRAWAL FEE RATE
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{(feeBps / 100).toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Applied to all new withdrawal requests
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min="0" max="50" step="0.5"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>%</span>
              <button className="btn btn-primary btn-sm" onClick={saveFee} disabled={savingFee}>
                {savingFee ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      </div>


      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Revenue — Last 6 Months">
          {loading ? <Spinner /> : (
            <BarChart
              data={revenueData}
              formatter={(v) => fmtTND(v * 100)}
              color="var(--accent-blue)"
            />
          )}
        </Card>
        <Card title="Check-ins — Last 7 Days">
          {loading ? <Spinner /> : (
            <BarChart
              data={checkinData}
              formatter={(v) => String(v)}
              color="green"
            />
          )}
        </Card>
      </div>

      {/* Plans + Top Gyms */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Subscription Plans">
          {loading ? <Spinner /> : (
            <div>
              {(data?.plans ?? []).map((plan: any) => (
                <div key={plan.plan_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{plan.billing_period} · {plan.tokens_per_period}T</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10B981', fontSize: 15 }}>
                    {fmtTND(plan.price_cents)}
                  </div>
                </div>
              ))}
              {(data?.plans ?? []).length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No plans found</div>}
            </div>
          )}
        </Card>

        <Card title="Top Gyms by Activity">
          {loading ? <Spinner /> : (
            <div>
              {(data?.topGyms ?? []).map((gym: any, i: number) => (
                <div key={gym.gym_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: i < 3 ? 'rgba(215,242,244,0.15)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i < 3 ? 'var(--accent-blue)' : 'var(--text-muted)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gym.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gym.city}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {gym.count} check-ins
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
