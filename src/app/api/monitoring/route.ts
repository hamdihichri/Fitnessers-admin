import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = createAdminClient()
  const [jobs, cron, jobCount] = await Promise.all([
    sb.from('job_run_logs').select('*').order('started_at', { ascending:false }).limit(100),
    sb.from('cron_audit').select('*').order('ran_at', { ascending:false }).limit(50),
    sb.from('job_run_logs').select('run_id', { count:'exact', head:true }),
  ])
  return NextResponse.json({
    jobLogs:    jobs.data ?? [],
    cronAudit:  cron.data ?? [],
    totalJobRows: jobCount.count ?? 0,
  })
}
