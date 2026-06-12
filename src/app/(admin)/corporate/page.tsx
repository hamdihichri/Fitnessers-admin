'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, Spinner, EmptyState, Badge, StatPill, Tabs, FilterBar, Modal, FormGroup, InfoBox, ModalActions, PageHeader, CustomSelect, UserCell } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import { Search, Plus, Pencil, Tag } from 'lucide-react'
import Link from 'next/link'

export default function CorporatePage() {
  const [data, setData] = useState<any>({ companies: [], subscriptions: [], seats: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('companies')
  const [search, setSearch] = useState('')
  const [addCompanyModal, setAddCompanyModal] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: '', country: 'Tunisia' })
  const [unassignModal, setUnassignModal] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const d = await fetch('/api/corporate').then(r => r.json())
    setData(d); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filteredCompanies = useMemo(() => {
    const q = search.toLowerCase()
    return (data.companies ?? []).filter((c: any) => !q || c.name?.toLowerCase().includes(q))
  }, [data.companies, search])

  const filteredSubs = useMemo(() => {
    const q = search.toLowerCase()
    return (data.subscriptions ?? []).filter((s: any) => !q || s.companies?.name?.toLowerCase().includes(q))
  }, [data.subscriptions, search])

  const filteredSeats = useMemo(() => {
    const q = search.toLowerCase()
    return (data.seats ?? []).filter((s: any) => !q || s.profiles?.full_name?.toLowerCase().includes(q) || s.profiles?.email?.toLowerCase().includes(q))
  }, [data.seats, search])

  async function addCompany() {
    setSaving(true)
    await fetch('/api/corporate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'company', ...newCompany })
    })
    setSaving(false); setAddCompanyModal(false); setNewCompany({ name: '', country: 'Tunisia' }); load()
  }

  async function unassignSeat() {
    if (!unassignModal) return
    setSaving(true)
    await fetch('/api/corporate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'unassign', seat_id: unassignModal.seat_id })
    })
    setSaving(false); setUnassignModal(null); load()
  }

  // Company seat counts
  const seatsByCompany: Record<string, number> = {}
  for (const seat of data.seats ?? []) {
    const compId = seat.company_subscriptions?.company_id
    if (compId) seatsByCompany[compId] = (seatsByCompany[compId] ?? 0) + 1
  }

  return (
    <div className="page-enter">
      <PageHeader title="Corporate" crumb="Corporate" actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/corporate/discounts" className="btn btn-secondary btn-sm">
            <Tag size={14} /> Bulk Discounts
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => setAddCompanyModal(true)}>
            <Plus size={14} /> Add Company
          </button>
        </div>
      } />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <StatPill label="Companies" value={(data.companies ?? []).length} />
        <StatPill label="Corp Subs" value={(data.subscriptions ?? []).length} />
        <StatPill label="Total Seats" value={(data.seats ?? []).length} />
        <StatPill label="Assigned" value={(data.seats ?? []).filter((s: any) => s.status === 'assigned').length} />
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'companies', label: 'Companies', count: (data.companies ?? []).length },
        { key: 'subscriptions', label: 'Subscriptions', count: (data.subscriptions ?? []).length },
        { key: 'seats', label: 'Seats', count: (data.seats ?? []).length },
      ]} />

      <FilterBar>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="og-input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </FilterBar>

      <Card>
        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto' }}>
            {/* Companies Tab */}
            {tab === 'companies' && (
              filteredCompanies.length === 0 ? <EmptyState message="No companies found" /> : (
                <table className="og-table">
                  <thead><tr>
                    <th>Company</th><th>Country</th><th>HR Admin</th><th>Seats</th><th>Created</th><th></th>
                  </tr></thead>
                   <tbody>
                    {filteredCompanies.map((c: any) => {
                      const hr = (data.hrAdminsListing ?? []).find((h: any) => h.company_id === c.company_id)
                      return (
                        <tr key={c.company_id}>
                          <td><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{c.country}</td>
                          <td>
                            {hr ? (
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                {hr.profiles?.full_name || hr.profiles?.email || '—'}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unassigned</span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                            {seatsByCompany[c.company_id] ?? 0}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(c.created_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Link href={`/companies/${c.company_id}/edit`} className="btn btn-ghost btn-sm">
                              <Pencil size={14} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* Subscriptions Tab */}
            {tab === 'subscriptions' && (
              filteredSubs.length === 0 ? <EmptyState message="No corporate subscriptions" /> : (
                <table className="og-table">
                  <thead><tr>
                    <th>Company</th><th>Seats</th><th>Status</th><th>Started</th><th>Expires</th>
                  </tr></thead>
                  <tbody>
                    {filteredSubs.map((s: any) => (
                      <tr key={s.sub_id ?? s.subscription_id}>
                        <td style={{ fontWeight: 600 }}>{s.companies?.name ?? '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                          {s.seat_count ?? '—'}
                        </td>
                        <td><Badge label={s.status ?? '—'} /></td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(s.started_at)}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(s.expires_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {/* Seats Tab */}
            {tab === 'seats' && (
              filteredSeats.length === 0 ? <EmptyState message="No seats found" /> : (
                <table className="og-table">
                  <thead><tr>
                    <th>Employee</th><th>Company</th><th>Status</th><th>Assigned</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {filteredSeats.map((s: any) => (
                      <tr key={s.seat_id}>
                        <td>
                          {s.profiles ? <UserCell name={s.profiles.full_name} email={s.profiles.email} /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          {s.company_subscriptions?.companies?.name ?? '—'}
                        </td>
                        <td><Badge label={s.status ?? 'unassigned'} /></td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(s.assigned_at)}</td>
                        <td>
                          {s.status === 'assigned' && (
                            <button className="btn btn-danger btn-sm" onClick={() => setUnassignModal(s)}>Unassign</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}
      </Card>

      {/* Add Company Modal */}
      <Modal open={addCompanyModal} onClose={() => setAddCompanyModal(false)} title="Add Company" subtitle="Create a new corporate account.">
        <FormGroup label="Company Name">
          <input className="og-input" style={{ width: '100%' }} placeholder="e.g. Acme Corp" value={newCompany.name} onChange={e => setNewCompany(p => ({ ...p, name: e.target.value }))} />
        </FormGroup>
        <FormGroup label="Country">
          <input className="og-input" style={{ width: '100%' }} value={newCompany.country} onChange={e => setNewCompany(p => ({ ...p, country: e.target.value }))} />
        </FormGroup>
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => setAddCompanyModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={addCompany} disabled={saving || !newCompany.name}>
            {saving ? 'Saving…' : 'Add Company'}
          </button>
        </ModalActions>
      </Modal>

      {/* Unassign Modal */}
      <Modal open={!!unassignModal} onClose={() => setUnassignModal(null)} title="Unassign Seat" subtitle="Remove this user from the corporate seat.">
        {unassignModal && (
          <>
            <InfoBox>
              <div>Employee: <strong style={{ color: 'var(--text-primary)' }}>{unassignModal.profiles?.full_name ?? 'Unknown'}</strong></div>
              <div>Email: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{unassignModal.profiles?.email}</span></div>
            </InfoBox>
            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setUnassignModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={unassignSeat} disabled={saving}>
                {saving ? 'Saving…' : 'Unassign'}
              </button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}
