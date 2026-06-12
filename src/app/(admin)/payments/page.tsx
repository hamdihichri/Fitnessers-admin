'use client'
import { useEffect, useState, useMemo, Fragment } from 'react'
import { Card, Spinner, EmptyState, Badge, FilterBar, UserCell, Tabs, Modal, InfoBox, ModalActions, providerBadge, PageHeader, CustomSelect, toast } from '@/components/ui'
import { fmtDate, fmtTND, fmtDateTime, exportToCSV } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Download, FileText, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'


export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [gyms, setGyms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [provider, setProvider] = useState('')
  const [confirmModal, setConfirmModal] = useState<any>(null)
  const [rejectModal, setRejectModal] = useState<any>(null)
  const [txRef, setTxRef] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  const [txRefInputs, setTxRefInputs] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Fee Settings State
  const [feeBps, setFeeBps] = useState<number>(1000)
  const [feeInput, setFeeInput] = useState<string>('10')
  const [savingFee, setSavingFee] = useState(false)

  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const handleCopyRib = async (rib: string, id: string) => {
    try {
      await navigator.clipboard.writeText(rib)
      toast.success('RIB copied to clipboard!')
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err: any) {
      toast.error('Failed to copy: ' + err.message)
    }
  }

  const handlePaidClick = (p: any) => {
    const currentRef = txRefInputs[p.withdraw_id] !== undefined ? txRefInputs[p.withdraw_id] : (p.bank_tx_ref || '')
    if (!currentRef.trim()) {
      setWarnings(prev => ({ ...prev, [p.withdraw_id]: "Please enter a transaction reference before confirming payment." }))
      if (!expandedRows.includes(p.withdraw_id)) {
        setExpandedRows(prev => [...prev, p.withdraw_id])
      }
      return
    }
    setWarnings(prev => {
      const next = { ...prev }
      delete next[p.withdraw_id]
      return next
    })
    setTxRef(currentRef.trim())
    setConfirmModal(p)
  }

  // Add this helper at the top of the component:
  async function authFetch(url: string, body: object) {
    const session = (await supabase.auth.getSession()).data.session
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify(body)
    })
  }


  async function load() {
    setLoading(true)
    try {
      // Load fee setting
      fetch('/api/platform-settings?key=gym_withdraw_fee_bps')
        .then(r => r.json())
        .then(d => {
          if (d?.value_int !== undefined) {
            setFeeBps(d.value_int)
            setFeeInput((d.value_int / 100).toFixed(1))
          }
        })

      if (tab === 'balances') {
        const data = await fetch('/api/tokens/gym-balances').then(r => r.json())
        setGyms(Array.isArray(data) ? data : [])
      } else {
        const params = new URLSearchParams()
        if (tab !== 'all') params.set('status', tab)
        if (provider) params.set('provider', provider)
        const data = await fetch('/api/payments?' + params).then(r => r.json())
        setPayments(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [tab, provider])

  const pendingCount = useMemo(() => payments.filter((p: any) => p.status === 'requested').length, [payments])
  const pendingAmt = useMemo(() => payments.filter((p: any) => p.status === 'requested').reduce((s: number, p: any) => s + p.payout_amount_cents, 0), [payments])

  async function doConfirm() {
    if (!txRef.trim()) return
    await authFetch('/api/payments', { 
      payment_id: confirmModal.withdraw_id, 
      status: 'paid',
      bank_tx_ref: txRef.trim()
    })
    setConfirmModal(null); setTxRef(''); load()
  }

  async function doReject() {
    await authFetch('/api/payments', { payment_id: rejectModal.withdraw_id, status: 'rejected' })
    setRejectModal(null); load()
  }

  async function bulkConfirm() {
    if (!confirm('Confirm ALL pending withdrawal requests as PAID?')) return
    const pending = payments.filter((p: any) => p.status === 'requested')
    await Promise.all(pending.map((p: any) =>
      authFetch('/api/payments', { payment_id: p.withdraw_id, status: 'paid' })
    ))
    load()
  }

  // Save handler
  async function saveFee() {
    setSavingFee(true)
    const bps = Math.round(parseFloat(feeInput) * 100)
    if (isNaN(bps) || bps < 0 || bps > 5000) {
      setSavingFee(false)
      toast.error('Invalid fee rate')
      return
    }
    try {
      const res = await fetch('/api/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'gym_withdraw_fee_bps', value_int: bps })
      })
      if (res.ok) {
        setFeeBps(bps)
        toast.success('Withdrawal fee rate updated')
      } else {
        toast.error('Failed to save fee rate')
      }
    } catch (err) {
      toast.error('Error saving fee rate')
    } finally {
      setSavingFee(false)
    }
  }


  return (
    <div className="page-enter">
      <PageHeader
        title="Payment Confirmations"
        crumb="Payments"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm print-visible" onClick={() => window.print()}>
              <FileText size={14} style={{ marginRight: 6 }} /> Export Report
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const flat = payments.map(p => ({
                withdraw_id: p.withdraw_id,
                gym_name: p.gyms?.name,
                requested_amount_tnd: (p.requested_amount_cents / 100).toFixed(2),
                payout_amount_tnd: (p.payout_amount_cents / 100).toFixed(2),
                month: p.request_month,
                status: p.status,
                created_at: p.created_at,
                paid_at: p.paid_at
              }))
              exportToCSV('gym_withdrawals_report', flat)
            }}>
              <Download size={14} style={{ marginRight: 6 }} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Fee Settings Section */}
      <div style={{ marginBottom: 20 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1 }}>
                WITHDRAWAL FEE RATE
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{(feeBps / 100).toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Applied to all new withdrawal requests
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min="0" max="50" step="0.5"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>%</span>
              <button className="btn btn-primary btn-sm" onClick={saveFee} disabled={savingFee}>
                {savingFee ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {tab === 'pending' && pendingCount > 0 && (
        <div className="alert-banner alert-amber">
          <span>⚠️ <strong>{pendingCount}</strong> payments pending — <strong>{fmtTND(pendingAmt)}</strong> awaiting confirmation</span>
        </div>
      )}

      <Tabs
        active={tab}
        onChange={t => { setTab(t); }}
        tabs={[
          { key: 'pending', label: 'Pending', count: pendingCount },
          { key: 'balances', label: 'Gym Balances' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ]}
      />

      <FilterBar>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {tab === 'balances' ? `${gyms.length} gyms with earnings` : `${payments.length} requests matching filters`}
        </div>
      </FilterBar>

      <Card>
        {loading ? <Spinner /> : tab === 'balances' ? (
          gyms.length === 0 ? <EmptyState message="No gym balances found" /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="og-table">
                <thead>
                  <tr>
                    <th>Gym</th>
                    <th>Location</th>
                    <th>Total Collected</th>
                    <th>Already Paid</th>
                    <th>Available Balance</th>
                    <th>TND Value</th>
                  </tr>
                </thead>
                <tbody>
                  {gyms.filter(g => g.total_collected > 0).map((gym) => (
                    <tr key={gym.gym_id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{gym.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gym.venue_type}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{gym.city}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{gym.total_collected} T</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>-{gym.total_withdrawn} T</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: gym.balance > 0 ? '#10B981' : 'inherit' }}>
                        {gym.balance} T
                      </td>
                      <td style={{ fontWeight: 600 }}>{gym.estimated_value?.toFixed(2)} TND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : payments.length === 0 ? <EmptyState icon={tab === 'pending' ? '🎉' : '📭'} message={tab === 'pending' ? 'No pending payments' : 'No payments found'} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table">
              <thead><tr>
                <th>Gym</th><th>Requested Amt</th><th>Month</th><th>Payout Amt</th><th>Status</th><th>Requested Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {payments.map((p: any) => {
                  const isExpanded = expandedRows.includes(p.withdraw_id);
                  const currentTxRefVal = txRefInputs[p.withdraw_id] !== undefined ? txRefInputs[p.withdraw_id] : (p.bank_tx_ref || '');
                  const hasRib = !!p.bank_rib_snapshot;

                  return (
                    <Fragment key={p.withdraw_id}>
                      <tr
                        className={`${p.status === 'requested' ? 'row-pending' : ''} ${isExpanded ? 'row-expanded-header' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleRow(p.withdraw_id)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.gyms?.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gyms?.city}, {p.gyms?.country}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B' }}>{fmtTND(p.requested_amount_cents)}</td>
                        <td>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' 
                          }}>
                            {new Date(p.request_month).toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' })}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#10B981', fontWeight: 700 }}>{fmtTND(p.payout_amount_cents)}</td>
                        <td><Badge label={p.status === 'requested' ? 'pending' : p.status} /></td>
                        <td style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{fmtDateTime(p.created_at)}</td>
                        <td>
                          {p.status === 'requested' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn btn-confirm btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePaidClick(p);
                                }}
                                disabled={!hasRib}
                                style={!hasRib ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                ✓ Paid
                              </button>
                              <button
                                className="btn btn-reject btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectModal(p);
                                }}
                              >
                                ✗ Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                              {p.paid_at ? fmtDate(p.paid_at) : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${p.withdraw_id}-expanded`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                          <td colSpan={7} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>Bank Details</div>
                                {!hasRib ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)'
                                  }}>
                                    ⚠ No RIB on file — gym owner has not set a bank account.
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                    <div>
                                      <span style={{ color: 'var(--text-muted)' }}>Account holder :</span> <strong style={{ color: 'var(--text)' }}>{p.bank_rib_name_snapshot || 'N/A'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ color: 'var(--text-muted)' }}>RIB :</span>
                                      <code style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                                        {p.bank_rib_snapshot}
                                      </code>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleCopyRib(p.bank_rib_snapshot!, p.withdraw_id)}
                                        style={{ padding: 4, minWidth: 'auto', height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Copy RIB"
                                      >
                                        {copiedId === p.withdraw_id ? <Check size={14} style={{ color: '#10B981' }} /> : <Copy size={14} />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>Transaction Reference</div>
                                <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
                                  <input
                                    type="text"
                                    value={currentTxRefVal}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setTxRefInputs(prev => ({ ...prev, [p.withdraw_id]: val }));
                                    }}
                                    placeholder="e.g. VIR-2026-06-00123"
                                    style={{
                                      flex: 1, height: 36, padding: '0 12px',
                                      background: 'var(--bg-hover)', border: '1px solid var(--border)',
                                      borderRadius: 6, fontSize: 13, color: 'var(--text)',
                                      fontFamily: 'var(--font-mono)', outline: 'none'
                                    }}
                                  />
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('gym_withdraw_requests')
                                          .update({ bank_tx_ref: currentTxRefVal })
                                          .eq('withdraw_id', p.withdraw_id)
                                        if (error) {
                                          toast.error('Failed to save transaction reference: ' + error.message)
                                        } else {
                                          toast.success('Transaction reference saved successfully!')
                                          setPayments(prev => prev.map(item => item.withdraw_id === p.withdraw_id ? { ...item, bank_tx_ref: currentTxRefVal } : item))
                                          setWarnings(prev => {
                                            const next = { ...prev }
                                            delete next[p.withdraw_id]
                                            return next
                                          })
                                        }
                                      } catch (err: any) {
                                        toast.error('Error saving: ' + err.message)
                                      }
                                    }}
                                  >
                                    Save Ref
                                  </button>
                                </div>
                                {warnings[p.withdraw_id] && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    ⚠ {warnings[p.withdraw_id]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirm Modal */}
      <Modal open={!!confirmModal} onClose={() => { setConfirmModal(null); setTxRef('') }} title="Confirm Payment" subtitle="Mark this withdrawal as paid.">
        {confirmModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{confirmModal.gyms?.name ?? 'Unknown'}</strong></div>
              <div>Requested: <strong style={{ color: '#F59E0B' }}>{fmtTND(confirmModal.requested_amount_cents)}</strong></div>
              <div>Payout: <strong style={{ color: '#10B981' }}>{fmtTND(confirmModal.payout_amount_cents)}</strong></div>
              <div>Month: <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)'
              }}>{new Date(confirmModal.request_month).toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' })}</span></div>
              <div>Request ID: <span style={{ fontFamily: 'var(--font-mono)', color: '#64748B' }}>#{confirmModal.withdraw_id}</span></div>
              {confirmModal.bank_rib_snapshot && (
                <div>RIB: <span style={{ fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>{confirmModal.bank_rib_snapshot}</span>
                  {confirmModal.bank_rib_name_snapshot && <span style={{ color: '#64748B' }}> · {confirmModal.bank_rib_name_snapshot}</span>}
                </div>
              )}
            </InfoBox>

            {/* Bank reference input */}
            <div style={{ margin: '16px 0 4px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Bank Transaction Reference *
              </label>
              <input
                type="text"
                value={txRef}
                onChange={e => setTxRef(e.target.value)}
                placeholder="e.g. VIR-2026-06-00123"
                autoFocus
                style={{
                  width: '100%', height: 44, padding: '0 14px',
                  background: 'var(--bg-hover)', border: `1px solid ${txRef.trim() ? '#10B981' : 'var(--border)'}`,
                  borderRadius: 8, fontSize: 13, color: 'var(--text)',
                  fontFamily: 'var(--font-mono)', outline: 'none',
                  transition: 'border-color 0.15s'
                }}
              />
              {!txRef.trim() && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#F59E0B' }}>
                  ⚠ Required — enter the bank transfer reference before confirming.
                </p>
              )}
            </div>

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => { setConfirmModal(null); setTxRef('') }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={doConfirm}
                disabled={!txRef.trim()}
                style={{ opacity: txRef.trim() ? 1 : 0.4, cursor: txRef.trim() ? 'pointer' : 'not-allowed' }}
              >
                ✓ Confirm Payment
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Payment" subtitle="The subscription will not be activated.">
        {rejectModal && (
          <>
            <InfoBox>
              <div>Gym: <strong style={{ color: '#E4EBF5' }}>{rejectModal.gyms?.name ?? 'Unknown'}</strong></div>
              <div>Amount: <strong style={{ color: '#EF4444' }}>{fmtTND(rejectModal.requested_amount_cents)}</strong></div>
              <div>Request ID: <span style={{ fontFamily: 'var(--font-mono)', color: '#64748B' }}>#{rejectModal.withdraw_id}</span></div>
            </InfoBox>
            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
              <button style={{ background: '#EF4444', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }} onClick={doReject}>✗ Reject Payment</button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}
