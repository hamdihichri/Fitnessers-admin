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

  return (
    <div className="page-enter">
      <PageHeader
        title="Token Economy"
        crumb="Tokens"
      />

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
