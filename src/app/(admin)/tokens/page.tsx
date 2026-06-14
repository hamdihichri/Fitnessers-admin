'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KpiCard, Card, Spinner, EmptyState, Badge, FilterBar, PageHeader, CustomSelect } from '@/components/ui'
import { fmtDateTime, fmtDate } from '@/lib/utils'
import { Wallet } from 'lucide-react'

export default function TokensPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('')
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (direction) params.set('direction', direction)
    if (reason) params.set('reason', reason)
    const res = await fetch('/api/tokens?' + params).then(r => r.json())
    setData(res); setLoading(false)
  }
  useEffect(() => { load() }, [direction, reason])

  const reasonColor: Record<string, string> = {
    checkin_charge: 'red', monthly_grant: 'green', corporate_grant: 'purple',
    adjustment: 'blue', refund: 'green', gym_earn: 'green',
  }

  const fmt = (val: number | undefined) => val?.toLocaleString() ?? '—'
  const econ = data?.economySummary

  return (
    <div className="page-enter">
      <PageHeader
        title="Token Economy"
        crumb="Tokens"
      />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={14} /> Token Economy Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard 
            label="Inactive in Vouchers" 
            value={fmt(econ?.total_inactive_voucher_tokens?.total)} 
            sub={econ ? `${econ.total_inactive_voucher_tokens.inactive_voucher_count} codes / ${econ.total_inactive_voucher_tokens.inactive_voucher_expired_count} exp.` : 'unredeemed / expired'} 
            accent="amber" 
          />
          <KpiCard 
            label="Total Activated" 
            value={fmt(econ?.total_activated_tokens)} 
            sub="lifetime tokens issued" 
            accent="purple" 
          />
          <KpiCard 
            label="Active Tokens" 
            value={fmt(econ?.total_active_tokens)} 
            sub="from active plans" 
            accent="blue" 
          />
          <KpiCard 
            label="Spent Tokens" 
            value={fmt(econ?.total_spent_tokens)} 
            sub="checkin charges" 
            accent="green" 
          />
          <KpiCard 
            label="Not Yet Spent" 
            value={fmt(econ?.total_not_spent_tokens)} 
            sub="issued but unused" 
            accent="blue" 
          />
          <KpiCard 
            label="Burned Tokens" 
            value={fmt(econ?.total_burned_tokens?.total)} 
            sub={econ ? `${fmt(econ.total_burned_tokens.burned_by_payout)} p. / ${fmt(econ.total_burned_tokens.burned_by_expiry)} e. / ${fmt(econ.total_burned_tokens.burned_by_cancellation)} c. / ${fmt(econ.total_burned_tokens.burned_other)} o.` : 'payouts / expired / canceled / other'} 
            accent="red" 
          />
          <KpiCard 
            label="Admin Granted" 
            value={fmt(econ?.total_admin_granted_tokens?.total)} 
            sub={econ ? `${fmt(econ.total_admin_granted_tokens.topup)} topup / ${fmt(econ.total_admin_granted_tokens.adjustment)} adj. / ${fmt(econ.total_admin_granted_tokens.expiry_correction)} corr.` : 'topup / adjustment / correction'} 
            accent="purple" 
          />
          <KpiCard 
            label="Free Trial Issued" 
            value={fmt(econ?.total_trial_tokens_issued?.total)} 
            sub={econ ? `${econ.total_trial_tokens_issued.grant_count} new-user grants` : 'new-user grants'} 
            accent="amber" 
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="In Circulation" value={data?.stats?.circulation ?? '—'} sub="active tokens" accent="blue" />
        <KpiCard label="Credited Today" value={data?.stats?.todayCredit != null ? '+' + data.stats.todayCredit + 'T' : '—'} sub="tokens granted" subColor="#10B981" accent="green" />
        <KpiCard label="Debited Today" value={data?.stats?.todayDebit != null ? '-' + data.stats.todayDebit + 'T' : '—'} sub="tokens spent" subColor="#EF4444" accent="red" />
        <KpiCard label="Expiring in 7d" value={data?.stats?.expiringSoon != null ? data.stats.expiringSoon + 'T' : '—'} subColor="#F59E0B" accent="amber" />
      </div>

      <Card title="Token Ledger" action={
        <div style={{ display: 'flex', gap: 8 }}>
          <CustomSelect
            style={{ fontSize: 11, padding: '4px 10px' }}
            value={direction}
            onChange={setDirection}
            options={[
              { value: '', label: 'All Directions' },
              { value: 'credit', label: 'Credit ▲' },
              { value: 'debit', label: 'Debit ▼' }
            ]}
          />
          <CustomSelect
            style={{ fontSize: 11, padding: '4px 10px' }}
            value={reason}
            onChange={setReason}
            options={[
              { value: '', label: 'All Reasons' },
              { value: 'checkin_charge', label: 'Checkin Charge' },
              { value: 'monthly_grant', label: 'Monthly Grant' },
              { value: 'corporate_grant', label: 'Corporate Grant' },
              { value: 'adjustment', label: 'Adjustment' },
              { value: 'refund', label: 'Refund' }
            ]}
          />
        </div>
      }>
        {loading ? <Spinner /> : !data?.rows?.length ? <EmptyState message="No ledger entries" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead><tr>
                <th>Date</th><th>User</th><th>Dir</th><th>Amount</th><th>Reason</th><th>Gym</th><th>Expires</th>
              </tr></thead>
              <tbody>
                {data.rows.map((l: any) => {
                  const isCredit = l.direction === 'credit'
                  const isExpired = l.expires_at && new Date(l.expires_at) < new Date()
                  return (
                    <tr key={l.ledger_id} style={{ opacity: isExpired ? 0.5 : 1 }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748B' }}>{fmtDateTime(l.created_at)}</td>
                      <td style={{ fontSize: 12 }}>{l.profile?.full_name ?? '—'}</td>
                      <td style={{ fontSize: 18 }}>
                        <span style={{ color: isCredit ? '#10B981' : '#EF4444', fontWeight: 700 }}>{isCredit ? '▲' : '▼'}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCredit ? '#10B981' : '#EF4444' }}>
                        {isCredit ? '+' : '-'}{l.amount}T
                      </td>
                      <td>
                        <Badge label={(l.reason ?? '—').replace(/_/g, ' ')} variant={(reasonColor[l.reason] ?? 'grey') as any} />
                      </td>
                      <td style={{ fontSize: 11, color: '#64748B' }}>{l.gym_id ? '#' + l.gym_id : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isExpired ? '#EF4444' : '#64748B' }}>{fmtDate(l.expires_at)}</td>
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
