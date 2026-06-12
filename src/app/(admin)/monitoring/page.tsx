'use client'
import { useEffect, useState } from 'react'
import { Card, Spinner, Badge, Tabs, PageHeader } from '@/components/ui'
import { fmtDate, timeAgo } from '@/lib/utils'

export default function MonitoringPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('jobs')

  async function load() {
    setLoading(true)
    const d = await fetch('/api/monitoring').then(r => r.json())
    setData(d); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const jobErrors = data?.jobLogs?.filter((j: any) => j.status === 'error').length ?? 0
  const cronFails = data?.cronAudit?.filter((c: any) => !c.ok).length ?? 0

  return (
    <div className="page-enter">
      <PageHeader title="System Monitoring" crumb="Monitoring" actions={
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      } />

      {/* Health summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Job Runner', status: jobErrors === 0 ? 'ok' : 'error', value: jobErrors === 0 ? 'Healthy' : `${jobErrors} errors`, dot: jobErrors === 0 ? 'green' : 'red' },
          { label: 'Cron Schedules', status: cronFails === 0 ? 'ok' : 'warn', value: cronFails === 0 ? 'All OK' : `${cronFails} failures`, dot: cronFails === 0 ? 'green' : 'amber' },
          { label: 'Total Job Runs', status: 'ok', value: data?.totalJobRows?.toLocaleString() ?? '—', dot: 'green' },
          { label: 'Database', status: 'ok', value: 'Connected', dot: 'green' },
        ].map(card => (
          <div key={card.label} className="og-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className={`h-dot h-dot-${card.dot}`} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>{card.label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: card.dot === 'green' ? '#10B981' : card.dot === 'amber' ? '#F59E0B' : '#EF4444' }}>
              {loading ? '…' : card.value}
            </div>
          </div>
        ))}
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'jobs', label: 'Job Runs', count: data?.jobLogs?.length },
        { key: 'cron', label: 'Cron Audit', count: data?.cronAudit?.length },
        { key: 'errors', label: 'Errors Only', count: jobErrors },
      ]} />

      <Card>
        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto' }}>
            {tab === 'jobs' || tab === 'errors' ? (
              <table className="og-table">
                <thead><tr>
                  <th>Job Name</th><th>Status</th><th>Started</th><th>Duration</th><th>Message</th>
                </tr></thead>
                <tbody>
                  {(tab === 'errors' ? data.jobLogs.filter((j: any) => j.status === 'error') : data.jobLogs).map((j: any) => (
                    <tr key={j.run_id} className={j.status === 'error' ? 'row-error' : ''}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>{j.job_name}</td>
                      <td><Badge label={j.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{timeAgo(j.started_at)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{j.duration_ms ? j.duration_ms + 'ms' : '—'}</td>
                      <td style={{ fontSize: 11, color: j.status === 'error' ? '#EF4444' : 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.error_message || j.message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="og-table">
                <thead><tr>
                  <th>Job Name</th><th>Status</th><th>Ran At</th>
                </tr></thead>
                <tbody>
                  {data.cronAudit.map((c: any) => (
                    <tr key={c.id} className={!c.ok ? 'row-error' : ''}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>{c.job_name}</td>
                      <td><Badge label={c.ok ? 'ok' : 'failed'} /></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(c.ran_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
