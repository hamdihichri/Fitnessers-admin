'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, Tabs, FilterBar, Modal, FormGroup, ModalActions, InfoBox, PageHeader } from '@/components/ui'
import { fmtDate, timeAgo } from '@/lib/utils'
import { CheckCircle, XCircle, RefreshCw, ShieldCheck } from 'lucide-react'

export default function WomenOnlyRequestsPage() {
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('pending')
    const [reviewModal, setReviewModal] = useState<{ req: any; action: 'approve' | 'reject' } | null>(null)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true)
        const data = await fetch('/api/women-only-requests').then(r => r.json())
        setRequests(Array.isArray(data) ? data : [])
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const pending = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
    const approved = useMemo(() => requests.filter(r => r.status === 'approved'), [requests])
    const rejected = useMemo(() => requests.filter(r => r.status === 'rejected'), [requests])

    const shown = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected

    async function submitReview() {
        if (!reviewModal) return
        setSaving(true)
        setError('')
        const res = await fetch('/api/women-only-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request_id: reviewModal.req.request_id,
                action: reviewModal.action,
                notes,
            }),
        })
        const json = await res.json()
        setSaving(false)
        if (json.error) { setError(json.error); return }
        setReviewModal(null)
        setNotes('')
        load()
    }

    function openReview(req: any, action: 'approve' | 'reject') {
        setNotes('')
        setError('')
        setReviewModal({ req, action })
    }

    return (
        <div className="page-enter">
            <PageHeader
                title="Women-Only Requests"
                crumb="Women-Only Requests"
                actions={
                    <button className="btn btn-ghost btn-sm" onClick={load}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                }
            />

            {/* Info banner */}
            <div style={{
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: 10, padding: '14px 18px', marginBottom: 20,
                display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
                <ShieldCheck size={18} style={{ color: '#A78BFA', flexShrink: 0, marginTop: 1 }} />
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#A78BFA', marginBottom: 4 }}>Protected Field</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        The <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(139,92,246,0.12)', padding: '1px 5px', borderRadius: 4 }}>women_only</code> flag on gyms is protected by RLS policy — gym owners cannot change it directly.
                        They must submit a change request which a superadmin approves or rejects via this page.
                        Approval calls <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(139,92,246,0.12)', padding: '1px 5px', borderRadius: 4 }}>review_women_only_request()</code> which applies the change.
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <StatPill label="Pending" value={pending.length} />
                <StatPill label="Approved" value={approved.length} />
                <StatPill label="Rejected" value={rejected.length} />
                <StatPill label="Total" value={requests.length} />
            </div>

            <Tabs active={tab} onChange={setTab} tabs={[
                { key: 'pending', label: 'Pending', count: pending.length },
                { key: 'approved', label: 'Approved', count: approved.length },
                { key: 'rejected', label: 'Rejected', count: rejected.length },
            ]} />

            <Card>
                {loading ? <Spinner /> : shown.length === 0 ? (
                    <EmptyState message={
                        tab === 'pending'
                            ? 'No pending requests — all clear 🎉'
                            : `No ${tab} requests yet`
                    } />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="og-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Gym</th>
                                    <th>Owner</th>
                                    <th>Current Value</th>
                                    <th>Requested Value</th>
                                    <th>Submitted</th>
                                    {tab !== 'pending' && <th>Status</th>}
                                    {tab !== 'pending' && <th>Admin Note</th>}
                                    {tab === 'pending' && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((r: any) => (
                                    <tr key={r.request_id} className={r.status === 'pending' ? 'row-pending' : ''}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{r.request_id}</td>
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.gyms?.name ?? '—'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.gyms?.city}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 500 }}>{r.profiles?.full_name ?? '—'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.profiles?.email}</div>
                                        </td>
                                        <td>
                                            <WomenOnlyBadge value={r.gyms?.women_only} />
                                        </td>
                                        <td>
                                            <WomenOnlyBadge value={r.requested_value} highlight />
                                        </td>
                                        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {timeAgo(r.created_at)}
                                            <div style={{ fontSize: 10 }}>{fmtDate(r.created_at)}</div>
                                        </td>
                                        {tab !== 'pending' && (
                                            <td><Badge label={r.status} /></td>
                                        )}
                                        {tab !== 'pending' && (
                                            <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.admin_note || '—'}
                                            </td>
                                        )}
                                        {tab === 'pending' && (
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="btn btn-confirm btn-sm"
                                                        style={{ gap: 5 }}
                                                        onClick={() => openReview(r, 'approve')}
                                                    >
                                                        <CheckCircle size={12} /> Approve
                                                    </button>
                                                    <button
                                                        className="btn btn-reject btn-sm"
                                                        style={{ gap: 5 }}
                                                        onClick={() => openReview(r, 'reject')}
                                                    >
                                                        <XCircle size={12} /> Reject
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Review modal */}
            <Modal
                open={!!reviewModal}
                onClose={() => setReviewModal(null)}
                title={reviewModal?.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                subtitle={
                    reviewModal?.action === 'approve'
                        ? 'This will call review_women_only_request() and apply the change to the gym.'
                        : 'This will reject the request. The gym\'s women_only value will remain unchanged.'
                }
            >
                {reviewModal && (
                    <>
                        <InfoBox>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Gym:</span> <strong style={{ color: 'var(--text-primary)' }}>{reviewModal.req.gyms?.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({reviewModal.req.gyms?.city})</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Change:</span>
                                    <WomenOnlyBadge value={reviewModal.req.gyms?.women_only} />
                                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                                    <WomenOnlyBadge value={reviewModal.req.requested_value} highlight />
                                </div>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Requested by:</span> <strong style={{ color: 'var(--text-primary)' }}>{reviewModal.req.profiles?.full_name}</strong></div>
                            </div>
                        </InfoBox>

                        <FormGroup label="Admin Note (optional)">
                            <textarea
                                className="og-input"
                                style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                                placeholder={reviewModal.action === 'approve'
                                    ? 'e.g. Verified with gym license documents…'
                                    : 'e.g. Insufficient documentation provided…'
                                }
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </FormGroup>

                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#EF4444' }}>
                                ⚠ {error}
                            </div>
                        )}

                        <ModalActions>
                            <button className="btn btn-ghost" onClick={() => setReviewModal(null)}>
                                Cancel
                            </button>
                            <button
                                className={`btn ${reviewModal.action === 'approve' ? 'btn-confirm' : 'btn-reject'}`}
                                onClick={submitReview}
                                disabled={saving}
                            >
                                {saving ? 'Processing…' : reviewModal.action === 'approve' ? '✓ Approve & Apply' : '✕ Reject Request'}
                            </button>
                        </ModalActions>
                    </>
                )}
            </Modal>
        </div>
    )
}

function WomenOnlyBadge({ value, highlight = false }: { value: boolean; highlight?: boolean }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
            background: value
                ? highlight ? 'rgba(167,139,250,0.18)' : 'rgba(139,92,246,0.10)'
                : highlight ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.08)',
            color: value ? '#A78BFA' : 'var(--text-muted)',
            border: `1px solid ${value ? 'rgba(167,139,250,0.35)' : 'rgba(100,116,139,0.2)'}`,
            transition: 'all 0.2s',
        }}>
            {value ? '♀ Women Only' : '⊕ Mixed'}
        </span>
    )
}
