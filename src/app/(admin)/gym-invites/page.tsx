'use client'
import { useEffect, useState } from 'react'
import {
  Card, Spinner, EmptyState, Badge, FilterBar, Modal, FormGroup,
  InfoBox, ModalActions, PageHeader, CustomSelect, toast,
} from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { TUNISIA_CITIES } from '@/lib/constants'
import { Search, Mail, X } from 'lucide-react'

const ACTOR_ID = '51a1ea96-73b4-4a4f-be84-3575f0670366'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function statusVariant(status: string): 'amber' | 'blue' | 'green' | 'grey' | 'red' | 'purple' {
  if (status === 'pending') return 'amber'
  if (status === 'accepted') return 'green'
  if (status === 'expired') return 'grey'
  if (status === 'cancelled') return 'red'
  return 'purple'
}

function humanError(code: string): string {
  if (code === 'user_already_exists') return 'An account with this email already exists. Gym owners need a separate email from any existing member account — ask them to use a different address.'
  if (code === 'invite_already_pending') return 'This owner already has a pending invite.'
  if (code === 'draft_already_exists') return 'This email is already on the invite list.'
  if (code === 'draft_not_found') return 'This draft no longer exists.'
  return code
}

export default function GymInvitesPage() {
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // draft state
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [sendingDraftId, setSendingDraftId] = useState<number | null>(null)
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null)
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [savingEmailId, setSavingEmailId] = useState<number | null>(null)

  // invite modal
  const [inviteModal, setInviteModal] = useState(false)
  const [gymName, setGymName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [sending, setSending] = useState(false)

  // cancel confirm (sent invites)
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)

  // delete confirm (sent invites)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_gym_invites', {
      p_actor_id: ACTOR_ID,
    })
    if (error) {
      toast.error('Failed to load invites: ' + error.message)
    } else {
      setInvites(data ?? [])
    }
    setLoading(false)
  }

  async function loadDrafts() {
    setLoadingDrafts(true)
    const { data, error } = await supabase.rpc('admin_list_gym_invite_drafts', { p_actor_id: ACTOR_ID })
    if (error) {
      toast.error('Failed to load drafts: ' + error.message)
    } else {
      setDrafts(data ?? [])
    }
    setLoadingDrafts(false)
  }

  useEffect(() => {
    load()
    loadDrafts()
  }, [])

  const filtered = invites.filter(inv => {
    const q = search.toLowerCase()
    return (
      !q ||
      inv.gym_name?.toLowerCase().includes(q) ||
      inv.owner_email?.toLowerCase().includes(q)
    )
  })

  const isFormValid = gymName.trim().length > 0

  async function addToInviteList() {
    if (!isFormValid || sending) return
    setSending(true)
    try {
      const { data, error } = await supabase.rpc('admin_add_gym_invite_draft', {
        p_gym_name: gymName.trim(),
        p_owner_email: ownerEmail.trim() || null,
        p_actor_id: ACTOR_ID,
        p_city: city || null,
        p_owner_name: ownerName.trim() || null,
        p_phone: phone.trim() || null,
      })
      if (error) { toast.error('RPC error: ' + error.message); return }
      if (!data.ok) { toast.error(humanError(data.error)); return }
      toast.success('Added to invite list.')
      setInviteModal(false)
      setGymName('')
      setOwnerName('')
      setOwnerEmail('')
      setPhone('')
      setCity('')
      loadDrafts()
    } finally {
      setSending(false)
    }
  }

  async function sendDraft(draft: any) {
    if (!draft.owner_email) { toast.error('Add an email before sending this invite.'); return }
    if (sendingDraftId) return
    setSendingDraftId(draft.draft_id)
    try {
      const res = await fetch('/api/gym-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_name: draft.gym_name,
          owner_email: draft.owner_email,
          owner_name: draft.owner_name,
          phone: draft.phone,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(humanError(json.error ?? json.message ?? 'unknown_error'))
        return
      }
      // Real invite sent — remove it from the draft list
      await supabase.rpc('admin_delete_gym_invite_draft', { p_draft_id: draft.draft_id, p_actor_id: ACTOR_ID })
      toast.success('Invite sent to ' + draft.owner_email)
      loadDrafts()
      load()
    } catch (err: any) {
      toast.error('Network error: ' + err.message)
    } finally {
      setSendingDraftId(null)
    }
  }

  async function saveDraftEmail(draft: any) {
    if (!EMAIL_RE.test(emailDraft.trim()) || savingEmailId) return
    setSavingEmailId(draft.draft_id)
    try {
      const { data, error } = await supabase.rpc('admin_update_gym_invite_draft_email', {
        p_draft_id: draft.draft_id,
        p_owner_email: emailDraft.trim(),
        p_actor_id: ACTOR_ID,
      })
      if (error) { toast.error('RPC error: ' + error.message); return }
      if (!data.ok) { toast.error(humanError(data.error)); return }
      toast.success('Email saved.')
      setEditingEmailId(null)
      setEmailDraft('')
      loadDrafts()
    } finally {
      setSavingEmailId(null)
    }
  }

  async function deleteDraft(draft: any) {
    if (deletingDraftId) return
    setDeletingDraftId(draft.draft_id)
    try {
      const { data, error } = await supabase.rpc('admin_delete_gym_invite_draft', {
        p_draft_id: draft.draft_id,
        p_actor_id: ACTOR_ID,
      })
      if (error) { toast.error('RPC error: ' + error.message); return }
      if (data && !data.ok) { toast.error('Error: ' + (data.error ?? 'unknown')); return }
      toast.success('Removed from invite list.')
      loadDrafts()
    } finally {
      setDeletingDraftId(null)
    }
  }

  async function cancelInvite() {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    try {
      const { data, error } = await supabase.rpc('admin_cancel_gym_invite', {
        p_invite_id: cancelTarget.invite_id,
        p_actor_id: ACTOR_ID,
      })
      if (error) { toast.error('RPC error: ' + error.message); return }
      if (data && !data.ok) { toast.error('Error: ' + (data.error ?? 'unknown')); return }
      toast.success('Invite cancelled.')
      setCancelTarget(null)
      load()
    } finally {
      setCancelling(false)
    }
  }

  async function deleteInvite() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { data, error } = await supabase.rpc('admin_delete_gym_invite', {
        p_invite_id: deleteTarget.invite_id,
        p_actor_id: ACTOR_ID,
      })
      if (error) { toast.error('RPC error: ' + error.message); return }
      if (data && !data.ok) { toast.error('Error: ' + (data.error ?? 'unknown')); return }
      toast.success('Invite deleted.')
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Gym Owner Invites"
        crumb="Gym Invites"
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setInviteModal(true); setGymName(''); setOwnerName(''); setOwnerEmail(''); setPhone(''); setCity('') }}
          >
            <Mail size={14} style={{ marginRight: 6 }} /> Invite Gym Owner
          </button>
        }
      />

      {/* Invite List (Not Sent) Card */}
      <Card title="Invite List (Not Sent)">
        {loadingDrafts ? (
          <Spinner />
        ) : drafts.length === 0 ? (
          <EmptyState icon="✉️" message="No drafts yet." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead>
                <tr>
                  <th>Gym Name</th>
                  <th>Owner Name</th>
                  <th>Owner Email</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d: any) => (
                  <tr key={d.draft_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {d.gym_name ?? '—'}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {d.owner_name ?? '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {editingEmailId === d.draft_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="email"
                            className="og-input"
                            style={{ fontSize: 12, padding: '3px 8px', width: 190 }}
                            placeholder="owner@example.com"
                            value={emailDraft}
                            onChange={e => setEmailDraft(e.target.value)}
                            autoFocus
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => saveDraftEmail(d)}
                            disabled={!EMAIL_RE.test(emailDraft.trim()) || savingEmailId === d.draft_id}
                          >
                            {savingEmailId === d.draft_id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 6px', fontSize: 11 }}
                            onClick={() => { setEditingEmailId(null); setEmailDraft('') }}
                            disabled={savingEmailId === d.draft_id}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : d.owner_email ? (
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {d.owner_email}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#64748B', fontSize: 12 }}>No email</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 6px' }}
                            onClick={() => { setEditingEmailId(d.draft_id); setEmailDraft('') }}
                          >
                            + Add Email
                          </button>
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {d.phone ?? '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {d.city ?? '—'}
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {fmtDate(d.created_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => sendDraft(d)}
                        disabled={sendingDraftId === d.draft_id || !d.owner_email}
                        title={!d.owner_email ? 'Add an email before sending' : undefined}
                      >
                        {sendingDraftId === d.draft_id ? 'Sending…' : 'Send Now'}
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#EF4444', marginLeft: 6 }} onClick={() => deleteDraft(d)} disabled={deletingDraftId === d.draft_id}>
                        <X size={12} style={{ marginRight: 4 }} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FilterBar>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            className="og-input"
            style={{ paddingLeft: 30, width: '100%' }}
            placeholder="Search sent invites by gym name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {/* Sent Invites Card */}
      <Card title="Sent Invites">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon="✉️" message="No invites found." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead>
                <tr>
                  <th>Gym Name</th>
                  <th>Owner Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => (
                  <tr key={inv.invite_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {inv.gym_name ?? '—'}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {inv.owner_email}
                    </td>
                    <td>
                      <Badge label={inv.status} variant={statusVariant(inv.status)} />
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {fmtDate(inv.created_at)}
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {inv.expires_at ? fmtDate(inv.expires_at) : '—'}
                    </td>
                    <td>
                      {inv.status === 'pending' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setCancelTarget(inv)}
                        >
                          <X size={12} style={{ marginRight: 4 }} /> Cancel
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#EF4444', marginLeft: 6 }}
                        onClick={() => setDeleteTarget(inv)}
                        title="Permanently delete this invite record"
                      >
                        <X size={12} style={{ marginRight: 4 }} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invite Modal */}
      <Modal
        open={inviteModal}
        onClose={() => { if (!sending) { setInviteModal(false); setGymName(''); setOwnerName(''); setOwnerEmail(''); setPhone(''); setCity('') } }}
        title="Invite Gym Owner"
        subtitle="Save this gym owner to the invite list. No email is sent yet — you'll trigger the actual invite separately."
      >
        <FormGroup label="Gym Name">
          <input
            type="text"
            className="og-input"
            style={{ width: '100%' }}
            placeholder="e.g. FitZone Tunis"
            value={gymName}
            onChange={e => setGymName(e.target.value)}
            disabled={sending}
          />
        </FormGroup>
        <FormGroup label="Owner Name">
          <input
            type="text"
            className="og-input"
            style={{ width: '100%' }}
            placeholder="e.g. Ahmed Ben Ali"
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            disabled={sending}
          />
        </FormGroup>
        <FormGroup label="Owner Email">
          <input
            type="email"
            className="og-input"
            style={{ width: '100%' }}
            placeholder="owner@example.com (optional — can be added later)"
            value={ownerEmail}
            onChange={e => setOwnerEmail(e.target.value)}
            disabled={sending}
          />
          {ownerEmail.length > 0 && !EMAIL_RE.test(ownerEmail) && (
            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
              Please enter a valid email address.
            </div>
          )}
        </FormGroup>
        <FormGroup label="Phone">
          <input
            type="tel"
            className="og-input"
            style={{ width: '100%' }}
            placeholder="+216 XX XXX XXX"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={sending}
          />
        </FormGroup>
        <FormGroup label="City">
          <CustomSelect
            options={[{ value: '', label: 'Select city (optional)' }, ...TUNISIA_CITIES.map(c => ({ value: c, label: c }))]}
            value={city}
            onChange={setCity}
            style={{ width: '100%' }}
          />
        </FormGroup>
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => { setInviteModal(false); setGymName(''); setOwnerName(''); setOwnerEmail(''); setPhone(''); setCity('') }} disabled={sending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={addToInviteList}
            disabled={!isFormValid || sending}
          >
            {sending ? 'Saving…' : 'Add to Invite List'}
          </button>
        </ModalActions>
      </Modal>

      {/* Cancel Confirm Modal */}
      <Modal
        open={!!cancelTarget}
        onClose={() => { if (!cancelling) setCancelTarget(null) }}
        title="Cancel Invite"
        subtitle="This will revoke the pending invite. The owner will no longer be able to use the invite link."
      >
        {cancelTarget && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{cancelTarget.gym_name}</strong></div>
              <div>Owner Email: <span style={{ fontFamily: 'var(--font-mono)', color: '#4F6BF4' }}>{cancelTarget.owner_email}</span></div>
            </InfoBox>
            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                Keep Invite
              </button>
              <button className="btn btn-danger" onClick={cancelInvite} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, Cancel Invite'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        title="Delete Invite"
        subtitle="This permanently removes the invite record. This cannot be undone."
      >
        {deleteTarget && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{deleteTarget.gym_name}</strong></div>
              <div>Owner Email: <span style={{ fontFamily: 'var(--font-mono)', color: '#4F6BF4' }}>{deleteTarget.owner_email}</span></div>
            </InfoBox>
            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={deleteInvite} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete Invite'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}
