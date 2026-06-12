'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, FilterBar, UserCell, Modal, FormGroup, InfoBox, ModalActions, PageHeader, CustomSelect, Dropdown, DropdownItem, ConfirmModal, toast, Avatar } from '@/components/ui'
import { fmtDate, exportToCSV } from '@/lib/utils'
import { Search, Download, FileText, MoreVertical, Star, ShieldAlert, CheckCircle2, History, XCircle } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'
import { banUser, unbanUser, grantTokens, pardonCap, liftSuspension, supabase } from '@/lib/supabase'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [adjustModal, setAdjustModal] = useState<any>(null)
  const [adjDir, setAdjDir] = useState('credit')
  const [adjAmt, setAdjAmt] = useState('')
  const [adjReason, setAdjReason] = useState('adjustment')
  const [banModal, setBanModal] = useState<any>(null)
  const [unbanModal, setUnbanModal] = useState<any>(null)
  
  // Suspension & Cap Modal State
  const [suspModal, setSuspModal] = useState<any>(null)
  const [suspData, setSuspData] = useState<any[] | null>(null)
  const [relData, setRelData] = useState<any>(null)
  const [loadingSusp, setLoadingSusp] = useState(false)
  const [inlineAction, setInlineAction] = useState<{ id: string, type: 'pardon' | 'lift' } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function load() {
    setLoading(true)
    const data = await fetchJson('/api/users')
    setUsers(data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase()
      const matchSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      let matchSub = true
      if (subFilter === 'active') matchSub = !!u.sub
      if (subFilter === 'expired') matchSub = !u.sub
      if (subFilter === 'corporate') matchSub = u.isCorporate
      return matchSearch && matchSub
    })
  }, [users, search, subFilter])

  async function applyAdjust() {
    const amt = parseInt(adjAmt)
    if (!amt || amt < 1) return alert('Enter a valid amount')
    const { error } = await grantTokens(adjustModal.user_id, adjDir === 'credit' ? amt : -amt, adjReason)
    if (error) return toast.error(error.message)
    toast.success('Tokens adjusted successfully')
    setAdjustModal(null); setAdjAmt(''); load()
  }

  async function handleBan(user: any) {
    const { error } = await banUser(user.user_id)
    if (error) return toast.error(error.message)
    toast.success(`User ${user.full_name} banned successfully`)
    load()
  }

  async function handleUnban(user: any) {
    const { error } = await unbanUser(user.user_id)
    if (error) return toast.error(error.message)
    load()
  }

  async function fetchSuspData(userId: string) {
    setLoadingSusp(true)
    const [susp, rel] = await Promise.all([
      supabase.from('superadmin_active_suspensions').select('*').eq('user_id', userId).order('suspended_at', { ascending: false }),
      supabase.from('user_attendance_penalties').select('reliability_score, reliability_tier').eq('user_id', userId).single()
    ])
    setSuspData(susp.data)
    setRelData(rel.data)
    setLoadingSusp(false)
  }

  function openSuspModal(user: any) {
    setSuspModal(user)
    setSuspData(null)
    setRelData(null)
    setInlineAction(null)
    setActionReason('')
    fetchSuspData(user.user_id)
  }

  async function handlePardon(susp: any) {
    if (!actionReason) return toast.error('Please provide a reason')
    setActionLoading(true)
    const { error } = await pardonCap(susp.gym_id, suspModal.user_id, actionReason)
    setActionLoading(false)
    if (error) return toast.error(error.message)
    toast.success('Cap pardoned successfully')
    setInlineAction(null); setActionReason(''); fetchSuspData(suspModal.user_id)
  }

  async function handleLift(susp: any) {
    if (!actionReason) return toast.error('Please provide a reason')
    setActionLoading(true)
    const res = await liftSuspension(susp.gym_id, suspModal.user_id, actionReason)
    setActionLoading(false)
    if (res.error) return toast.error(res.error)
    toast.success('Suspension lifted successfully')
    setInlineAction(null); setActionReason(''); fetchSuspData(suspModal.user_id)
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="User Management"
        crumb="Users"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm print-visible" onClick={() => window.print()}>
              <FileText size={14} style={{ marginRight: 6 }} /> Export Report
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV('users_report', users)}>
              <Download size={14} style={{ marginRight: 6 }} /> Export CSV
            </button>
          </div>
        }
      />

      <FilterBar>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input className="og-input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <CustomSelect
          value={subFilter}
          onChange={setSubFilter}
          options={[
            { value: '', label: 'All Users' },
            { value: 'active', label: 'With Subscription' },
            { value: 'expired', label: 'No Plan' },
            { value: 'corporate', label: 'Corporate' }
          ]}
        />
      </FilterBar>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <StatPill label="Total" value={users.length} />
        <StatPill label="With Sub" value={users.filter(u => u.sub).length} />
        <StatPill label="Corporate" value={users.filter(u => u.isCorporate).length} />
        <StatPill label="No Plan" value={users.filter(u => !u.sub).length} />
      </div>

      <Card>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead><tr>
                <th>User</th><th>City</th><th>Gender</th><th>Subscription</th><th>Tokens</th><th>Joined</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.user_id}>
                    <td><UserCell name={u.full_name} email={u.email} /></td>
                    <td style={{ color: '#8FA3BF' }}>{u.city ?? '—'}</td>
                    <td style={{ color: '#8FA3BF' }}>{u.gender ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.is_banned && <Badge label="BANNED" variant="red" />}
                        {u.isCorporate ? <Badge label="Corporate" variant="purple" />
                          : u.sub ? <Badge label="Active" variant="green" />
                            : <Badge label="No Plan" variant="grey" />}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: u.balance > 0 ? '#10B981' : '#64748B' }}>
                      {u.balance}T
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{fmtDate(u.created_at)}</td>
                    <td>
                      <Dropdown trigger={
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }}>
                          <MoreVertical size={16} />
                        </button>
                      }>
                        {(close) => (
                          <div style={{ minWidth: 160 }}>
                            <DropdownItem title="Adjust Tokens" onClick={() => { setAdjustModal(u); setAdjDir('credit'); setAdjAmt(''); setAdjReason('adjustment'); close(); }} />
                            {!u.is_banned ? (
                              <DropdownItem title="Ban User" variant="danger" onClick={() => { setBanModal(u); close(); }} />
                            ) : (
                              <DropdownItem title="Unban User" variant="success" onClick={() => { setUnbanModal(u); close(); }} />
                            )}
                            <DropdownItem title="Suspension & Cap" onClick={() => { openSuspModal(u); close(); }} />
                          </div>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title="Token Adjustment" subtitle="Manually credit or debit tokens for this user.">
        {adjustModal && (
          <>
            <InfoBox>
              <div>User: <strong style={{ color: '#E4EBF5' }}>{adjustModal.full_name}</strong></div>
              <div>Current Balance: <strong style={{ color: '#10B981' }}>{adjustModal.balance}T</strong></div>
            </InfoBox>
            <FormGroup label="Direction">
              <CustomSelect
                style={{ width: '100%' }}
                value={adjDir}
                onChange={setAdjDir}
                options={[
                  { value: 'credit', label: '▲ Credit — Add tokens' },
                  { value: 'debit', label: '▼ Debit — Remove tokens' }
                ]}
              />
            </FormGroup>
            <FormGroup label="Amount (tokens)">
              <input className="og-input" style={{ width: '100%' }} type="number" min="1" placeholder="e.g. 10" value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
            </FormGroup>
            <FormGroup label="Reason">
              <CustomSelect
                style={{ width: '100%' }}
                value={adjReason}
                onChange={setAdjReason}
                options={[
                  { value: 'adjustment', label: 'Adjustment' },
                  { value: 'refund', label: 'Refund' }
                ]}
              />
            </FormGroup>
            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={applyAdjust}>Apply Adjustment</button>
            </ModalActions>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!banModal}
        onClose={() => setBanModal(null)}
        onConfirm={() => handleBan(banModal)}
        title="Ban User"
        message={`Are you sure you want to ban ${banModal?.full_name}? They will lose access to their account immediately.`}
        confirmText="Ban User"
        variant="red"
      />

      <ConfirmModal
        open={!!unbanModal}
        onClose={() => setUnbanModal(null)}
        onConfirm={() => handleUnban(unbanModal)}
        title="Unban User"
        message={`Are you sure you want to unban ${unbanModal?.full_name}?`}
        confirmText="Unban User"
        variant="green"
      />

      <Modal 
        open={!!suspModal} 
        onClose={() => setSuspModal(null)}
        title="Suspension & Reliability Management"
      >
        {suspModal && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '0 4px' }}>
              <Avatar name={suspModal.full_name} size={48} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{suspModal.full_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{suspModal.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {relData && (
                  <div style={{ 
                    padding: '6px 12px', 
                    borderRadius: 10, 
                    background: relData.reliability_score >= 90 ? 'rgba(16, 185, 129, 0.1)' : relData.reliability_score >= 70 ? 'rgba(234, 179, 8, 0.1)' : relData.reliability_score >= 40 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: relData.reliability_score >= 90 ? '#10B981' : relData.reliability_score >= 70 ? '#EAB308' : relData.reliability_score >= 40 ? '#F97316' : '#EF4444',
                    fontWeight: 700,
                    fontSize: 12,
                    border: '1px solid currentColor'
                  }}>
                    Score: {relData.reliability_score}
                  </div>
                )}
                {suspData !== null && (
                  <div style={{ 
                    padding: '6px 12px', 
                    borderRadius: 10, 
                    background: suspData.some(s => s.is_cap_active) ? 'rgba(249, 115, 22, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                    color: suspData.some(s => s.is_cap_active) ? '#F97316' : '#64748B',
                    fontWeight: 700,
                    fontSize: 12,
                    border: '1px solid currentColor'
                  }}>
                    Cap: {suspData.find(s => s.is_cap_active)?.current_cap ?? 100}
                  </div>
                )}
              </div>
            </div>

            {loadingSusp ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
            ) : suspData?.length === 0 ? (
              <EmptyState icon="🛡️" message="This user has a clean attendance record." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', padding: '4px' }}>
                {suspData?.map(s => (
                  <div key={s.suspension_id} style={{ 
                    background: 'var(--bg-elevated)', 
                    borderRadius: 12, 
                    border: '1px solid var(--border-color)',
                    padding: 16,
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                          🏋️ {s.gym_name}
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star key={i} size={10} fill={i <= s.admin_rating ? '#FBBF24' : 'transparent'} color={i <= s.admin_rating ? '#FBBF24' : '#64748B'} />
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Reason: <span style={{ color: 'var(--text-primary)' }}>{s.reason || 'Not specified'}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {fmtDate(s.suspended_at)}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          {s.lifted_at ? (
                            <Badge label={`LIFTED ${fmtDate(s.lifted_at)}`} variant="green" />
                          ) : (
                            <Badge label="ACTIVE" variant="red" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        {s.is_cap_active ? (
                          <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ShieldAlert size={12} /> CAP ACTIVE -5
                          </span>
                        ) : s.cap_pardoned_at ? (
                          <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> PARDONED
                          </span>
                        ) : (
                          <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <History size={12} /> NO IMPACT
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8 }}>
                        {s.is_cap_active && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ borderColor: '#F97316', color: '#F97316', fontSize: 11 }}
                            onClick={() => { setInlineAction({ id: s.suspension_id, type: 'pardon' }); setActionReason(''); }}
                          >
                            Pardon Cap
                          </button>
                        )}
                        {!s.lifted_at && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ borderColor: '#EF4444', color: '#EF4444', fontSize: 11 }}
                            onClick={() => { setInlineAction({ id: s.suspension_id, type: 'lift' }); setActionReason(''); }}
                          >
                            Lift Suspension
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const act = inlineAction
                      if (!act || act.id !== s.suspension_id) return null
                      return (
                        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                            {act.type === 'pardon' ? 'Reason for Pardon' : 'Reason for Lifting'}
                          </div>
                          <input 
                            className="og-input" 
                            style={{ width: '100%', marginBottom: 12, fontSize: 12 }} 
                            placeholder="Provide context for this action..." 
                            value={actionReason}
                            onChange={e => setActionReason(e.target.value)}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => setInlineAction(null)}>Cancel</button>
                            <button 
                              className="btn btn-primary btn-xs" 
                              disabled={actionLoading}
                              onClick={() => act.type === 'pardon' ? handlePardon(s) : handleLift(s)}
                            >
                              {actionLoading ? 'Saving...' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setSuspModal(null)}>Close</button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}
