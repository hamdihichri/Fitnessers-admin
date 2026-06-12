'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  Card, Spinner, EmptyState, Badge, StatPill, 
  Modal, FormGroup, InfoBox, ModalActions, 
  PageHeader, CustomSelect, UserCell, AlertBanner,
  toast, ConfirmModal
} from '@/components/ui'
import { 
  Building, Users, CreditCard, Mail, 
  Phone, Globe, Save, Plus, Search, 
  Send, UserPlus, Trash2, CheckCircle2 
} from 'lucide-react'
import { fmtDate, fmtTND } from '@/lib/utils'

export default function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Section 1: Company Info
  const [company, setCompany] = useState<any>(null)

  // Section 2: HR Admins
  const [hrAdmins, setHrAdmins] = useState<any[]>([])
  const [hrSearch, setHrSearch] = useState('')
  const [hrSearchResults, setHrSearchResults] = useState<any[]>([])
  const [hrSearching, setHrSearching] = useState(false)

  // Confirm Modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/corporate?company_id=${id}`)
      const data = await res.json()
      
      if (!data.company) {
        setError('Company not found')
        setLoading(false)
        return
      }

      setCompany(data.company)
      setHrAdmins(data.hrAdmins || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [id])

  // --- Search Logic ---
  useEffect(() => {
    if (hrSearch.length < 3) {
      setHrSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setHrSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .ilike('email', `%${hrSearch}%`)
        .limit(5)
      setHrSearchResults(data || [])
      setHrSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [hrSearch])

  // --- Section 1 Actions ---
  async function saveCompanyInfo() {
    setSaving(true)
    try {
      const res = await fetch('/api/corporate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: id,
          name: company.name,
          country: company.country,
          industry: company.industry,
          contact_email: company.contact_email,
          contact_phone: company.contact_phone,
          billing_email: company.billing_email,
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Company information updated!')
    } catch (err: any) {
      toast.error('Error saving: ' + err.message)
    } finally {
      setSaving(false)
      loadAll()
    }
  }

  // --- Section 2 Actions ---
  function assignHR(user: any) {
    if (!user?.user_id) return
    const displayName = user.full_name || user.email || 'this user'
    
    setConfirmState({
      open: true,
      title: 'Assign HR Admin',
      message: `Are you sure you want to assign ${displayName} as an HR administrator for this company?`,
      onConfirm: async () => {
        setSaving(true)
        const { data, error } = await supabase.rpc('assign_company_hr', {
          p_company_id: id,
          p_user_id: user.user_id,
          p_demote_previous: false,
          p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
        })

        if (error) {
          toast.error('Error: ' + error.message)
        } else if (data?.ok === false) {
          toast.error('Error: ' + (data?.error || 'Unknown error'))
        } else {
          toast.success('HR Admin assigned.')
          setHrSearchResults([])
          setHrSearch('')
          loadAll()
        }
        setSaving(false)
      }
    })
  }

  function removeHR(hr: any) {
    const displayName = hr.profiles?.full_name || hr.profiles?.email || 'this user'
    
    setConfirmState({
      open: true,
      title: 'Remove HR Admin',
      message: `Are you sure you want to remove ${displayName} from the HR administrators list? They will be demoted to a regular employee.`,
      onConfirm: async () => {
        setSaving(true)
        const { error } = await supabase.rpc('remove_company_hr', {
          p_company_id: id,
          p_actor_id: '51a1ea96-73b4-4a4f-be84-3575f0670366'
        })
        if (error) toast.error('Error: ' + error.message)
        else {
          toast.success('HR Admin removed.')
          loadAll()
        }
        setSaving(false)
      }
    })
  }

  // --- Render ---
  if (loading) return <div className="page-enter" style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
  if (error) return <div className="page-enter" style={{ padding: 40 }}><AlertBanner variant="red">Error: {error}</AlertBanner></div>
  if (!company) return <div className="page-enter" style={{ padding: 40 }}><EmptyState message="Company not found" /></div>

  return (
    <div className="page-enter">
      <ConfirmModal 
        open={confirmState.open}
        onClose={() => setConfirmState(s => ({ ...s, open: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
      />
      <PageHeader 
        title={`Edit ${company.name}`} 
        crumb="Corporate / Edit" 
        actions={
          <button className="btn btn-primary btn-sm" onClick={loadAll}>
            <Search size={14} /> Refresh Data
          </button>
        }
      />

      {/* Basic Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <StatPill label="ID" value={company.company_id} />
        <StatPill label="HR Admins" value={hrAdmins.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Section 1: Company Info */}
          <Card title="Company Information">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
              <FormGroup label="Company Name">
                <input 
                  className="og-input" 
                  value={company.name || ''} 
                  onChange={e => setCompany({...company, name: e.target.value})} 
                  placeholder="e.g. Acme Corp"
                />
              </FormGroup>
              <FormGroup label="Industry">
                <input 
                  className="og-input" 
                  value={company.industry || ''} 
                  onChange={e => setCompany({...company, industry: e.target.value})}
                  placeholder="e.g. Technology"
                />
              </FormGroup>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormGroup label="Contact Email">
                  <input 
                    className="og-input" 
                    value={company.contact_email || ''} 
                    onChange={e => setCompany({...company, contact_email: e.target.value})}
                    placeholder="contact@company.com"
                  />
                </FormGroup>
                <FormGroup label="Contact Phone">
                  <input 
                    className="og-input" 
                    value={company.contact_phone || ''} 
                    onChange={e => setCompany({...company, contact_phone: e.target.value})}
                    placeholder="+216 ..."
                  />
                </FormGroup>
              </div>
              <FormGroup label="Billing Email">
                <input 
                  className="og-input" 
                  value={company.billing_email || ''} 
                  onChange={e => setCompany({...company, billing_email: e.target.value})}
                  placeholder="billing@company.com"
                />
              </FormGroup>
              <FormGroup label="Country">
                <input 
                  className="og-input" 
                  value={company.country || ''} 
                  onChange={e => setCompany({...company, country: e.target.value})}
                />
              </FormGroup>
              <div style={{ marginTop: 8 }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }} 
                  onClick={saveCompanyInfo}
                  disabled={saving || !company.name}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Company Info'}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Section 2: HR Admins */}
          <Card title="HR Administrators">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
              {hrAdmins.length === 0 ? (
                <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>No HR admins assigned yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hrAdmins.map((hr: any, idx: number) => (
                    <div key={hr.profiles?.user_id || `hr-${idx}`} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 12,
                      border: '1px solid var(--border)'
                    }}>
                      <UserCell name={hr.profiles?.full_name} email={hr.profiles?.email} />
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: '#fb7185' }} 
                        title="Remove HR Role"
                        onClick={() => removeHR(hr)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <FormGroup label="Assign New HR Admin">
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      className="og-input" 
                      style={{ paddingLeft: 36 }}
                      placeholder="Search by email..."
                      value={hrSearch}
                      onChange={e => setHrSearch(e.target.value)}
                    />
                    
                    {hrSearching && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><Spinner /></div>}

                    {hrSearchResults.length > 0 && (
                      <div className="dropdown-menu" style={{ width: '100%', left: 0, marginTop: 4 }}>
                        {hrSearchResults.map((u, idx) => (
                          <div 
                            key={u.user_id || `search-${idx}`} 
                            className="dropdown-item" 
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            onClick={() => assignHR(u)}
                          >
                            <UserCell name={u.full_name} email={u.email} />
                            <UserPlus size={14} color="var(--accent-blue)" />
                          </div>
                        ))}
                      </div>
                    )}
                    {hrSearch.length >= 3 && !hrSearching && hrSearchResults.length === 0 && (
                      <div className="dropdown-menu" style={{ width: '100%', left: 0, padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        No users found with this email.
                      </div>
                    )}
                  </div>
                </FormGroup>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
