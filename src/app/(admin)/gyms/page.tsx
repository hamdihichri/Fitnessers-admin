'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, FilterBar, Modal, FormGroup, InfoBox, ModalActions, PageHeader, CustomSelect, toast } from '@/components/ui'
import { fmtDate, stars, exportToCSV, fmtTND } from '@/lib/utils'
import { Search, Download, FileText, ShieldCheck, MoreVertical, AlertTriangle, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function GymsPage() {
  const router = useRouter()
  const [gyms, setGyms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [verifyModal, setVerifyModal] = useState<any>(null)
  const [rating, setRating] = useState('2')
  const [editRatingModal, setEditRatingModal] = useState<any>(null)
  const [editRating, setEditRating] = useState('2')
  const [savingRating, setSavingRating] = useState(false)
  const [deleteModal, setDeleteModal] = useState<any>(null)
  const [deletingGym, setDeletingGym] = useState(false)
  const [pendingReqCount, setPendingReqCount] = useState(0)
  const [showDeleted, setShowDeleted] = useState(false)
  const [protectionStatus, setProtectionStatus] = useState<Record<number, any>>({})
  const [thresholdModal, setThresholdModal] = useState(false)
  const [thresholdValue, setThresholdValue] = useState('5')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [gymThresholdModal, setGymThresholdModal] = useState<any>(null)
  const [gymThresholdValue, setGymThresholdValue] = useState('')
  const [savingGymThreshold, setSavingGymThreshold] = useState(false)

  async function load() {
    setLoading(true)
    const [data, countRes, protectionRes] = await Promise.all([
      fetch('/api/gyms').then(r => r.json()),
      fetch('/api/women-only-requests/count').then(r => r.json()),
      supabase.rpc('admin_list_gym_member_protection_status', {
        p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
      })
    ])
    setGyms(data)
    setPendingReqCount(countRes.count || 0)
    const protectionMap: Record<number, any> = {}
    for (const row of protectionRes.data ?? []) {
      protectionMap[row.gym_id] = row
    }
    setProtectionStatus(protectionMap)
    if (protectionRes.data?.length) {
      setThresholdValue(String(protectionRes.data[0].required_threshold))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])


  const filtered = useMemo(() => {
    return gyms.filter(g => {
      const q = search.toLowerCase()
      const matchSearch = !q || g.name?.toLowerCase().includes(q) || g.city?.toLowerCase().includes(q) || g.rne_code?.toLowerCase().includes(q)
      const matchType = !typeFilter || g.venue_type === typeFilter
      let matchStatus = true
      if (statusFilter === 'active') matchStatus = !g.deleted_at && g.rne_verified
      if (statusFilter === 'pending') matchStatus = !g.deleted_at && !g.rne_verified
      
      // Hide deleted by default unless showDeleted is true or statusFilter is 'deleted' (if still used)
      const isDeleted = !!g.deleted_at
      if (!showDeleted && isDeleted) return false

      return matchSearch && matchType && matchStatus
    })
  }, [gyms, search, statusFilter, typeFilter, showDeleted])

  const active = gyms.filter(g => !g.deleted_at && g.rne_verified).length
  const pending = gyms.filter(g => !g.deleted_at && !g.rne_verified).length
  const deleted = gyms.filter(g => g.deleted_at).length

  const [conflicts, setConflicts] = useState<any[]>([])

  async function verifyGym() {
    if (!verifyModal) return
    const r = parseInt(rating)
    
    setSavingRating(true)
    try {
      // 1. Set rating via RPC (handles validation)
      const { data, error: rpcError } = await supabase.rpc('set_gym_rating', {
        p_gym_id: verifyModal.gym_id,
        p_new_rating: r,
        p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
      })

      if (rpcError) {
        toast.error('RPC Error: ' + rpcError.message)
        return
      }

      if (!data.ok) {
        if (data.error === 'downgrade_blocked') {
          setConflicts(data.conflicts || [])
          toast.error('Downgrade blocked: ' + data.message)
        } else {
          toast.error('Error: ' + (data.message || data.error))
        }
        return
      }

      // 2. Mark as verified
      const res = await fetch('/api/gyms', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: verifyModal.gym_id, rne_verified: true })
      })
      const json = await res.json()
      if (json.error) { toast.error('Error: ' + json.error); return }
      
      toast.success('Gym verified and rating set!')
      setVerifyModal(null); setConflicts([]); load()
    } finally {
      setSavingRating(false)
    }
  }

  async function deleteGym(id: number) {
    if (deletingGym) return
    setDeletingGym(true)
    try {
      const res = await fetch('/api/gyms', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: id, deleted_at: new Date().toISOString() })
      })
      const json = await res.json()
      if (json.error) { toast.error('Error: ' + json.error); return }
      setDeleteModal(null)
      load()
    } finally {
      setDeletingGym(false)
    }
  }

  async function saveGymRating() {
    if (!editRatingModal) return
    const r = parseInt(editRating)
    if (!Number.isFinite(r) || r < 1 || r > 3) {
      toast.error('Rating must be 1, 2, or 3')
      return
    }

    if (savingRating) return
    setSavingRating(true)
    setConflicts([])
    
    try {
      const { data, error: rpcError } = await supabase.rpc('set_gym_rating', {
        p_gym_id: editRatingModal.gym_id,
        p_new_rating: r,
        p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
      })

      if (rpcError) {
        toast.error('RPC Error: ' + rpcError.message)
        return
      }

      if (!data.ok) {
        if (data.error === 'downgrade_blocked') {
          setConflicts(data.conflicts || [])
          toast.error('Downgrade blocked: ' + data.message)
        } else {
          toast.error('Error: ' + (data.message || data.error))
        }
        return
      }

      toast.success('Rating updated successfully!')
      setEditRatingModal(null)
      load()
    } catch (err: any) {
      toast.error('Unexpected error: ' + err.message)
    } finally {
      setSavingRating(false)
    }
  }

  async function saveThreshold() {
    const v = parseInt(thresholdValue)
    if (!Number.isFinite(v) || v < 0) {
      toast.error('Threshold must be a non-negative number')
      return
    }
    setSavingThreshold(true)
    try {
      const { data, error } = await supabase.rpc('set_platform_setting_int', {
        p_key: 'protect_member_slots_min_registered',
        p_value: v,
        p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
      })
      if (error) { toast.error('RPC Error: ' + error.message); return }
      if (!data.ok) { toast.error('Error: ' + (data.error ?? 'unknown')); return }
      toast.success('Threshold updated to ' + v)
      setThresholdModal(false)
      load()
    } finally {
      setSavingThreshold(false)
    }
  }

  async function saveGymThreshold(resetToDefault = false) {
    if (!gymThresholdModal) return
    const v = resetToDefault ? null : parseInt(gymThresholdValue)
    if (!resetToDefault) {
      if (v === null || !Number.isFinite(v) || v < 0) {
        toast.error('Threshold must be a non-negative number')
        return
      }
    }
    setSavingGymThreshold(true)
    try {
      const { data, error } = await supabase.rpc('admin_set_gym_protection_threshold', {
        p_gym_id: gymThresholdModal.gym_id,
        p_threshold: v,
        p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
      })
      if (error) { toast.error('RPC Error: ' + error.message); return }
      if (!data.ok) { toast.error('Error: ' + (data.error ?? 'unknown')); return }
      toast.success(resetToDefault ? 'Reset to platform default' : `Threshold set to ${v}`)
      setGymThresholdModal(null)
      load()
    } finally {
      setSavingGymThreshold(false)
    }
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Gym Management"
        crumb="Gyms"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/gym-invites')}>
              <Mail size={14} style={{ marginRight: 6 }} /> Invite Gym Owner
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push('/women-only-requests')}
              style={{ position: 'relative', overflow: 'visible' }}
            >
              <ShieldCheck size={14} style={{ marginRight: 6 }} />
              Women-Only Requests
              {pendingReqCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-base)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {pendingReqCount}
                </span>
              )}
            </button>
            <button className="btn btn-ghost btn-sm print-visible" onClick={() => window.print()}>
              <FileText size={14} style={{ marginRight: 6 }} /> Export Report
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV('gyms_report', gyms)}>
              <Download size={14} style={{ marginRight: 6 }} /> Export CSV
            </button>
          </div>
        }

      />

      {pending > 0 && (
        <div className="alert-banner alert-amber">
          <span>⚠️</span>
          <span><strong>{pending} gym{pending > 1 ? 's' : ''}</strong> awaiting RNE verification before going live.</span>
        </div>
      )}

      <FilterBar>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input className="og-input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search by name, city, RNE..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Verified' },
            { value: 'pending', label: 'Pending Verification' }
          ]}
        />
        <button 
          className={`btn btn-sm ${showDeleted ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowDeleted(!showDeleted)}
          style={{ whiteSpace: 'nowrap' }}
        >
          {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
        </button>
        <CustomSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'All Types' },
            { value: 'gym', label: 'Gym' },
            { value: 'hotel_pool', label: 'Hotel Pool' }
          ]}
        />
      </FilterBar>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <StatPill label="Total" value={gyms.length} />
        <StatPill label="Verified" value={active} />
        <StatPill label="Pending" value={pending} />
        <StatPill label="Deleted" value={deleted} />
      </div>

      <Card>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No gyms found" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead><tr>
                <th>Gym</th><th>City</th><th>Type</th><th>RNE</th><th>Rating</th>
                <th style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Registered Slots
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setThresholdModal(true)}
                    title="Edit threshold"
                    style={{ padding: 2, height: 'auto', minHeight: 'auto' }}
                  >
                    ⚙️
                  </button>
                </th>
                <th>Created</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((g: any) => {
                  const isPending = !g.rne_verified && !g.deleted_at
                  return (
                    <tr key={g.gym_id} className={isPending ? 'row-pending' : ''}>
                      <td>
                        <div style={{ fontWeight: 600, color: g.deleted_at ? '#64748B' : '#E4EBF5', textDecoration: g.deleted_at ? 'line-through' : 'none' }}>
                          {g.name ?? '—'}
                        </div>
                      </td>
                      <td style={{ color: '#8FA3BF' }}>{g.city ?? '—'}</td>
                      <td><Badge label={g.venue_type ?? 'gym'} variant={g.venue_type === 'hotel_pool' ? 'purple' : 'blue'} /></td>
                      <td>
                        {g.rne_verified
                          ? <span style={{ color: '#10B981', fontSize: 12 }}>✓ <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8FA3BF' }}>{g.rne_code}</span></span>
                          : <span style={{ color: '#F59E0B', fontSize: 12 }}>⚠ <span style={{ fontSize: 11, color: '#F59E0B' }}>Unverified</span></span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            if (g.deleted_at) return
                            setEditRatingModal(g)
                            setEditRating(String(g.admin_rating ?? 2))
                          }}
                          className="btn btn-ghost btn-sm"
                          title={g.deleted_at ? 'Cannot edit rating for deleted gym' : 'Edit rating'}
                          style={{
                            padding: 0,
                            height: 'auto',
                            minHeight: 'auto',
                            lineHeight: 1,
                            color: '#F59E0B',
                            letterSpacing: 1,
                          }}
                          disabled={!!g.deleted_at}
                        >
                          {stars(g.admin_rating)}
                        </button>
                      </td>
                      <td>
                        {(() => {
                          const ps = protectionStatus[g.gym_id]
                          if (!ps) return <span style={{ color: '#64748B', fontSize: 12 }}>—</span>
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setGymThresholdModal(g)
                                  setGymThresholdValue(ps.is_custom_threshold ? String(ps.required_threshold) : '')
                                }}
                                style={{
                                  padding: 0,
                                  height: 'auto',
                                  minHeight: 'auto',
                                  lineHeight: 1,
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: ps.eligible ? '#10B981' : '#8FA3BF',
                                }}
                              >
                                {ps.registered_count}/{ps.required_threshold}
                              </button>
                              {ps.is_custom_threshold && <Badge label="Custom" variant="purple" />}
                              {ps.currently_enabled && <Badge label="Protected" variant="blue" />}
                              {!ps.eligible && <Badge label="Below threshold" variant="grey" />}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{fmtDate(g.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Badge label={g.deleted_at ? 'Deleted' : 'Active'} variant={g.deleted_at ? 'red' : 'green'} />
                          {!g.deleted_at && !g.rne_verified && (
                            <button className="btn btn-confirm btn-sm" onClick={() => { setVerifyModal(g); setRating('2') }}>✓ Verify</button>
                          )}
                          {!g.deleted_at && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setDeleteModal(g)}
                              title="More"
                              style={{ padding: '0 10px' }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Verify Modal */}
      <Modal open={!!verifyModal} onClose={() => setVerifyModal(null)} title="Verify Gym" subtitle="Confirm RNE and set admin rating. This makes the gym live.">
        {verifyModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{verifyModal.name}</strong></div>
              <div>RNE Code: <span style={{ fontFamily: 'var(--font-mono)', color: '#4F6BF4' }}>{verifyModal.rne_code ?? 'Not provided'}</span></div>
              <div>City: <strong style={{ color: '#E4EBF5' }}>{verifyModal.city ?? '—'}</strong></div>
            </InfoBox>
            <FormGroup label="Admin Rating">
              <CustomSelect
                style={{ width: '100%' }}
                value={rating}
                onChange={(v) => { setRating(v); setConflicts([]); }}
                options={[
                  { value: '1', label: '★ Basic (1)' },
                  { value: '2', label: '★★ Standard (2)' },
                  { value: '3', label: '★★★ Premium (3) — auto sets is_premium' }
                ]}
              />
            </FormGroup>

            {conflicts.length > 0 && (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F87171', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> Downgrade Conflict Report
                </div>
                <div style={{ color: '#FCA5A5', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  The following sessions have prices higher than the allowed ceiling for rating {rating}.
                  Ask the gym to lower these prices first.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {c.type === 'default_token_price' ? 'Default Price' : `Session #${c.weekly_session_id}`}
                      </span>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: '#F87171' }}>{c.current_value} tokens</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                        <span style={{ color: '#10B981' }}>max {c.new_ceiling} tokens</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setVerifyModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={verifyGym}>✓ Verify Gym</button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Edit Rating Modal */}
      <Modal
        open={!!editRatingModal}
        onClose={() => { if (!savingRating) { setEditRatingModal(null); setConflicts([]); } }}
        title="Edit Gym Rating"
        subtitle="Update the admin rating for this gym."
      >
        {editRatingModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{editRatingModal.name}</strong></div>
              <div>City: <strong style={{ color: '#E4EBF5' }}>{editRatingModal.city ?? '—'}</strong></div>
              <div>Current Rating: <span style={{ color: '#F59E0B', letterSpacing: 1 }}>{stars(editRatingModal.admin_rating)}</span></div>
            </InfoBox>

            <FormGroup label="New Admin Rating">
              <CustomSelect
                style={{ width: '100%' }}
                value={editRating}
                onChange={(v) => { setEditRating(v); setConflicts([]); }}
                options={[
                  { value: '1', label: '★ Basic (1)' },
                  { value: '2', label: '★★ Standard (2)' },
                  { value: '3', label: '★★★ Premium (3)' }
                ]}
              />
            </FormGroup>

            {conflicts.length > 0 && (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F87171', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> Downgrade Conflict Report
                </div>
                <div style={{ color: '#FCA5A5', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  The following {conflicts.length} session(s) exceed the allowed token price for {stars(parseInt(editRating))}.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {c.type === 'default_token_price' ? 'DEF_PRICE' : `SID-${c.weekly_session_id}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#F87171' }}>{c.current_value} tokens</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>current</div>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#10B981' }}>{c.new_ceiling} tokens</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>max</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setEditRatingModal(null)} disabled={savingRating}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGymRating} disabled={savingRating}>
                {savingRating ? 'Saving…' : 'Save Rating'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Actions Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => { if (!deletingGym) setDeleteModal(null) }}
        title="Gym Actions"
        subtitle="Manage this gym."
      >
        {deleteModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{deleteModal.name}</strong></div>
              <div>City: <strong style={{ color: '#E4EBF5' }}>{deleteModal.city ?? '—'}</strong></div>
              <div style={{ color: 'var(--text-secondary)' }}>
                This will perform a <strong style={{ color: '#E4EBF5' }}>soft delete</strong>. The gym will be hidden from the app.
              </div>
            </InfoBox>

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setDeleteModal(null)} disabled={deletingGym}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => deleteGym(deleteModal.gym_id)}
                disabled={deletingGym}
              >
                {deletingGym ? 'Deleting…' : 'Delete Gym'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      <Modal
        open={thresholdModal}
        onClose={() => { if (!savingThreshold) setThresholdModal(false) }}
        title="Member Slots Protection Threshold"
        subtitle="Fallback minimum used for gyms that don't have their own custom threshold."
      >
        <FormGroup label="Minimum Registered Members">
          <input
            type="number"
            min="0"
            className="og-input"
            style={{ width: '100%' }}
            value={thresholdValue}
            onChange={e => setThresholdValue(e.target.value)}
          />
        </FormGroup>
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => setThresholdModal(false)} disabled={savingThreshold}>Cancel</button>
          <button className="btn btn-primary" onClick={saveThreshold} disabled={savingThreshold}>
            {savingThreshold ? 'Saving…' : 'Save Threshold'}
          </button>
        </ModalActions>
      </Modal>

      <Modal
        open={!!gymThresholdModal}
        onClose={() => { if (!savingGymThreshold) setGymThresholdModal(null) }}
        title={`Protection Threshold — ${gymThresholdModal?.name ?? ''}`}
        subtitle="Minimum registered members before this gym can enable Protect Member Slots."
      >
        {gymThresholdModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{gymThresholdModal.name}</strong></div>
              <div>City: <strong style={{ color: '#E4EBF5' }}>{gymThresholdModal.city ?? '—'}</strong></div>
              <div>
                Registered Members:{' '}
                <strong style={{ color: '#E4EBF5' }}>
                  {protectionStatus[gymThresholdModal.gym_id]?.registered_count ?? 0}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span>Status:</span>
                {protectionStatus[gymThresholdModal.gym_id]?.is_custom_threshold ? (
                  <Badge label="Custom Override" variant="purple" />
                ) : (
                  <Badge label="Platform Default" variant="grey" />
                )}
              </div>
            </InfoBox>

            <FormGroup label="Gym Protection Threshold">
              <input
                type="number"
                min="0"
                className="og-input"
                style={{ width: '100%' }}
                value={gymThresholdValue}
                placeholder={`Platform default: ${thresholdValue}`}
                onChange={e => setGymThresholdValue(e.target.value)}
              />
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Platform default fallback: {thresholdValue}
              </div>
              {protectionStatus[gymThresholdModal.gym_id]?.is_custom_threshold && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#EF4444', padding: 0, height: 'auto', minHeight: 'auto' }}
                    onClick={() => saveGymThreshold(true)}
                    disabled={savingGymThreshold}
                  >
                    Reset to platform default
                  </button>
                </div>
              )}
            </FormGroup>

            <ModalActions>
              <button
                className="btn btn-ghost"
                onClick={() => setGymThresholdModal(null)}
                disabled={savingGymThreshold}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => saveGymThreshold(false)}
                disabled={savingGymThreshold}
              >
                {savingGymThreshold ? 'Saving…' : 'Save Threshold'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}
