'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { KpiCard, Card, Spinner, EmptyState, Badge, FilterBar, PageHeader, CustomSelect, Avatar } from '@/components/ui'
import { fmtDateTime, fmtDate } from '@/lib/utils'
import { Wallet, RefreshCw, Search, ArrowLeft, Coins, Building } from 'lucide-react'
import { swrFetch } from '@/lib/cache'

type SearchResult = {
  type: 'user' | 'gym';
  id: string;
  label: string;
  sub?: string;
  is_banned?: boolean;
  photo_path?: string | null;
}

type SummaryData = {
  total_credit: number;
  total_debit: number;
  net: number;
  first_entry_at: string | null;
  entry_count: number;
}

type FocusState = {
  type: 'user' | 'gym';
  id: string;
  label: string;
  sub?: string;
  is_banned?: boolean;
  summary: SummaryData;
}

const reasonColor: Record<string, string> = {
  checkin_charge: 'red', monthly_grant: 'green', corporate_grant: 'purple',
  adjustment: 'blue', refund: 'green', gym_earn: 'green',
}

function LedgerRow({ l, isExpired }: { l: any, isExpired: boolean }) {
  const isCredit = l.direction === 'credit'
  return (
    <tr style={{ opacity: isExpired ? 0.5 : 1 }}>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748B' }}>{fmtDateTime(l.created_at)}</td>
      <td style={{ fontSize: 12 }}>
        {l.profile?.full_name ?? '—'}
        {l.profile?.email && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.profile.email}</div>}
      </td>
      <td style={{ fontSize: 18 }}>
        <span style={{ color: isCredit ? '#10B981' : '#EF4444', fontWeight: 700 }}>{isCredit ? '▲' : '▼'}</span>
      </td>
      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCredit ? '#10B981' : '#EF4444' }}>
        {isCredit ? '+' : '-'}{l.amount}T
      </td>
      <td>
        <Badge label={(l.reason ?? '—').replace(/_/g, ' ')} variant={(reasonColor[l.reason] ?? 'grey') as any} />
      </td>
      <td style={{ fontSize: 11, color: '#64748B' }}>
        {l.gym?.name ?? (l.gym_id ? `#${l.gym_id}` : '—')}
      </td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isExpired ? '#EF4444' : '#64748B' }}>{fmtDate(l.expires_at)}</td>
    </tr>
  )
}

