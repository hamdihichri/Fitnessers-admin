import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = createAdminClient()
  const [jobs, cronAudit, cronRuns, jobCount] = await Promise.all([
    sb.from('job_run_logs').select('*').order('started_at', { ascending:false }).limit(100),
    sb.rpc('get_cron_audit'),
    sb.rpc('get_recent_cron_runs', { p_limit: 300 }),
    sb.from('job_run_logs').select('run_id', { count:'exact', head:true }),
  ])
  return NextResponse.json({
    jobLogs:      jobs.data ?? [],
    cronAudit:    cronAudit.data ?? [],
    cronRuns:     cronRuns.data ?? [],
    totalJobRows: jobCount.count ?? 0,
  })
}
