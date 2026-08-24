'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Card, Spinner, EmptyState, Badge, StatPill,
  Tabs, FilterBar, Modal, FormGroup, ModalActions,
  InfoBox, PageHeader, toast
} from '@/components/ui'
import { Copy, Download, RefreshCw, Trash2, Tag, CheckSquare, Settings, FileText, Search, Printer, Building, Ticket, SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- Types ---
type RedemptionCode = {
  code_id: number;
  code: string;
  plan_id: number;
  duration_days: number;
  is_used: boolean;
  is_disabled: boolean;
  used_at: string | null;
  disabled_at: string | null;
  is_distributed: boolean;
  distributed_at: string | null;
  seller_name: string | null;
  seller_phone: string | null;
  notes: string | null;
  created_at: string;
  expires_at: string | null;
  company_id: number | null;
  plans: { name: string; billing_period: string; price_cents: number } | null;
  profiles: { full_name: string | null; email: string | null } | null;
  companies: { name: string; contact_email: string } | null;
};

type Company = {
  company_id: number;
  name: string;
};

type Plan = {
  plan_id: number;
  name: string;
  price_cents: number;
  billing_period: string;
  tokens_per_period: number;
};

// --- Helpers ---
function getCodeStatus(code: RedemptionCode): 'unused' | 'used' | 'disabled' | 'expired' {
  if (code.is_used) return 'used';
  if (code.is_disabled) return 'disabled';
  if (code.expires_at && new Date(code.expires_at) < new Date()) return 'expired';
  return 'unused';
}

function StatusBadge({ status }: { status: ReturnType<typeof getCodeStatus> }) {
  const map = {
    unused: { bg: '#F1F5F9', color: '#64748B', label: 'Unused' },
    used: { bg: '#DCFCE7', color: '#16A34A', label: 'Used' },
    disabled: { bg: '#FEE2E2', color: '#DC2626', label: 'Disabled' },
    expired: { bg: '#FFEDD5', color: '#EA580C', label: 'Expired' }
  }
  const s = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

function DistributedBadge({
  isDistributed,
  distributedAt,
  onClick
}: {
  isDistributed: boolean;
  distributedAt: string | null;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      title={isDistributed && distributedAt ? `Distributed ${timeAgo(distributedAt)} (${new Date(distributedAt).toLocaleString()})` : 'Click to toggle distribution status'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: isDistributed ? '#DCFCE7' : '#F1F5F9',
        color: isDistributed ? '#16A34A' : '#64748B'
      }}
    >
      {isDistributed ? 'Distributed' : 'Not sent'}
    </span>
  )
}

function timeAgo(dateString: string | null) {
  if (!dateString) return ''
  const ms = Date.now() - new Date(dateString).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(dateString).toLocaleDateString()
}

// --- Custom Filter Select Component ---
function CustomFilterSelect<T extends string | number>({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  minWidth = 140
}: {
  icon: any
  label: string
  value: T
  options: { label: string; value: T }[]
  onChange: (val: T) => void
  minWidth?: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isFiltered = value !== 'All' && value !== ''
  const selectedOption = options.find(o => String(o.value) === String(value))
  const displayLabel = isFiltered ? (selectedOption ? selectedOption.label : label) : label

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            if (!isFiltered) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)'
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'var(--bg-input)'
            e.currentTarget.style.borderColor = isFiltered ? 'transparent' : 'var(--border)'
          }
        }}
        onFocus={e => {
          if (!isFiltered) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
          }
        }}
        onBlur={e => {
          if (!isFiltered) {
            e.currentTarget.style.borderColor = 'var(--border)'
          }
        }}
        style={{
          height: 36,
          paddingLeft: 34,
          paddingRight: 30,
          minWidth: minWidth,
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 10,
          cursor: 'pointer',
          background: isOpen ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-input)',
          color: isFiltered ? 'var(--accent-blue)' : (isOpen ? 'var(--text-primary)' : 'var(--text-secondary)'),
          border: isFiltered ? '1px solid transparent' : (isOpen ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border)'),
          transition: 'all 0.2s ease',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          whiteSpace: 'nowrap',
          outline: 'none',
          position: 'relative'
        }}
      >
        <Icon size={13} style={{ position: 'absolute', left: 12, color: isFiltered ? 'var(--accent-blue)' : 'var(--text-muted)', pointerEvents: 'none' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
        <ChevronDown 
          size={14} 
          style={{ 
            position: 'absolute', 
            right: 10, 
            color: isFiltered ? 'var(--accent-blue)' : 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            pointerEvents: 'none'
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          minWidth: Math.max(minWidth, 185),
          maxHeight: 280,
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          zIndex: 1000,
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          {options.map(opt => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
                onFocus={e => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onBlur={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? 'var(--nav-active-bg)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  outline: 'none'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                {isSelected && <Check size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PlanCodesPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)

  // Data State
  const [plans, setPlans] = useState<Plan[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [stats, setStats] = useState({ total: 0, unused: 0, used: 0, disabled: 0, expired: 0, unusedTokens: 0, usageRate: 0 })
  const [codes, setCodes] = useState<RedemptionCode[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loadingCodes, setLoadingCodes] = useState(true)
  const [activeTab, setActiveTab] = useState<'manage' | 'sellers' | 'export'>('manage')
  const [exportSearch, setExportSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<{ name: string, phone: string } | null>(null)
  const [sellerCodes, setSellerCodes] = useState<RedemptionCode[]>([])
  const [loadingSellerCodes, setLoadingSellerCodes] = useState(false)
  const [sellerStats, setSellerStats] = useState<any[]>([])
  // Company State
  const [filterCompany, setFilterCompany] = useState('All')
  const [generateCompanyId, setGenerateCompanyId] = useState<number | null>(null)
  const [selectedCodeIds, setSelectedCodeIds] = useState<Set<number>>(new Set())
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [bulkAssignCompanyId, setBulkAssignCompanyId] = useState<number | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)


  // Generate Form State
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const [generateCount, setGenerateCount] = useState<number>(10)
  const [showSellerConfig, setShowSellerConfig] = useState(false)
  const [sellerName, setSellerName] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [generateNotes, setGenerateNotes] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedResults, setGeneratedResults] = useState<{code: string, code_id: number}[] | null>(null)

  // Disable Form State
  const [disableSearchPhone, setDisableSearchPhone] = useState('')
  const [disablePreviewCount, setDisablePreviewCount] = useState<number | null>(null)
  const [disablePreviewName, setDisablePreviewName] = useState<string | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [confirmDisableModal, setConfirmDisableModal] = useState(false)

  // Table Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDistributed, setFilterDistributed] = useState<'All' | 'Distributed' | 'Not Distributed'>('All')
  const [filterPlan, setFilterPlan] = useState('All')
  const [offset, setOffset] = useState(0)
  const rowsPerPage = 100

  // Auth Hook
  useEffect(() => {
    async function checkAccess() {
      const { data: sessRes } = await supabase.auth.getSession()
      const session = sessRes.session
      if (!session?.user?.id) { router.push('/login'); return }
      
      const { data: adminRow } = await supabase.from('admin_users').select('role').eq('user_id', session.user.id).maybeSingle()
      if (!adminRow || String((adminRow as any).role).toLowerCase() !== 'superadmin') {
        router.push('/login'); return
      }
      setAuthLoading(false)
    }
    checkAccess()
  }, [router])

  // Selected Plan Helper
  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null
    return plans.find(p => p.plan_id === Number(selectedPlanId)) || null
  }, [plans, selectedPlanId])

  // Initial Load Actions
  useEffect(() => {
    if (authLoading) return
    loadPlans()
    loadCompanies()
    refreshAll()
  }, [authLoading])

  // Re-fetch on Pagination Change
  useEffect(() => {
    if (authLoading) return
    loadCodes()
  }, [offset, authLoading])

  async function loadPlans() {
    const { data } = await supabase.from('plans').select('*').order('price_cents', { ascending: false })
    if (data) setPlans(data as Plan[])
  }

  async function loadCompanies() {
    const { data } = await supabase.from('companies').select('company_id, name').order('name')
    if (data) setCompanies(data as Company[])
  }

  async function loadStats() {
    const { data } = await supabase.from('redemption_codes').select(`
      is_used, is_disabled, expires_at, seller_name, seller_phone,
      plans(tokens_per_period, billing_period, price_cents)
    `)
    if (!data) return
    const total = data.length
    const used = data.filter((c: any) => c.is_used).length
    const disabled = data.filter((c: any) => !c.is_used && c.is_disabled).length
    const expired = data.filter((c: any) => !c.is_used && !c.is_disabled && c.expires_at && new Date(c.expires_at) < new Date()).length
    const unused = total - used - disabled - expired
    
    const unusedTokens = data
      .filter((c: any) => !c.is_used && !c.is_disabled && (!c.expires_at || new Date(c.expires_at) >= new Date()))
      .reduce((acc: number, c: any) => acc + (c.plans?.tokens_per_period || 0), 0)
    const usageRate = total > 0 ? (used / total) * 100 : 0

    setStats({ total, used, disabled, expired, unused, unusedTokens, usageRate })

    // Aggregating Seller Stats
    const sellersMap: Record<string, any> = {}
    data.forEach((c: any) => {
      const phone = c.seller_phone || 'unassigned'
      if (!sellersMap[phone]) {
        sellersMap[phone] = {
          name: c.seller_name || (c.seller_phone ? 'Unknown Seller' : 'Direct / Unassigned'),
          phone: c.seller_phone || '—',
          total: 0,
          used: 0,
          tokens: 0,
          monthly: 0,
          annual: 0
        }
      }
      const s = sellersMap[phone]
      s.total++
      if (c.is_used) s.used++
      s.tokens += c.plans?.tokens_per_period || 0
      if (c.plans?.billing_period === 'month') s.monthly++
      else if (c.plans?.billing_period === 'year') s.annual++
    })

    const sortedSellers = Object.values(sellersMap).sort((a, b) => b.tokens - a.tokens)
    setSellerStats(sortedSellers)
  }



  async function loadCodes() {
    setLoadingCodes(true)
    const { data, count } = await supabase
      .from('redemption_codes')
      .select(`
        code_id, code, plan_id, duration_days,
        is_used, is_disabled, used_at, disabled_at,
        is_distributed, distributed_at,
        seller_name, seller_phone, notes,
        created_at, expires_at, company_id,
        plans(name, billing_period, price_cents),
        profiles!used_by(full_name, email),
        companies(name, contact_email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + rowsPerPage - 1)
    
    if (data) {
      setCodes(data as any as RedemptionCode[])
      setTotalCount(count ?? 0)
    }
    setLoadingCodes(false)
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadCodes()])
  }

  // Generate Codes Logic
  async function handleGenerateCodes(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlanId) {
      toast.error("Please select a plan")
      return
    }
    setGenerating(true)
    try {
      const { data, error } = await supabase.rpc('superadmin_generate_codes', {
        p_plan_id: Number(selectedPlanId),
        p_count: generateCount,
        p_seller_name: sellerName || null,
        p_seller_phone: sellerPhone || null,
        p_notes: generateNotes || null,
        p_expires_at: expiryDate || null,
      })

      if (error) throw error

      const generated = data as {code: string, code_id: number}[]
      
      // Follow-up: Assign to Company if selected
      if (generateCompanyId) {
        const ids = generated.map(r => r.code_id)
        await supabase.from('redemption_codes').update({ company_id: generateCompanyId }).in('code_id', ids)
      }

      toast.success(`${generateCount} codes generated successfully`)
      setGeneratedResults(generated)
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Error generating codes')
    } finally {
      setGenerating(false)
    }
  }

  async function handleBulkAssign() {
    if (!bulkAssignCompanyId) return
    setBulkAssigning(true)
    try {
      const { error } = await supabase
        .from('redemption_codes')
        .update({ company_id: bulkAssignCompanyId })
        .in('code_id', Array.from(selectedCodeIds))
      
      if (error) throw error
      
      toast.success("Codes assigned to company")
      setSelectedCodeIds(new Set())
      setShowBulkAssignModal(false)
      refreshAll()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkAssigning(false)
    }
  }

  function downloadGeneratedCSV() {
    if (!generatedResults) return
    const planName = selectedPlan?.name || 'Unknown'
    const duration = selectedPlan?.billing_period === 'month' ? 30 : 365
    const header = "code,plan_name,duration_days,seller_name,seller_phone,created_at\n"
    const rows = generatedResults.map(r => 
      `${r.code},${planName},${duration},${sellerName || ''},${sellerPhone || ''},${new Date().toISOString()}`
    ).join("\n")
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codes-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  function copyGeneratedCodes() {
    if (!generatedResults) return
    const txt = generatedResults.map(r => r.code).join("\n")
    navigator.clipboard.writeText(txt)
    toast.success("Codes copied to clipboard")
  }

  // Bulk Disable Logic
  async function previewDisable() {
    if (!disableSearchPhone) return
    const { data, error } = await supabase
      .from('redemption_codes')
      .select('seller_name, seller_phone')
      .eq('seller_phone', disableSearchPhone)
      .eq('is_used', false)
      .eq('is_disabled', false)
    
    if (error) { toast.error("Error finding codes"); return }
    
    setDisablePreviewCount(data.length)
    if (data.length > 0) {
      setDisablePreviewName(data[0].seller_name)
    } else {
      setDisablePreviewName(null)
    }
  }

  async function confirmBulkDisable() {
    setDisabling(true)
    const { data: disabledCount, error } = await supabase.rpc('superadmin_disable_codes_by_seller', { p_seller_phone: disableSearchPhone })
    setDisabling(false)
    setConfirmDisableModal(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`${disabledCount} codes disabled`)
    setDisableSearchPhone('')
    setDisablePreviewCount(null)
    refreshAll()
  }

  // Export Logic
  async function handleSellerSearch() {
    if (!exportSearch.trim()) return
    setLoadingSellerCodes(true)
    try {
      const { data, error } = await supabase
        .from('redemption_codes')
        .select(`
          code_id, code, plan_id, duration_days,
          is_used, is_disabled, used_at, disabled_at,
          is_distributed, distributed_at,
          seller_name, seller_phone, notes,
          created_at, expires_at,
          plans(name, billing_period, price_cents)
        `)
        .or(`seller_name.ilike.%${exportSearch}%,seller_phone.ilike.%${exportSearch}%`)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        setSellerCodes(data as any)
        setSelectedSeller({
          name: data[0].seller_name || 'Unknown Seller',
          phone: data[0].seller_phone || 'N/A'
        })
      } else {
        setSellerCodes([])
        setSelectedSeller(null)
        toast.error("No codes found for this seller")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingSellerCodes(false)
    }
  }

  const categorizedCodes = useMemo(() => {
    const groups: Record<string, Record<string, RedemptionCode[]>> = {
      'Starter': { 'Monthly': [], 'Annually': [] },
      'Basic': { 'Monthly': [], 'Annually': [] },
      'Pro': { 'Monthly': [], 'Annually': [] },
      'Other': { 'Monthly': [], 'Annually': [] }
    }

    sellerCodes.forEach(c => {
      const planName = (c.plans?.name || '').toLowerCase()
      let cat = 'Other'
      if (planName.includes('starter')) cat = 'Starter'
      else if (planName.includes('basic')) cat = 'Basic'
      else if (planName.includes('pro')) cat = 'Pro'

      const period = c.plans?.billing_period === 'year' ? 'Annually' : 'Monthly'
      groups[cat][period].push(c)
    })

    return groups
  }, [sellerCodes])



  function generatePDF() {
    if (!selectedSeller) return

    const doc = new jsPDF()
    const primaryColor = [37, 99, 235] // Blue-600
    
    const logoImg = new Image()
    logoImg.src = '/assets/logo 1.png'
    
    logoImg.onload = () => {
      const seller = selectedSeller
      if (!seller) return

      // --- Header (Dark Theme) ---
      doc.setFillColor(17, 24, 39) // Dark Blue/Grey
      doc.rect(0, 0, 210, 50, 'F')
      
      // Add Logo
      try {
        doc.addImage(logoImg, 'PNG', 14, 10, 30, 30)
      } catch (e) {
        console.error("Logo failed to load", e)
      }

      doc.setFontSize(22)
      doc.setTextColor(255, 255, 255) // White text
      doc.setFont('helvetica', 'bold')
      doc.text("RAPPORT DES CODES", 55, 25)
      
      doc.setFontSize(10)
      doc.setTextColor(209, 213, 219) // Light grey text
      doc.setFont('helvetica', 'normal')
      doc.text(`Généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}`, 55, 32)
      doc.text("Réseau de Partenaires Officiels Fitnessers", 55, 38)

      // --- Seller Info ---
      doc.setDrawColor(229, 231, 235)
      doc.line(14, 60, 196, 60)

      doc.setFontSize(12)
      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'bold')
      doc.text("INFORMATIONS DU VENDEUR", 14, 70)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Nom:`, 14, 78); doc.setFont('helvetica', 'bold'); doc.text(seller.name, 40, 78); doc.setFont('helvetica', 'normal')
      doc.text(`Téléphone:`, 14, 84); doc.setFont('helvetica', 'bold'); doc.text(seller.phone, 40, 84); doc.setFont('helvetica', 'normal')
      doc.text(`Résumé:`, 14, 90); doc.setFont('helvetica', 'bold'); doc.text(`${sellerCodes.length} codes prêts à être utilisés`, 40, 90); doc.setFont('helvetica', 'normal')

      let currentY = 105
      let grandTotal = 0

      // --- Groups ---
      Object.entries(categorizedCodes).forEach(([category, periods]) => {
        Object.entries(periods).forEach(([period, codes]) => {
          if (codes.length === 0) return

          if (currentY > 230) {
            doc.addPage()
            currentY = 20
          }

          doc.setFontSize(13)
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
          doc.setFont('helvetica', 'bold')
          const catLabel = category === 'Annually' ? 'Annuel' : category === 'Monthly' ? 'Mensuel' : category
          const periodLabel = period === 'Annually' ? 'Annuel' : period === 'Monthly' ? 'Mensuel' : period
          doc.text(`${category.toUpperCase()} - ${periodLabel.toUpperCase()}`, 14, currentY)
          currentY += 6

          const subtotal = codes.reduce((acc: number, c: RedemptionCode) => acc + (c.plans?.price_cents || 0), 0)
          grandTotal += subtotal

          autoTable(doc, {
            startY: currentY,
            head: [['Code', 'Statut', 'Expiration', 'Valeur']],
            body: [
              ...codes.map((c: RedemptionCode) => [
                c.code,
                c.is_used ? 'Utilisé' : c.is_disabled ? 'Désactivé' : 'Non utilisé',
                c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Jamais',
                `${((c.plans?.price_cents || 0) / 100).toFixed(2)} TND`
              ]),
              [{ content: `Sous-total pour ${category} (${periodLabel})`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } }, 
               { content: `${(subtotal / 100).toFixed(2)} TND`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }]
            ],
            theme: 'grid',
            headStyles: { fillColor: primaryColor as [number, number, number], fontSize: 10 },
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 }
          })

          currentY = (doc as any).lastAutoTable.finalY + 15
        })
      })

      // --- Grand Total ---
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }
      
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setLineWidth(0.5)
      doc.line(100, currentY, 196, currentY)
      currentY += 10

      doc.setFontSize(16)
      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'bold')
      doc.text("TOTAL GÉNÉRAL:", 100, currentY)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text(`${(grandTotal / 100).toFixed(2)} TND`, 196, currentY, { align: 'right' })

      // --- Footer ---
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text(`Administration Fitnessers | Système de Facturation Professionnel | Page ${i} sur ${pageCount}`, 105, 285, { align: 'center' })
      }

      const sellerFilename = (seller?.name || 'Vendeur').replace(/\s+/g, '_')
      doc.save(`Fitnessers_Facture_${sellerFilename}.pdf`)
      toast.success("PDF exporté avec succès")
    }
    
    // Trigger load if cached or small
    if (logoImg.complete) logoImg.onload(new Event('load'))
  }

  async function generateVoucherPDF(codesToExport?: { code: string; code_id: number }[] | any) {
    const isBulkToolbarExport = !Array.isArray(codesToExport)
    const selected = isBulkToolbarExport
      ? codes.filter(c => selectedCodeIds.has(c.code_id))
      : codesToExport

    if (selected.length === 0) {
      toast.error("Select at least one code first")
      return
    }

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = src
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image at ${src}`))
      })
    }

    const loadFontBase64 = async (src: string): Promise<string | null> => {
      try {
        const res = await fetch(src)
        const blob = await res.blob()
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1]
            resolve(base64)
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    }

    try {
      const [proMoisImg, basicMoisImg, proAnImg, basicAnImg, backTemplateImg, monoFontBase64] = await Promise.all([
        loadImage('/assets/pro-mois-v3.png').catch(() => loadImage('/assets/pro-v2.png')),
        loadImage('/assets/basic-mois-v3.png').catch(() => loadImage('/assets/basic-v2.png')),
        loadImage('/assets/pro-an.png').catch(() => loadImage('/assets/pro-v2.png')),
        loadImage('/assets/basic-an.png').catch(() => loadImage('/assets/basic-v2.png')),
        loadImage('/assets/Votcher-BACK.png').catch(() => loadImage('/assets/voucher-card-template.png')),
        loadFontBase64('/assets/RobotoMono-Bold.ttf')
      ])

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      let isMonoLoaded = false
      if (monoFontBase64) {
        try {
          doc.addFileToVFS('RobotoMono-Bold.ttf', monoFontBase64)
          doc.addFont('RobotoMono-Bold.ttf', 'RobotoMono', 'bold')
          isMonoLoaded = true
        } catch (e) {
          console.warn('Custom font registration failed', e)
        }
      }

      const PAGE_W = 210, PAGE_H = 297
      const COLS = 2, ROWS = 5
      const PER_PAGE = COLS * ROWS  // 10 cards per page

      // Full bleed — cards fill the entire page edge to edge, no margin, no gap
      const cardW = PAGE_W / COLS
      const cardH = PAGE_H / ROWS

      // Measured on the source template: white code box under "Code D'activation" + bottom-left ID spot
      const BOX = { l: 0.054965, t: 0.491393, w: 0.451241, h: 0.120501 }
      const ID = { x: 0.054965, y: 0.907667 }

      // Draw subtle inner cut lines between cards (omitting outer page borders)
      const drawInnerCutLines = () => {
        doc.setDrawColor(85, 85, 85) // Subtle neutral grey (not white)
        doc.setLineWidth(0.15) // Subtle thin line
        doc.setLineDashPattern([1.5, 1.5], 0) // Fine dash pattern

        // Vertical inner dividing lines (between columns 1..COLS-1)
        for (let col = 1; col < COLS; col++) {
          const x = col * cardW
          doc.line(x, 0, x, PAGE_H)
        }

        // Horizontal inner dividing lines (between rows 1..ROWS-1)
        for (let row = 1; row < ROWS; row++) {
          const y = row * cardH
          doc.line(0, y, PAGE_W, y)
        }

        doc.setLineDashPattern([], 0) // Reset line dash

        // Cover any bottom sub-pixel gap with a solid dark line matching the voucher background
        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(0.5)
        doc.line(0, PAGE_H - 0.25, PAGE_W, PAGE_H - 0.25)
      }

      const totalPages = Math.ceil(selected.length / PER_PAGE)

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) doc.addPage()

        const pageCodes = selected.slice(pageIdx * PER_PAGE, (pageIdx + 1) * PER_PAGE)

        // --- FRONT PAGE ---
        pageCodes.forEach((c: any, posInPage: number) => {
          const row = Math.floor(posInPage / COLS)
          const col = posInPage % COLS
          const x = col * cardW
          const y = row * cardH

          // Determine plan name and billing period to choose right voucher card template
          const pName = (
            c.plans?.name ||
            c.plan_name ||
            (c.plan_id ? plans.find(p => p.plan_id === c.plan_id)?.name : '') ||
            selectedPlan?.name ||
            ''
          ).toLowerCase()

          const period = (
            c.plans?.billing_period ||
            (c.plan_id ? plans.find(p => p.plan_id === c.plan_id)?.billing_period : '') ||
            selectedPlan?.billing_period ||
            ''
          ).toLowerCase()

          const durationDays = c.duration_days ?? 0
          const isAnnual = period === 'year' || period === 'annually' || durationDays >= 300 || pName.includes('annual') || pName.includes('an')
          const isBasic = pName.includes('basic')

          let templateImg: HTMLImageElement
          if (isBasic) {
            templateImg = isAnnual ? basicAnImg : basicMoisImg
          } else {
            templateImg = isAnnual ? proAnImg : proMoisImg
          }

          doc.addImage(templateImg, 'PNG', x, y, cardW, cardH + 0.4)

          // Code, centered horizontally & vertically in the white container box under "Code D'activation"
          const boxX = x + BOX.l * cardW
          const boxY = y + BOX.t * cardH
          const boxW = BOX.w * cardW
          const boxH = BOX.h * cardH

          let fontSize = 11
          if (isMonoLoaded) {
            doc.setFont('RobotoMono', 'bold')
            doc.setCharSpace(0.2)
          } else {
            doc.setFont('helvetica', 'bold')
            doc.setCharSpace(0.3)
          }
          doc.setFontSize(fontSize)
          while (doc.getTextWidth(c.code) > boxW - 8 && fontSize > 6) {
            fontSize -= 0.5
            doc.setFontSize(fontSize)
          }
          doc.setTextColor(31, 41, 55)
          doc.text(c.code, boxX + boxW / 2 - 0.7, boxY + boxH / 2 + 0.4, { align: 'center', baseline: 'middle' })
          doc.setCharSpace(0)

          // Card ID, bottom-left
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(148, 163, 184)
          doc.text(`N° ${String(c.code_id).padStart(4, '0')}`, x + ID.x * cardW, y + ID.y * cardH)
        })

        // Draw subtle inner cut lines (no full page border lines)
        drawInnerCutLines()
      }

      // --- ONE SINGLE BACK PAGE at the end (always 10 slots = 1 page) ---
      // Regardless of how many codes were generated, only one back page is
      // appended at the very end of the PDF. This matches a standard print
      // workflow where you flip a single sheet for the back of the last batch.
      doc.addPage()
      for (let pos = 0; pos < PER_PAGE; pos++) {
        const row = Math.floor(pos / COLS)
        const col = pos % COLS
        const x = col * cardW
        const y = row * cardH

        doc.addImage(backTemplateImg, 'PNG', x, y, cardW, cardH + 0.4)
      }

      // Draw subtle inner cut lines for back page
      drawInnerCutLines()

      doc.save(`Fitnessers_Vouchers_${new Date().toISOString().slice(0,10)}.pdf`)
      toast.success(`${selected.length} voucher(s) exported with back cards`)

      if (isBulkToolbarExport) {
        const exportedIds = selected.map((c: any) => c.code_id)
        markCodesDistributed(exportedIds, true)
      }
    } catch (err: any) {
      console.error(err)
      toast.error("Voucher template load failed")
    }
  }

  async function markCodesDistributed(codeIds: number[], distributed: boolean) {
    if (codeIds.length === 0) return
    try {
      const { data, error } = await supabase.rpc('superadmin_mark_codes_distributed', {
        p_code_ids: codeIds,
        p_distributed: distributed
      })

      if (error) throw error

      const count = typeof data === 'number' ? data : codeIds.length
      toast.success(`${count} code(s) marked as ${distributed ? 'distributed' : 'undistributed'}`)

      const isBulkSelectionAction = codeIds.length > 1 || (codeIds.length === 1 && selectedCodeIds.has(codeIds[0]) && selectedCodeIds.size === 1)
      if (isBulkSelectionAction) {
        setSelectedCodeIds(new Set())
      }
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update distribution status')
    }
  }

  // Single Disable Logic
  async function disableSingleCode(codeStr: string) {
    if (!confirm(`Disable code ${codeStr}?`)) return
    
    const { data: success, error } = await supabase.rpc('superadmin_disable_single_code', { p_code: codeStr })
    if (error) { toast.error(error.message); return }
    if (success) {
      toast.success("Code disabled")
      // Optimistic update
      setCodes(prev => prev.map(c => c.code === codeStr ? { ...c, is_disabled: true, disabled_at: new Date().toISOString() } : c))
      loadStats()
    } else {
      toast.error("Failed to disable code")
    }
  }

  const filteredCodes = useMemo(() => {
    return codes.filter(c => {
      // Status Filter
      if (filterStatus !== 'All') {
        const s = getCodeStatus(c)
        if (filterStatus.toLowerCase() !== s) return false
      }
      // Distribution Filter
      if (filterDistributed !== 'All') {
        if (filterDistributed === 'Distributed' && !c.is_distributed) return false
        if (filterDistributed === 'Not Distributed' && c.is_distributed) return false
      }
      // Plan Filter
      if (filterPlan !== 'All' && c.plan_id !== Number(filterPlan)) return false
      // Company Filter
      if (filterCompany !== 'All' && c.company_id !== Number(filterCompany)) return false
      // Text Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!c.code.toLowerCase().includes(q) && 
            !(c.seller_name || '').toLowerCase().includes(q) &&
            !(c.seller_phone || '').toLowerCase().includes(q) &&
            !(c.companies?.name || '').toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [codes, filterStatus, filterDistributed, filterPlan, filterCompany, searchQuery])

  if (authLoading) return <div style={{ padding: 24 }}><Spinner /></div>

  return (
    <div className="page-enter">
      <PageHeader
        title="Plan Codes"
        crumb="Plan Codes"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={refreshAll}>
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatPill label="Total Codes" value={stats.total} />
        <StatPill label="Unused" value={stats.unused} />
        <StatPill label="Used" value={stats.used} />
        <StatPill label="Usage Rate" value={`${stats.usageRate.toFixed(1)}%`} />
        <StatPill label="Unused Tokens" value={stats.unusedTokens.toLocaleString()} />
        <StatPill label="Disabled/Expired" value={stats.disabled + stats.expired} />
      </div>

      <Tabs 
        active={activeTab} 
        onChange={(t: any) => setActiveTab(t)}
        tabs={[
          { key: 'manage', label: 'Manage Codes' },
          { key: 'sellers', label: 'Sellers Analytics' },
          { key: 'export', label: 'Export PDF' }
        ]}
      />

      {activeTab === 'manage' ? (
        <>
          <div className="grid-2-col" style={{ gap: 24, marginBottom: 24 }}>

        {/* Section 1: Generate Codes */}
        <Card>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Generate Codes</div>
          <form onSubmit={handleGenerateCodes} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGroup label="Plan">
              <select className="og-input" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="" disabled>Select a plan...</option>
                {plans.map(p => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.name} · {p.price_cents / 100} TND/{p.billing_period === 'month' ? 'mo' : 'yr'} · {p.tokens_per_period} tokens
                  </option>
                ))}
              </select>
              {selectedPlan && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selectedPlan.billing_period === 'month' ? (
                    <><span>⏱</span> 30-day subscription · tokens expire at month end</>
                  ) : (
                    <><span>⏱</span> 365-day subscription · tokens expire at year end</>
                  )}
                </div>
              )}
            </FormGroup>
            
            <FormGroup label="Count">
              <input type="number" min={1} max={500} required className="og-input" value={generateCount} onChange={e => setGenerateCount(Number(e.target.value))} />
            </FormGroup>

            <FormGroup label="Assign to Company (optional)">
              <select 
                className="og-input" 
                value={generateCompanyId || ''} 
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null
                  setGenerateCompanyId(val)
                  if (val) {
                    setShowSellerConfig(false)
                    setSellerName('')
                    setSellerPhone('')
                  }
                }}
              >
                <option value="">No company — individual sale</option>
                {companies.map(comp => (
                  <option key={comp.company_id} value={comp.company_id}>{comp.name}</option>
                ))}
              </select>
            </FormGroup>

            {!generateCompanyId && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}
                  onClick={() => setShowSellerConfig(!showSellerConfig)}
                >
                  <span>Assign to Seller (Optional)</span>
                  <span>{showSellerConfig ? '▲' : '▼'}</span>
                </div>
                {showSellerConfig && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <FormGroup label="Seller Name">
                      <input type="text" className="og-input" value={sellerName} onChange={e => setSellerName(e.target.value)} />
                    </FormGroup>
                    <FormGroup label="Seller Phone">
                      <input type="text" className="og-input" placeholder="+21650000000" value={sellerPhone} onChange={e => setSellerPhone(e.target.value)} />
                    </FormGroup>
                    <FormGroup label="Notes (Optional)">
                      <textarea className="og-input" rows={2} value={generateNotes} onChange={e => setGenerateNotes(e.target.value)} />
                    </FormGroup>
                  </div>
                )}
              </div>
            )}

            <FormGroup label="Expiry Date (Optional)">
              <input type="date" className="og-input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </FormGroup>

            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? 'Generating...' : `Generate ${generateCount} Codes`}
            </button>
          </form>

          {generatedResults && (
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>Generated Successfully</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => setGeneratedResults(null)}>✕</button>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-base)', padding: 8, borderRadius: 4, marginBottom: 12 }}>
                {generatedResults.map(r => <div key={r.code_id}>{r.code}</div>)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1, gap: 6 }} onClick={copyGeneratedCodes}>
                  <Copy size={14} /> Copy All
                </button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1, gap: 6 }} onClick={downloadGeneratedCSV}>
                  <Download size={14} /> Download CSV
                </button>
                <button className="btn btn-primary btn-sm" style={{ flex: 1, gap: 6 }} onClick={() => generateVoucherPDF(generatedResults || [])}>
                  <Ticket size={14} /> Generate Vouchers
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Section 2: Bulk Disable */}
        <div>
          <Card>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: '#DC2626' }}>Danger Zone: Bulk Disable</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Disable all <strong>unused</strong> codes assigned to a specific seller phone number. Already used codes will not be affected.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormGroup label="Seller Phone (Exact Match)">
                <input type="text" className="og-input" placeholder="+216..." value={disableSearchPhone} onChange={e => {setDisableSearchPhone(e.target.value); setDisablePreviewCount(null)}} />
              </FormGroup>

              <button className="btn btn-outline" onClick={previewDisable} disabled={!disableSearchPhone.trim()}>
                Preview Codes
              </button>

              {disablePreviewCount !== null && (
                <div style={{ marginTop: 8, padding: 12, background: disablePreviewCount > 0 ? '#FEF2F2' : '#F1F5F9', borderRadius: 8, fontSize: 13 }}>
                  {disablePreviewCount === 0 ? (
                    <span style={{ color: '#64748B' }}>No active unused codes found for this seller.</span>
                  ) : (
                    <div>
                      <div style={{ color: '#DC2626', fontWeight: 600, marginBottom: 8 }}>
                        {disablePreviewCount} unused codes found for {disablePreviewName || disableSearchPhone}.
                      </div>
                      <button className="btn btn-reject" style={{ width: '100%' }} onClick={() => setConfirmDisableModal(true)}>
                        Disable All {disablePreviewCount} Codes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Section 3: Codes Table */}
      <Card>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          marginBottom: 20,
          flexWrap: 'wrap'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220, display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input 
              type="text" 
              className="og-input" 
              placeholder="Search code, seller, phone..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 34,
                paddingRight: searchQuery ? 30 : 12,
                height: 36,
                fontSize: 12.5,
                background: 'var(--bg-input)',
                borderColor: searchQuery ? 'var(--accent-blue)' : 'var(--border)',
                borderRadius: 10,
                color: 'var(--text-primary)'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <CustomFilterSelect
            icon={SlidersHorizontal}
            label="All Statuses"
            value={filterStatus}
            minWidth={135}
            options={[
              { label: 'All Statuses', value: 'All' },
              { label: 'Unused', value: 'Unused' },
              { label: 'Used', value: 'Used' },
              { label: 'Disabled', value: 'Disabled' },
              { label: 'Expired', value: 'Expired' }
            ]}
            onChange={val => setFilterStatus(val)}
          />

          {/* Distribution Filter */}
          <CustomFilterSelect
            icon={CheckSquare}
            label="All Distribution"
            value={filterDistributed}
            minWidth={150}
            options={[
              { label: 'All Distribution', value: 'All' },
              { label: 'Not Distributed', value: 'Not Distributed' },
              { label: 'Distributed', value: 'Distributed' }
            ]}
            onChange={val => setFilterDistributed(val as any)}
          />

          {/* Plan Filter */}
          <CustomFilterSelect
            icon={Tag}
            label="All Plans"
            value={filterPlan}
            minWidth={160}
            options={[
              { label: 'All Plans', value: 'All' },
              ...plans.map(p => ({
                label: `${p.name} (${p.billing_period === 'month' || p.billing_period === 'monthly' ? 'Monthly' : 'Annual'})`,
                value: String(p.plan_id)
              }))
            ]}
            onChange={val => setFilterPlan(val)}
          />

          {/* Company Filter */}
          <CustomFilterSelect
            icon={Building}
            label="All Companies"
            value={filterCompany}
            minWidth={155}
            options={[
              { label: 'All Companies', value: 'All' },
              ...companies.map(comp => ({
                label: comp.name,
                value: String(comp.company_id)
              }))
            ]}
            onChange={val => setFilterCompany(val)}
          />

          {/* Clear Filters Button */}
          {(filterStatus !== 'All' || filterDistributed !== 'All' || filterPlan !== 'All' || filterCompany !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setFilterStatus('All')
                setFilterDistributed('All')
                setFilterPlan('All')
                setFilterCompany('All')
                setSearchQuery('')
              }}
              style={{
                height: 36,
                padding: '0 8px',
                fontSize: 12,
                fontWeight: 600,
                background: 'none',
                color: '#F87171',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'opacity 0.2s ease',
                outline: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              title="Reset all active filters"
            >
              <X size={13} /> Clear
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
            Showing {filteredCodes.length} of {totalCount} codes
          </div>
        </div>

        {loadingCodes ? <Spinner /> : filteredCodes.length === 0 ? <EmptyState message="No codes found" /> : (
          <div style={{ overflowX: 'auto' }}>
            {selectedCodeIds.size > 0 && (
              <div style={{ 
                background: 'var(--accent-blue-alpha)', 
                padding: '12px 16px', 
                borderRadius: 8, 
                marginBottom: 16, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 16,
                border: '1px solid var(--accent-blue)'
              }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedCodeIds.size} codes selected</span>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => setShowBulkAssignModal(true)}
                  style={{ gap: 8 }}
                >
                  <Building size={14} /> Assign to Company
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={generateVoucherPDF}
                  style={{ gap: 8 }}
                >
                  <Ticket size={14} /> Generate Vouchers
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => markCodesDistributed(Array.from(selectedCodeIds), true)}
                  style={{ gap: 8 }}
                >
                  <CheckSquare size={14} /> Mark as Distributed
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setSelectedCodeIds(new Set())}
                >
                  Clear Selection
                </button>
              </div>
            )}
            <table className="og-table" style={{ width: '100%', minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          const selectableIds = filteredCodes.filter(c => !c.is_distributed).map(c => c.code_id)
                          if (selectableIds.length > 100) {
                            toast.error("Only first 100 selected — max per batch")
                          }
                          setSelectedCodeIds(new Set(selectableIds.slice(0, 100)))
                        } else {
                          setSelectedCodeIds(new Set())
                        }
                      }}
                      checked={
                        (() => {
                          const selectableIds = filteredCodes.filter(c => !c.is_distributed).map(c => c.code_id)
                          return selectableIds.length > 0 && selectableIds.every(id => selectedCodeIds.has(id))
                        })()
                      }
                    />
                  </th>
                  <th>Code</th>
                  <th>Plan & Duration</th>
                  <th>Status</th>
                  <th>Distributed</th>
                  <th>Seller</th>
                  <th>Company</th>
                  <th>Used By</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map(c => {
                  const status = getCodeStatus(c)
                  const isChecked = selectedCodeIds.has(c.code_id)
                  return (
                    <tr key={c.code_id} className={isChecked ? 'row-selected' : ''}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedCodeIds)
                            if (e.target.checked) {
                              if (next.size >= 100) {
                                toast.error("Max 100 codes per batch")
                              } else {
                                next.add(c.code_id)
                              }
                            } else {
                              next.delete(c.code_id)
                            }
                            setSelectedCodeIds(next)
                          }}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                        <span 
                          style={{ cursor: 'pointer', padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, display: 'inline-block' }}
                          onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Copied!') }}
                          title="Click to copy"
                        >
                          {c.code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.plans?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.duration_days} days</div>
                      </td>
                      <td><StatusBadge status={status} /></td>
                      <td>
                        <DistributedBadge 
                          isDistributed={c.is_distributed}
                          distributedAt={c.distributed_at}
                          onClick={() => markCodesDistributed([c.code_id], !c.is_distributed)}
                        />
                      </td>
                      <td>
                        {c.seller_name || c.seller_phone ? (
                           <>
                             <div style={{ fontSize: 12, fontWeight: 500 }}>{c.seller_name || '—'}</div>
                             <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.seller_phone || '—'}</div>
                           </>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {c.companies ? (
                          <div style={{ 
                            background: '#F1F5F9', 
                            color: '#475569', 
                            padding: '2px 8px', 
                            borderRadius: 4, 
                            fontSize: 11, 
                            fontWeight: 600,
                            display: 'inline-block'
                          }}>
                            {c.companies.name}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {c.is_used && c.profiles ? (
                          <>
                             <div style={{ fontSize: 12, fontWeight: 500 }}>{c.profiles.full_name || '—'}</div>
                             <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.profiles.email || '—'}</div>
                          </>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {timeAgo(c.created_at)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        {status === 'unused' ? (
                          <button className="btn btn-outline btn-sm" style={{ color: '#DC2626', borderColor: '#FCA5A5' }} onClick={() => disableSingleCode(c.code)}>
                            Disable
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button className="btn btn-outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - rowsPerPage))}>
            Previous Page
          </button>
          <button className="btn btn-outline" disabled={offset + rowsPerPage >= totalCount} onClick={() => setOffset(offset + rowsPerPage)}>
             Next Page
          </button>
        </div>
      </Card>
      </>
    ) : activeTab === 'sellers' ? (

        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Seller</th>
                  <th style={{ textAlign: 'center' }}>Total Codes</th>
                  <th style={{ textAlign: 'center' }}>Monthly / Annual</th>
                  <th style={{ textAlign: 'right' }}>Total Tokens</th>
                  <th style={{ textAlign: 'right' }}>Usage Rate</th>
                </tr>
              </thead>
              <tbody>
                {sellerStats.map(s => (
                  <tr key={s.phone}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.phone}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 500 }}>{s.total}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                         <Badge label={`${s.monthly} Mth`} />
                         <Badge label={`${s.annual} Ann`} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
                      {s.tokens.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: s.used > 0 ? '#10B981' : 'var(--text-muted)' }}>
                          {((s.used / s.total) * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {s.used} of {s.total} used
                        </div>
                        {/* Tiny progress bar */}
                        <div style={{ width: 60, height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${(s.used / s.total) * 100}%`, height: '100%', background: '#10B981' }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {sellerStats.length === 0 && (
                  <tr><td colSpan={5}><EmptyState message="No seller data yet" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Seller Preview & Export</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="og-input" 
                  placeholder="Enter seller name or phone..." 
                  value={exportSearch} 
                  onChange={e => setExportSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSellerSearch()}
                  style={{ paddingLeft: 40, width: '100%' }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSellerSearch} disabled={loadingSellerCodes}>
                {loadingSellerCodes ? <Spinner /> : 'Preview Codes'}
              </button>
            </div>

            {selectedSeller && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedSeller.name}</h3>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{selectedSeller.phone}</p>
                  </div>
                  <button className="btn btn-primary" style={{ gap: 8 }} onClick={generatePDF}>
                    <Printer size={16} /> Export PDF
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                  {Object.entries(categorizedCodes).map(([category, periods]) => {
                    const totalInCategory = Object.values(periods).reduce((acc, codes) => acc + codes.length, 0)
                    if (totalInCategory === 0) return null

                    return (
                      <div key={category} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Tag size={16} className="text-blue-500" />
                          <span style={{ fontWeight: 600 }}>Plans {category === 'Annually' ? 'Annuels' : category === 'Monthly' ? 'Mensuels' : category}</span>
                          <Badge label={totalInCategory.toString()} />
                          <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent-blue)' }}>
                            {(Object.values(periods).flat().reduce((acc, c) => acc + (c.plans?.price_cents || 0), 0) / 100).toFixed(2)} TND
                          </div>
                        </div>

                        {Object.entries(periods).map(([period, codes]) => {
                          if (codes.length === 0) return null
                          return (
                            <div key={period} style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {period === 'Annually' ? 'Annuel' : period === 'Monthly' ? 'Mensuel' : period}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                                  {(codes.reduce((acc, c) => acc + (c.plans?.price_cents || 0), 0) / 100).toFixed(2)} TND
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {codes.map(c => (
                                  <div 
                                    key={c.code_id} 
                                    style={{ 
                                      fontSize: 11, 
                                      fontFamily: 'monospace', 
                                      padding: '4px 8px', 
                                      background: c.is_used ? 'var(--bg-input)' : 'rgba(37, 99, 235, 0.1)',
                                      color: c.is_used ? 'var(--text-muted)' : 'rgb(37, 99, 235)',
                                      borderRadius: 4,
                                      border: '1px solid',
                                      borderColor: c.is_used ? 'transparent' : 'rgba(37, 99, 235, 0.2)',
                                      textDecoration: c.is_used ? 'line-through' : 'none'
                                    }}
                                    title={c.is_used ? 'Used' : 'Unused'}
                                  >
                                    {c.code}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Bulk Assign Modal */}
      <Modal 
        open={showBulkAssignModal} 
        onClose={() => setShowBulkAssignModal(false)}
        title="Assign Codes to Company"
      >
        <div style={{ marginBottom: 20 }}>
          You are assigning <strong>{selectedCodeIds.size} codes</strong> to a company. 
          This will make them available in the company's HR dashboard.
        </div>
        <FormGroup label="Select Company">
          <select className="og-input" value={bulkAssignCompanyId || ''} onChange={e => setBulkAssignCompanyId(e.target.value ? Number(e.target.value) : null)}>
            <option value="" disabled>Select a company...</option>
            {companies.map(comp => (
              <option key={comp.company_id} value={comp.company_id}>{comp.name}</option>
            ))}
          </select>
        </FormGroup>
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => setShowBulkAssignModal(false)} disabled={bulkAssigning}>Cancel</button>
          <button className="btn btn-primary" onClick={handleBulkAssign} disabled={bulkAssigning || !bulkAssignCompanyId}>
            {bulkAssigning ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </ModalActions>
      </Modal>

      {/* Discard Modal */}
      <Modal 
        open={confirmDisableModal} 
        onClose={() => setConfirmDisableModal(false)}
        title="Confirm Bulk Disable"
      >
        <div style={{ marginBottom: 20 }}>
          Are you sure you want to disable <strong>{disablePreviewCount} unused codes</strong> for {disablePreviewName || disableSearchPhone}?
          <br/><br/>
          Already-used codes are not affected. This action cannot be undone.
        </div>
        <ModalActions>
          <button className="btn btn-ghost" onClick={() => setConfirmDisableModal(false)} disabled={disabling}>Cancel</button>
          <button className="btn btn-reject" onClick={confirmBulkDisable} disabled={disabling}>
            {disabling ? 'Disabling...' : 'Yes, Disable Codes'}
          </button>
        </ModalActions>
      </Modal>



    </div>
  )
}