export default function TokensPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('')
  const [reason, setReason] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Focus Mode State
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Search State
  const [q, setQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const searchContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  async function load(force = false) {
    if (!data) setLoading(true)
    else setRefreshing(true)
    
    try {
      const params = new URLSearchParams()
      if (direction) params.set('direction', direction)
      if (reason) params.set('reason', reason)
      await swrFetch(`tokens-economy-${direction}-${reason}`, async () => {
        const res = await fetch('/api/tokens?' + params)
        return res.json()
      }, setData, force ? 0 : 30000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [direction, reason])

  // Handle Search Input Change with Debounce
  const handleSearchChange = (val: string) => {
    setQ(val)
    setHighlighted(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.trim().length < 2) {
      setSearchResults([])
      setDropdownOpen(false)
      return
    }

    setSearchLoading(true)
    setDropdownOpen(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        setSearchResults(data)
      } catch (err) {
        console.error(err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  };

  // Keyboard navigation inside search dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(prev => (prev + 1) % searchResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(prev => (prev - 1 + searchResults.length) % searchResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && highlighted < searchResults.length) {
        selectResult(searchResults[highlighted])
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
    }
  }

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Enter Focus Mode
  const selectResult = async (item: SearchResult) => {
    setQ('')
    setSearchResults([])
    setDropdownOpen(false)
    setHighlighted(-1)
    setHistoryLoading(true)
    setHistoryError(null)

    // Pre-populate focus metadata with empty summary first
    const tempFocus: FocusState = {
      type: item.type,
      id: item.id,
      label: item.label,
      sub: item.sub,
      is_banned: item.is_banned,
      summary: { total_credit: 0, total_debit: 0, net: 0, first_entry_at: null, entry_count: 0 }
    }
    setFocus(tempFocus)

    try {
      const res = await fetch(`/api/tokens/history?type=${item.type}&id=${item.id}`)
      if (!res.ok) {
        throw new Error(`Failed to load history (Status ${res.status})`)
      }
      const resData = await res.json()
      if (resData.error) {
        throw new Error(resData.error)
      }
      setHistory(resData.rows || [])
      setFocus({
        ...tempFocus,
        summary: resData.summary
      })
    } catch (err: any) {
      console.error(err)
      setHistoryError(err.message || 'An error occurred while loading token history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const fmt = (val: number | undefined) => val?.toLocaleString() ?? '—'
  const econ = data?.economySummary

  return (
    <div className="page-enter">
      <PageHeader
        title="Token Economy"
        crumb="Tokens"
        actions={
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => load(true)} 
            disabled={loading || refreshing} 
            style={{ gap: 6 }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={14} /> Token Economy Summary
        </div>
        <div className="grid-2-col" style={{ marginBottom: 16 }}>
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
        </div>
        <div className="grid-4-col">
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
            sub="spendable, issued but unused" 
            accent="blue" 
          />
          <KpiCard 
            label="Blocked (Frozen)" 
            value={fmt(econ?.total_blocked_tokens?.total)} 
            sub="expired, pending renewal rollover" 
            accent="grey" 
          />
          <KpiCard 
            label="Burned Tokens" 
            value={fmt(econ?.total_burned_tokens?.total)} 
            sub={econ ? `${fmt(econ.total_burned_tokens.burned_by_payout)} p. / ${fmt(econ.total_burned_tokens.burned_by_expiry)} legacy-exp. / ${fmt(econ.total_burned_tokens.burned_by_cancellation)} c. / ${fmt(econ.total_burned_tokens.burned_other)} o.` : 'payouts / legacy-expired / canceled / other'} 
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
          <KpiCard 
            label="Expiring in 7d" 
            value={data?.stats?.expiringSoon != null ? data.stats.expiringSoon + 'T' : '—'} 
            sub="expiring active plan tokens"
            subColor="#F59E0B" 
            accent="amber" 
          />
        </div>
      </div>

      <div className="grid-2-col" style={{ marginBottom: 24 }}>
        <KpiCard label="Credited Today" value={data?.stats?.todayCredit != null ? '+' + data.stats.todayCredit + 'T' : '—'} sub="tokens granted" subColor="#10B981" accent="green" />
        <KpiCard label="Debited Today" value={data?.stats?.todayDebit != null ? '-' + data.stats.todayDebit + 'T' : '—'} sub="tokens spent" subColor="#EF4444" accent="red" />
      </div>

      <Card 
        title={focus ? `Token Ledger — ${focus.label}` : "Token Ledger"} 
        action={
          !focus && (
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
          )
        }
      >
        {/* Full-width Audit Search input container */}
        <div ref={searchContainerRef} style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="og-input"
              style={{ width: '100%', paddingLeft: 40, paddingRight: 40 }}
              placeholder="Search user name, email, or gym to audit complete token history..."
              value={q}
              onChange={e => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchLoading && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <span className="spin" style={{ width: 14, height: 14, borderWidth: '1.5px' }} />
              </div>
            )}
          </div>

          {dropdownOpen && (
            <div 
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 99,
                marginTop: 4,
                maxHeight: 300,
                overflowY: 'auto'
              }}
            >
              {searchResults.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
                  No matches
                </div>
              ) : (
                searchResults.map((item, idx) => {
                  const isHighlighted = idx === highlighted
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => selectResult(item)}
                      onMouseEnter={() => setHighlighted(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        backgroundColor: isHighlighted ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {item.type === 'user' ? (
                          <Avatar name={item.label} size={28} />
                        ) : (
                          <div style={{ 
                            width: 28, 
                            height: 28, 
                            borderRadius: '50%', 
                            backgroundColor: 'rgba(79, 107, 244, 0.1)', 
                            color: '#4F6BF4', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            <Building size={14} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.label}
                            {item.is_banned && (
                              <span style={{ fontSize: 9, backgroundColor: '#FEE2E2', color: '#EF4444', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                Banned
                              </span>
                            )}
                          </div>
                          {item.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>}
                        </div>
                      </div>
                      <Badge 
                        label={item.type === 'user' ? 'User' : 'Gym'} 
                        variant={item.type === 'user' ? 'blue' : 'purple'} 
                      />
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Focus Mode Header Strip */}
        {focus && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => { setFocus(null); setHistory([]) }}
                style={{ padding: 6, minWidth: 0 }}
              >
                <ArrowLeft size={16} />
              </button>
              {focus.type === 'user' ? (
                <Avatar name={focus.label} size={36} />
              ) : (
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '50%', 
                  backgroundColor: 'rgba(79, 107, 244, 0.1)', 
                  color: '#4F6BF4', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Building size={18} />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {focus.label}
                  {focus.is_banned && (
                    <span style={{ fontSize: 10, backgroundColor: '#FEE2E2', color: '#EF4444', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      Banned
                    </span>
                  )}
                </div>
                {focus.sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{focus.sub}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                  Credited: <span style={{ color: '#10B981', fontWeight: 700 }}>+{focus.summary.total_credit}T</span>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                  Debited: <span style={{ color: '#EF4444', fontWeight: 700 }}>-{focus.summary.total_debit}T</span>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                  Net: <span style={{ color: focus.summary.net >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                    {focus.summary.net >= 0 ? '+' : ''}{focus.summary.net}T
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setFocus(null); setHistory([]) }}>
                Back to all
              </button>
            </div>
          </div>
        )}

        {focus ? (
          historyLoading ? (
            <Spinner />
          ) : historyError ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#EF4444', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <EmptyState message={`No ledger history found for this ${focus.type}`} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="og-table">
                <thead>
                  <tr>
                    <th>Date</th><th>User</th><th>Dir</th><th>Amount</th><th>Reason</th><th>Gym</th><th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((l: any) => {
                    const isExpired = l.expires_at && new Date(l.expires_at) < new Date()
                    return <LedgerRow key={l.ledger_id} l={l} isExpired={!!isExpired} />
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          loading ? (
            <Spinner />
          ) : !data?.rows?.length ? (
            <EmptyState message="No ledger entries" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="og-table">
                <thead>
                  <tr>
                    <th>Date</th><th>User</th><th>Dir</th><th>Amount</th><th>Reason</th><th>Gym</th><th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((l: any) => {
                    const isExpired = l.expires_at && new Date(l.expires_at) < new Date()
                    return <LedgerRow key={l.ledger_id} l={l} isExpired={!!isExpired} />
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </div>
  )
}

