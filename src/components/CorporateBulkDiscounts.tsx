'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Spinner, InfoBox, Badge } from '@/components/ui'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, RefreshCw } from 'lucide-react'
import { fmtTND } from '@/lib/utils'

interface DiscountTier {
  min_seats: number
  discount_bps: number
  discount_pct?: number
}

interface PriceBreakdown {
  ok: boolean
  plan_name: string
  seats: number
  unit_price_cents: number
  subtotal_cents: number
  discount_pct: number
  discount_amount_cents: number
  total_cents: number
  price_per_seat_cents: number
  tokens_per_seat: number
}

export function CorporateBulkDiscounts() {
  const [tiers, setTiers] = useState<DiscountTier[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previews, setPreviews] = useState<Record<string, PriceBreakdown[]>>({ basic: [], pro: [] })
  const [previewLoading, setPreviewLoading] = useState(false)

  async function loadData() {
    setLoading(true)
    // Load both tiers and plans
    const [tiersRes, plansRes] = await Promise.all([
      supabase.rpc('get_corporate_bulk_discounts'),
      supabase.from('plans').select('*').order('plan_id')
    ])

    if (tiersRes.error) {
      alert('Error loading discounts: ' + tiersRes.error.message)
    } else {
      setTiers(tiersRes.data || [])
      loadPreviews(tiersRes.data || [])
    }

    if (plansRes.error) {
      console.error('Error loading plans:', plansRes.error)
    } else {
      setPlans(plansRes.data || [])
    }
    setLoading(false)
  }

  async function loadPreviews(currentTiers: DiscountTier[]) {
    if (currentTiers.length === 0) {
      setPreviews({ basic: [], pro: [] })
      return
    }
    setPreviewLoading(true)
    const basic: PriceBreakdown[] = []
    const pro: PriceBreakdown[] = []

    for (const tier of currentTiers) {
      const { data: bData } = await supabase.rpc('calculate_corporate_price', {
        p_plan_id: 7,
        p_seats: tier.min_seats
      })
      if (bData?.ok) basic.push(bData)

      const { data: pData } = await supabase.rpc('calculate_corporate_price', {
        p_plan_id: 8,
        p_seats: tier.min_seats
      })
      if (pData?.ok) pro.push(pData)
    }

    setPreviews({ basic, pro })
    setPreviewLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function addTier() {
    const lastMinSeats = tiers.length > 0 ? tiers[tiers.length - 1].min_seats : 0
    setTiers([...tiers, { min_seats: lastMinSeats + 10, discount_bps: 0, discount_pct: 0 }])
  }

  function removeTier(index: number) {
    const newTiers = tiers.filter((_, i) => i !== index)
    setTiers(newTiers)
  }

  function updateTierSeats(index: number, seats: number) {
    const newTiers = [...tiers]
    newTiers[index].min_seats = seats
    setTiers(newTiers)
  }

  function updateTierDiscount(index: number, pct: number) {
    const newTiers = [...tiers]
    newTiers[index].discount_pct = pct
    newTiers[index].discount_bps = pct * 100
    setTiers(newTiers)
  }

  async function saveTiers() {
    setSaving(true)
    const payload = tiers.map(t => ({
      min_seats: t.min_seats,
      discount_bps: Math.round((t.discount_pct || 0) * 100)
    }))

    const { data, error } = await supabase.rpc('set_corporate_bulk_discounts', {
      p_tiers: payload,
      p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
    })

    if (error) {
      alert('Error saving discounts: ' + error.message)
    } else if (data?.ok === false) {
      alert('Error saving discounts: ' + data.error)
    } else {
      alert('Discounts saved successfully!')
      loadData()
    }
    setSaving(false)
  }

  return (
    <Card glass>
      <div style={{ animation: 'pageEnter 0.4s var(--ease-out-expo)' }}>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}><Spinner /></div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="og-table">
                  <thead>
                    <tr>
                      <th>Min Seats</th>
                      <th>Discount %</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ position: 'relative', maxWidth: 120 }}>
                            <input 
                              type="number"
                              className="og-input"
                              style={{ paddingRight: 45, fontWeight: 600, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}
                              value={tier.min_seats}
                              onChange={(e) => updateTierSeats(i, parseInt(e.target.value) || 0)}
                              min="10"
                              step="10"
                            />
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>seats</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ position: 'relative', maxWidth: 100 }}>
                            <input 
                              type="number"
                              className="og-input"
                              style={{ paddingRight: 30 }}
                              value={tier.discount_pct ?? (tier.discount_bps / 100)}
                              onChange={(e) => updateTierDiscount(i, parseInt(e.target.value) || 0)}
                              min="0"
                              max="90"
                            />
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ color: 'var(--accent-red)' }}
                            onClick={() => removeTier(i)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tiers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                          No discount tiers configured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" onClick={addTier}>
                  <Plus size={14} /> Add Tier
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveTiers} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div style={{ marginTop: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Live Preview
                </div>
                {previewLoading ? (
                  <Spinner />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 20, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Badge label="Basic Plan" variant="blue" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {fmtTND(plans.find(p => p.plan_id === 7)?.price_cents || 0)}/mo base
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {previews.basic.map((p, i) => (
                          <div key={i} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{p.seats} seats</span>
                            <span style={{ fontWeight: 600 }}>
                              {fmtTND(p.price_per_seat_cents)}/seat 
                              <span style={{ color: 'var(--accent-blue)', marginLeft: 8 }}>({p.discount_pct}% off)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 20, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Badge label="Pro Plan" variant="purple" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {fmtTND(plans.find(p => p.plan_id === 8)?.price_cents || 0)}/mo base
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {previews.pro.map((p, i) => (
                          <div key={i} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{p.seats} seats</span>
                            <span style={{ fontWeight: 600 }}>
                              {fmtTND(p.price_per_seat_cents)}/seat 
                              <span style={{ color: 'var(--accent-blue)', marginLeft: 8 }}>({p.discount_pct}% off)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </Card>
  )
}
