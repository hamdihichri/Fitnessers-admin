'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, Badge, Tabs, PageHeader } from '@/components/ui'
import { fmtDate, timeAgo } from '@/lib/utils'

interface JobLog {
  run_id: string
  job_name: string
  status: 'pending' | 'running' | 'success' | 'error'
  started_at: string
  duration_ms: number | null
  message: string | null
  error_message: string | null
}

interface CronAuditRow {
  job_name: string
  schedule: string
  total_runs: number
  failed_runs: number
  succeeded_runs: number
  failure_rate_pct: number | null
  last_failure_at: string | null
  last_success_at: string | null
  ok: boolean
}

interface CronRun {
  runid: number
  job_name: string
  schedule: string
  status: 'succeeded' | 'failed' | 'starting' | 'connecting'
  started_at: string
  duration_ms: number
  return_message: string | null
}

interface MonitoringData {
  jobLogs: JobLog[]
  cronAudit: CronAuditRow[]
  cronRuns: CronRun[]
  totalJobRows: number
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cron_audit')
  const [expandedRow, setExpandedRow] = useState<string | number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const d = await fetch('/api/monitoring').then(r => r.json())
      setData(d)
    } catch (e) {
      console.error('Failed to load monitoring data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cronFailing = useMemo(() => data?.cronAudit?.filter(a => !a.ok) || [], [data])
  const highFailureJobs = useMemo(() => data?.cronAudit?.filter(a => (a.failure_rate_pct ?? 0) > 20) || [], [data])
  const recentCronFails = useMemo(() => data?.cronRuns?.filter(r => r.status === 'failed') || [], [data])
  const jobErrors = useMemo(() => data?.jobLogs?.filter(j => j.status === 'error') || [], [data])

  const sortedCronAudit = useMemo(() => {
    if (!data?.cronAudit) return []
    return [...data.cronAudit].sort((a, b) => {
      if (a.ok === b.ok) return (b.failure_rate_pct ?? 0) - (a.failure_rate_pct ?? 0)
      return a.ok ? 1 : -1
    })
  }, [data])

  const toggleExpand = (id: string | number) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  const renderFailureRateBar = (pct: number | null) => {
    const safePct = pct ?? 0
    const color = safePct === 0 ? '#10B981' : safePct < 5 ? '#F59E0B' : '#EF4444'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 40, height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${safePct}%`, height: '100%', background: color }} />
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 35 }}>{safePct.toFixed(1)}%</span>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <PageHeader title="System Monitoring" crumb="Monitoring" actions={
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      } />

      {/* Alert Banner */}
      {!loading && highFailureJobs.length > 0 && (
        <div style={{ 
          background: '#FEF2F2', 
          border: '1px solid #FECACA', 
          borderRadius: 8, 
          padding: '12px 16px', 
          marginBottom: 20,
          color: '#DC2626',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>🚨</span>
          <span>
            {highFailureJobs.length} job(s) with high failure rate — {highFailureJobs.map(j => `${j.job_name} (${j.failure_rate_pct}% fail)`).join(' · ')}
          </span>
        </div>
      )}

      {/* Health summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cron Health', value: cronFailing.length === 0 ? 'All OK' : `${cronFailing.length} failing`, dot: cronFailing.length === 0 ? 'green' : 'red' },
          { label: 'Failed Runs', value: recentCronFails.length.toString(), sub: 'last 300 runs', dot: recentCronFails.length === 0 ? 'green' : 'amber' },
          { label: 'Job Runner', value: jobErrors.length === 0 ? 'Healthy' : `${jobErrors.length} errors`, dot: jobErrors.length === 0 ? 'green' : 'red' },
          { label: 'Database', value: data ? 'Connected' : (loading ? '…' : 'Error'), dot: data ? 'green' : 'red' },
        ].map(card => (
          <div key={card.label} className="og-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className={`h-dot h-dot-${card.dot}`} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>{card.label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: card.dot === 'green' ? '#10B981' : card.dot === 'amber' ? '#F59E0B' : '#EF4444' }}>
              {loading ? '…' : card.value}
            </div>
            {card.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'cron_audit', label: 'Cron Audit', count: data?.cronAudit?.length },
        { key: 'recent_runs', label: 'Recent Runs', count: data?.cronRuns?.length },
        { key: 'failures', label: 'Failures Only', count: recentCronFails.length + jobErrors.length },
        { key: 'job_logs', label: 'Job Logs', count: data?.jobLogs?.length },
      ]} />

      <Card>
        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto' }}>
            {tab === 'cron_audit' && (
              <table className="og-table">
                <thead><tr>
                  <th>Job Name</th><th>Schedule</th><th>Failure Rate</th><th>Total</th><th>Failed</th><th>Last Failure</th><th>Last Success</th>
                </tr></thead>
                <tbody>
                  {sortedCronAudit.map((c, i) => (
                    <tr key={i} className={!c.ok ? 'row-error' : ''}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {!c.ok && <span style={{ marginRight: 4 }}>⚠</span>}
                        {c.job_name}
                      </td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.schedule}</td>
                      <td>{renderFailureRateBar(c.failure_rate_pct)}</td>
                      <td style={{ fontSize: 11 }}>{c.total_runs}</td>
                      <td style={{ fontSize: 11, color: c.failed_runs > 0 ? '#EF4444' : 'inherit' }}>{c.failed_runs}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.last_failure_at ? timeAgo(c.last_failure_at) : '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.last_success_at ? timeAgo(c.last_success_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'recent_runs' && (
              <table className="og-table">
                <thead><tr>
                  <th>Job Name</th><th>Status</th><th>Started</th><th>Duration</th><th>Message / Error</th>
                </tr></thead>
                <tbody>
                  {data?.cronRuns.map((r) => (
                    <tr key={r.runid} className={r.status === 'failed' ? 'row-error' : ''}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>{r.job_name}</td>
                      <td>
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 700, 
                          textTransform: 'uppercase',
                          color: r.status === 'succeeded' ? '#10B981' : r.status === 'failed' ? '#EF4444' : '#F59E0B'
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{timeAgo(r.started_at)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {r.duration_ms != null ? `${Math.round(r.duration_ms)}ms` : '—'}
                      </td>
                      <td 
                        onClick={() => toggleExpand(r.runid)}
                        style={{ 
                          fontSize: 11, 
                          cursor: 'pointer',
                          color: r.status === 'failed' ? '#EF4444' : 'var(--text-muted)', 
                          maxWidth: 400,
                          wordBreak: expandedRow === r.runid ? 'break-all' : 'normal',
                          overflow: expandedRow === r.runid ? 'visible' : 'hidden',
                          textOverflow: expandedRow === r.runid ? 'clip' : 'ellipsis',
                          whiteSpace: expandedRow === r.runid ? 'normal' : 'nowrap'
                        }}
                      >
                        {r.return_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'failures' && (
              <div>
                {recentCronFails.length === 0 && jobErrors.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#10B981', fontWeight: 600 }}>
                    ✅ No failures in recent runs
                  </div>
                ) : (
                  <>
                    {recentCronFails.length > 0 && (
                      <div style={{ marginBottom: 30 }}>
                        <div style={{ padding: '8px 16px', background: 'var(--bg-light)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Cron Failures
                        </div>
                        <table className="og-table">
                          <tbody>
                            {recentCronFails.map(r => (
                              <tr key={r.runid} className="row-error">
                                <td style={{ width: 180, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{r.job_name}</td>
                                <td style={{ width: 100, fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(r.started_at)}</td>
                                <td 
                                  onClick={() => toggleExpand(`cron-${r.runid}`)}
                                  style={{ fontSize: 11, color: '#EF4444', cursor: 'pointer' }}
                                >
                                  {expandedRow === `cron-${r.runid}` ? r.return_message : (r.return_message?.substring(0, 100) + (r.return_message && r.return_message.length > 100 ? '...' : ''))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {jobErrors.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 16px', background: 'var(--bg-light)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Job Runner Errors
                        </div>
                        <table className="og-table">
                          <tbody>
                            {jobErrors.map(j => (
                              <tr key={j.run_id} className="row-error">
                                <td style={{ width: 180, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{j.job_name}</td>
                                <td style={{ width: 100, fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(j.started_at)}</td>
                                <td 
                                  onClick={() => toggleExpand(`job-${j.run_id}`)}
                                  style={{ fontSize: 11, color: '#EF4444', cursor: 'pointer' }}
                                >
                                  {expandedRow === `job-${j.run_id}` ? (j.error_message || j.message) : ((j.error_message || j.message)?.substring(0, 100) + ((j.error_message || j.message) && (j.error_message || j.message)!.length > 100 ? '...' : ''))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'job_logs' && (
              <table className="og-table">
                <thead><tr>
                  <th>Job Name</th><th>Status</th><th>Started</th><th>Duration</th><th>Message</th>
                </tr></thead>
                <tbody>
                  {data?.jobLogs.map((j) => (
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
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
