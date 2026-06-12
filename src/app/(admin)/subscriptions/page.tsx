'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, FilterBar, Modal, FormGroup, InfoBox, ModalActions, PageHeader, CustomSelect, UserCell } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import { Search, Download, Tag } from 'lucide-react'

export default function SubscriptionsPage() {
    const [subs, setSubs] = useState<any[]>([])
    const [plans, setPlans] = useState<any[]>([])
    const [plansLoading, setPlansLoading] = useState(true)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('active')
    const [search, setSearch] = useState('')
    const [actionModal, setActionModal] = useState<any>(null)
    const [actionType, setActionType] = useState<'expire' | 'reactivate'>('expire')
    const [saving, setSaving] = useState(false)
    const [editPlanModal, setEditPlanModal] = useState<any>(null)
    const [editPlanForm, setEditPlanForm] = useState({ priceCents: 0, tokens: 0 })

    async function load() {
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        params.set('t', Date.now().toString()) // cache buster
        const data = await fetch('/api/subscriptions?' + params, { cache: 'no-store' }).then(r => r.json())
        setSubs(Array.isArray(data) ? data : [])
        setLoading(false)
    }
    async function loadPlans() {
        setPlansLoading(true)
        const data = await fetch('/api/plans?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json())
        setPlans(Array.isArray(data) ? data : [])
        setPlansLoading(false)
    }
    useEffect(() => { load() }, [statusFilter])
    useEffect(() => { loadPlans() }, [])

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return subs.filter(s => {
            if (!q) return true
            return s.profiles?.full_name?.toLowerCase().includes(q) || s.profiles?.email?.toLowerCase().includes(q)
        })
    }, [subs, search])

    async function applyAction() {
        if (!actionModal) return
        setSaving(true)
        await fetch('/api/subscriptions', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription_id: actionModal.subscription_id, status: actionType === 'expire' ? 'expired' : 'active' })
        })
        setSaving(false); setActionModal(null); load()
    }

    async function handleSavePlan() {
        if (!editPlanModal) return
        setSaving(true)
        const res = await fetch('/api/plans', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan_id: editPlanModal.plan_id,
                price_cents: editPlanForm.priceCents,
                tokens_per_period: editPlanForm.tokens
            })
        })
        setSaving(false)
        if (res.ok) {
            setEditPlanModal(null)
            load()
            loadPlans()
        }
    }

    const active = subs.filter(s => s.status === 'active').length
    const expired = subs.filter(s => s.status === 'expired').length
    const paused = subs.filter(s => s.status === 'paused').length

    function daysLeft(exp: string | null) {
        if (!exp) return null
        const diff = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)
        return diff
    }

    return (
        <div className="page-enter">
            <PageHeader
                title="Subscriptions"
                crumb="Subscriptions"
                actions={
                    <button className="btn btn-secondary btn-sm" onClick={() => { const csv = subs.map(s => `${s.profiles?.full_name},${s.profiles?.email},${s.status},${s.plans?.name},${s.current_period_end}`).join('\n'); const b = new Blob([csv], { type: 'text/csv' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'subscriptions.csv'; a.click() }}>
                        <Download size={14} /> Export CSV
                    </button>
                }
            />

            <FilterBar>
                <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="og-input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
                    { value: 'active', label: 'Active' },
                    { value: 'expired', label: 'Expired' },
                    { value: 'paused', label: 'Paused' },
                    { value: 'all', label: 'All' },
                ]} />
            </FilterBar>

            {/* ── Plans Management ───────────────────────────────── */}
            <Card title="Monthly Plans">
                {plansLoading ? <Spinner /> : plans.length === 0 ? (
                    <EmptyState message="No plans found" />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="og-table">
                            <thead><tr>
                                <th>Plan Name</th>
                                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={11} /> Price (DT)</span></th>
                                <th>Tokens / Period</th>
                                <th>Billing</th>
                                <th>Actions</th>
                            </tr></thead>
                            <tbody>
                                {plans.map((p: any) => (
                                    <tr key={p.plan_id}>
                                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                                            {(p.price_cents / 100).toLocaleString('fr-DZ', { minimumFractionDigits: 0 })} DT
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>{p.tokens_per_period}T</td>
                                        <td><Badge label={p.billing_period ?? 'month'} variant="blue" /></td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border-subtle)' }}
                                                onClick={() => {
                                                    setEditPlanModal(p)
                                                    setEditPlanForm({ priceCents: p.price_cents || 0, tokens: p.tokens_per_period || 0 })
                                                }}>
                                                Edit Plan
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <StatPill label="Active" value={active} />
                <StatPill label="Expired" value={expired} />
                <StatPill label="Paused" value={paused} />
                <StatPill label="Showing" value={filtered.length} />
            </div>

            <Card>
                {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No subscriptions found" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="og-table">
                            <thead><tr>
                                <th>User</th><th>Plan</th><th>Status</th><th>Price</th><th>Tokens/Period</th><th>Started</th><th>Expires</th><th>Days Left</th><th>Actions</th>
                            </tr></thead>
                            <tbody>
                                {filtered.map((s: any) => {
                                    const dl = daysLeft(s.current_period_end)
                                    const urgent = dl !== null && dl < 7 && dl >= 0
                                    return (
                                        <tr key={s.subscription_id}>
                                            <td><UserCell name={s.profiles?.full_name} email={s.profiles?.email} /></td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.plans?.name ?? '—'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.plans?.billing_period}</div>
                                            </td>
                                            <td><Badge label={s.status} /></td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                                                {(s.plans?.price_cents / 100).toLocaleString('fr-DZ', { minimumFractionDigits: 0 })} DT
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>
                                                {s.plans?.tokens_per_period ?? '—'}T
                                            </td>
                                            <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(s.started_at)}</td>
                                            <td style={{ fontSize: 11, color: urgent ? '#F59E0B' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(s.current_period_end)}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: dl === null ? 'var(--text-muted)' : dl < 0 ? '#EF4444' : urgent ? '#F59E0B' : '#10B981' }}>
                                                {dl === null ? '—' : dl < 0 ? 'Expired' : `${dl}d`}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {s.status === 'active' && (
                                                        <button className="btn btn-danger btn-sm" onClick={() => { setActionModal(s); setActionType('expire') }}>Expire</button>
                                                    )}
                                                    {s.status !== 'active' && (
                                                        <button className="btn btn-confirm btn-sm" onClick={() => { setActionModal(s); setActionType('reactivate') }}>Reactivate</button>
                                                    )}
                                                    <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border-subtle)' }} onClick={() => {
                                                        setEditPlanModal(s.plans)
                                                        setEditPlanForm({ priceCents: s.plans?.price_cents || 0, tokens: s.plans?.tokens_per_period || 0 })
                                                    }}>Edit Plan</button>
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

            <Modal open={!!actionModal} onClose={() => setActionModal(null)}
                title={actionType === 'expire' ? 'Expire Subscription' : 'Reactivate Subscription'}
                subtitle={actionType === 'expire' ? 'This will immediately expire the user\'s subscription.' : 'This will re-set the subscription to active.'}>
                {actionModal && (
                    <>
                        <InfoBox>
                            <div>User: <strong style={{ color: 'var(--text-primary)' }}>{actionModal.profiles?.full_name}</strong></div>
                            <div>Plan: <strong style={{ color: 'var(--accent-blue)' }}>{actionModal.plans?.name}</strong></div>
                            <div>Current Status: <strong>{actionModal.status}</strong></div>
                        </InfoBox>
                        <ModalActions>
                            <button className="btn btn-ghost" onClick={() => setActionModal(null)}>Cancel</button>
                            <button className={`btn ${actionType === 'expire' ? 'btn-danger' : 'btn-confirm'}`} onClick={applyAction} disabled={saving}>
                                {saving ? 'Saving…' : actionType === 'expire' ? 'Expire Now' : 'Reactivate'}
                            </button>
                        </ModalActions>
                    </>
                )}
            </Modal>
            <Modal open={!!editPlanModal} onClose={() => setEditPlanModal(null)}
                title="Edit Plan Details"
                subtitle={`Modifying plan: ${editPlanModal?.name}`}>
                {editPlanModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <FormGroup label="Price (DT)">
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    className="og-input"
                                    value={(editPlanForm.priceCents || 0) / 100}
                                    onChange={e => setEditPlanForm({ ...editPlanForm, priceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                                />
                                <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: 'var(--text-muted)' }}>DT</span>
                            </div>
                        </FormGroup>
                        <FormGroup label="Tokens per Period">
                            <input
                                type="number"
                                className="og-input"
                                value={editPlanForm.tokens}
                                onChange={e => setEditPlanForm({ ...editPlanForm, tokens: parseInt(e.target.value) || 0 })}
                            />
                        </FormGroup>
                        <InfoBox>
                            <div><strong>Note:</strong> Changes to the plan will affect all current and future subscribers on this plan.</div>
                        </InfoBox>
                        <ModalActions>
                            <button className="btn btn-ghost" onClick={() => setEditPlanModal(null)}>Cancel</button>
                            <button className="btn btn-confirm" onClick={handleSavePlan} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </ModalActions>
                    </div>
                )}
            </Modal>
        </div>
    )
}
