'use client'
import { useEffect, useState } from 'react'
import {
  Card, Spinner, EmptyState, Badge, FilterBar, Modal, FormGroup,
  InfoBox, ModalActions, PageHeader, toast,
} from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
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
  if (code === 'user_already_exists') return 'An account with this email already exists.'
  if (code === 'invite_already_pending') return 'This owner already has a pending invite.'
  return code
}

export default function GymInvitesPage() {
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // invite modal
  const [inviteModal, setInviteModal] = useState(false)
  const [gymName, setGymName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [sending, setSending] = useState(false)

  // cancel confirm
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)

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

  useEffect(() => { load() }, [])

  const filtered = invites.filter(inv => {
    const q = search.toLowerCase()
    return (
      !q ||
      inv.gym_name?.toLowerCase().includes(q) ||
      inv.owner_email?.toLowerCase().includes(q)
    )
  })

  const isFormValid = gymName.trim().length > 0 && EMAIL_RE.test(ownerEmail.trim())

  async function sendInvite() {
    if (!isFormValid || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/gym-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_name: gymName.trim(), owner_email: ownerEmail.trim() }),
      })
      const json = await res.json()

      if (!res.ok) {
        const errCode = json.error ?? json.message ?? 'unknown_error'
        toast.error(humanError(errCode))
        return
      }

      toast.success('Invite sent to ' + ownerEmail.trim())
      setInviteModal(false)
      setGymName('')
      setOwnerEmail('')
      load()
    } catch (err: any) {
      toast.error('Network error: ' + err.message)
    } finally {
      setSending(false)
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

  return (
    <div className="page-enter">
      <PageHeader
        title="Gym Owner Invites"
        crumb="Gym Invites"
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setInviteModal(true); setGymName(''); setOwnerEmail('') }}
          >
            <Mail size={14} style={{ marginRight: 6 }} /> Invite Gym Owner
          </button>
        }
      />

      <FilterBar>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            className="og-input"
            style={{ paddingLeft: 30, width: '100%' }}
            placeholder="Search by gym name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      <Card>
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
        onClose={() => { if (!sending) { setInviteModal(false) } }}
        title="Invite Gym Owner"
        subtitle="Send an email invite to a new gym owner. They will set their password on the gym dashboard."
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
        <FormGroup label="Owner Email">
          <input
            type="email"
            className="og-input"
            style={{ width: '100%' }}
            placeholder="owner@example.com"
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
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => setInviteModal(false)} disabled={sending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={sendInvite}
            disabled={!isFormValid || sending}
          >
            {sending ? 'Sending…' : 'Send Invite'}
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
    </div>
  )
}
