'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Badge,
  Card,
  EmptyState,
  FormGroup,
  Modal,
  ModalActions,
  PageHeader,
  Spinner,
  Tabs,
  toast,
} from '@/components/ui'
import {
  ArrowLeft,
  Bell,
  MoreVertical,
  Paperclip,
  Send,
  CheckCircle2,
} from 'lucide-react'

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'

function normalizeTicketStatus(status: unknown): TicketStatus | null {
  const s = String(status ?? '').toLowerCase().trim()
  if (s === 'open') return 'open'
  if (s === 'in_progress') return 'in_progress'
  if (s === 'waiting') return 'waiting'
  if (s === 'resolved') return 'resolved'
  if (s === 'closed') return 'closed'
  return null
}

type InboxRow = {
  ticket_id: number
  gym_id: number | null
  opened_by: string | null
  ticket_type: string | null
  subject: string | null
  priority: string | null
  status: TicketStatus | null
  owner_status: string | null
  unread_by_admin: number | null
  unread_by_owner: number | null
  superadmin_is_typing: boolean | null
  owner_is_typing: boolean | null
  last_message_at: string | null
  first_response_at: string | null
  resolved_at: string | null
  rating: number | null
  rating_comment: string | null
  rating_requested_at: string | null
  rated_at: string | null
  created_at: string | null
  gym_name?: string | null
  opener_name?: string | null
}

type SupportMessage = {
  message_id: number
  ticket_id: number
  sender_id: string | null
  sender_role: string | null
  body: string | null
  attachment_url: string | null
  read_at: string | null
  created_at: string | null
}

type TabKey = 'all' | 'in_progress' | 'resolved' | 'closed'

let isRefreshingSession = false
let sessionCheckPromise: Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>> | null = null
let visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null

const STATUS_LABEL: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#F59E0B' },
  in_progress: { label: 'In progress', color: '#3B82F6' },
  waiting: { label: 'Waiting', color: '#FBBF24' },
  resolved: { label: 'Resolved', color: '#10B981' },
  closed: { label: 'Closed', color: '#94A3B8' },
}

function typeBadge(type: string | null | undefined) {
  const t = (type ?? 'other').toLowerCase()
  if (t === 'bug') return { label: 'Bug', color: '#EF4444' }
  if (t === 'help') return { label: 'Help', color: '#3B82F6' }
  if (t === 'billing') return { label: 'Billing', color: '#F59E0B' }
  if (t === 'feature') return { label: 'Suggestion', color: '#A855F7' }
  return { label: 'Other', color: '#94A3B8' }
}

function priorityDot(priority: string | null | undefined) {
  const p = (priority ?? 'normal').toLowerCase()
  if (p === 'urgent') return '#EF4444'
  if (p === 'high') return '#F97316'
  if (p === 'normal') return '#9CA3AF'
  if (p === 'low') return '#3B82F6'
  return '#9CA3AF'
}

function isWithin24h(iso: string) {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return false
  return Date.now() - d < 24 * 60 * 60 * 1000
}

function fmtRelEn(iso: string | null | undefined) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'

  if (!isWithin24h(iso)) {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  }

  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export default function SupportPage() {
  const router = useRouter()

  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [superadminUserId, setSuperadminUserId] = useState<string>('')

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const [tab, setTab] = useState<TabKey>('all')
  const [tickets, setTickets] = useState<InboxRow[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)

  const [gymSearch, setGymSearch] = useState('')
  const [selectedGymKey, setSelectedGymKey] = useState<string | null>(null)

  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolving, setResolving] = useState(false)

  const [priorityOpen, setPriorityOpen] = useState(false)
  const [priorityUpdating, setPriorityUpdating] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  const inboxChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const threadChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const listReloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingSetRef = useRef(false)

  const threadLoadSeqRef = useRef(0)
  const messagesRef = useRef<SupportMessage[]>([])

  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const loadTicketsRef = useRef<null | ((tabOverride?: TabKey, opts?: { silent?: boolean; initial?: boolean }) => Promise<void>)>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  async function callWithSession<T>(fn: () => PromiseLike<T>): Promise<T | null> {
    try {
      if (!sessionCheckPromise) {
        isRefreshingSession = true
        sessionCheckPromise = supabase.auth.getSession()
      }

      const { data: sessRes, error: sessErr } = await sessionCheckPromise

      if (sessErr) {
        console.warn('Session check skipped:', sessErr.message)
        return null
      }

      if (!sessRes.session) {
        router.push('/login')
        return null
      }

      return await fn()
    } catch (err: any) {
      const msg = String(err?.message ?? '')
      if (msg.includes('timed out') || msg.includes('LockManager')) {
        console.warn('Auth lock timeout — will retry on next action')
        return null
      }
      throw err
    } finally {
      isRefreshingSession = false
      sessionCheckPromise = null
    }
  }

  const selectedTicket = useMemo(() => {
    if (selectedTicketId == null) return null
    return tickets.find(t => t.ticket_id === selectedTicketId) ?? null
  }, [tickets, selectedTicketId])

  const unreadTotal = useMemo(() => {
    return tickets.reduce((acc, t) => acc + (t.unread_by_admin ?? 0), 0)
  }, [tickets])

  const tabbedTickets = useMemo(() => {
    // The inbox RPC already filters by status; this is only a safety-net.
    if (tab === 'all') return tickets
    if (tab === 'in_progress') return tickets.filter(t => t.status === 'in_progress')
    if (tab === 'resolved') return tickets.filter(t => t.status === 'resolved' || t.status === 'closed')
    if (tab === 'closed') return tickets.filter(t => t.status === 'closed')
    return tickets
  }, [tickets, tab])

  const groupedGyms = useMemo(() => {
    const q = gymSearch.trim().toLowerCase()
    const map = new Map<string, {
      key: string
      gym_id: number | null
      gym_name: string
      latestTicket: InboxRow
      unreadTotal: number
      ticketCount: number
    }>()

    for (const t of tabbedTickets) {
      const key = String(t.gym_id ?? 'null')
      const gymName = (t.gym_name ?? (t.gym_id != null ? `Gym #${t.gym_id}` : 'Gym —')).trim()
      if (q && !gymName.toLowerCase().includes(q)) continue

      const unread = t.unread_by_admin ?? 0
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          gym_id: t.gym_id ?? null,
          gym_name: gymName,
          latestTicket: t,
          unreadTotal: unread,
          ticketCount: 1,
        })
      } else {
        existing.unreadTotal += unread
        existing.ticketCount += 1

        const a = new Date(existing.latestTicket.last_message_at ?? existing.latestTicket.created_at ?? 0).getTime()
        const b = new Date(t.last_message_at ?? t.created_at ?? 0).getTime()
        if (b >= a) existing.latestTicket = t
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.latestTicket.last_message_at ?? a.latestTicket.created_at ?? 0).getTime()
      const tb = new Date(b.latestTicket.last_message_at ?? b.latestTicket.created_at ?? 0).getTime()
      return tb - ta
    })
  }, [tabbedTickets, gymSearch])

  const selectedGymTickets = useMemo(() => {
    if (!selectedGymKey) return []
    return tabbedTickets
      .filter(t => String(t.gym_id ?? 'null') === selectedGymKey)
      .sort((a, b) => {
        const ta = new Date(a.last_message_at ?? a.created_at ?? 0).getTime()
        const tb = new Date(b.last_message_at ?? b.created_at ?? 0).getTime()
        return tb - ta
      })
  }, [selectedGymKey, tabbedTickets])

  const selectedGymName = useMemo(() => {
    if (!selectedGymKey) return ''
    const t = selectedGymTickets[0]
    if (!t) return ''
    return (t.gym_name ?? (t.gym_id != null ? `Gym #${t.gym_id}` : 'Gym —')).trim()
  }, [selectedGymKey, selectedGymTickets])

  function scrollToBottom() {
    requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  async function checkSupportAccess() {
    setAuthLoading(true)
    setAuthError('')

    const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
    if (sessErr) {
      setAuthError(sessErr.message)
      setAuthLoading(false)
      return
    }

    const session = sessRes.session
    if (!session?.user?.id) {
      router.push('/login')
      setAuthLoading(false)
      return
    }

    setSuperadminUserId(session.user.id)

    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (adminErr) {
      setAuthError(adminErr.message)
      setAuthLoading(false)
      return
    }

    if (!adminRow || String((adminRow as any).role).toLowerCase() !== 'superadmin') {
      router.push('/login')
      setAuthLoading(false)
      return
    }

    setAuthLoading(false)
  }

  async function loadTickets(tabOverride?: TabKey, opts?: { silent?: boolean; initial?: boolean }) {
    const silent = Boolean(opts?.silent)
    const initial = Boolean(opts?.initial)
    if (initial) setIsInitialLoading(true)

    const showSpinner = !silent && (initial || isInitialLoading)
    if (showSpinner) setLoadingTickets(true)

    let finished = false
    const timeout = setTimeout(() => {
      if (finished) return
      toast.error('Support loading is taking too long — check your connection')
      if (initial) setIsInitialLoading(false)
      if (showSpinner) setLoadingTickets(false)
    }, 15000)

    const effectiveTab = tabOverride ?? tab
    const p_status = (effectiveTab === 'all' || effectiveTab === 'resolved') ? null : effectiveTab

    try {
      const res = await callWithSession(() => supabase.rpc('get_support_inbox', {
        p_status,
        p_limit: 50,
        p_offset: 0,
      }))

      if (!res) return

      const { data, error } = res

      if (error) {
        toast.error(error.message)
        setTickets([])
        return
      }

      const rows = ((data as InboxRow[]) ?? []).map(r => {
        // Some backend views/RPCs may set owner_status while status is null.
        const normalized = normalizeTicketStatus(r.status ?? r.owner_status)
        return { ...r, status: normalized }
      })

      setTickets(rows)
    } finally {
      clearTimeout(timeout)
      finished = true
      if (initial) setIsInitialLoading(false)
      if (showSpinner) setLoadingTickets(false)
    }
  }

  loadTicketsRef.current = loadTickets

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer)
      visibilityDebounceTimer = setTimeout(() => {
        loadTicketsRef.current?.(undefined, { silent: true })
      }, 500)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (visibilityDebounceTimer) {
        clearTimeout(visibilityDebounceTimer)
        visibilityDebounceTimer = null
      }
    }
  }, [])

  async function loadThread(ticketId: number) {
    const seq = ++threadLoadSeqRef.current
    setLoadingMessages(true)

    const prevMessages = messagesRef.current
    setMessages([])

    let finished = false
    const timeout = setTimeout(() => {
      if (finished) return
      toast.error('Messages loading is taking too long — check your connection')
      setLoadingMessages(false)
    }, 15000)

    try {
      const res = await callWithSession(() => supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }))

      if (!res) {
        if (seq === threadLoadSeqRef.current) setMessages(prevMessages)
        return
      }
      if (seq !== threadLoadSeqRef.current) return

      const { data, error } = res

      finished = true

      if (error) {
        toast.error(error.message)
        return
      }

      setMessages((data as SupportMessage[]) ?? [])

      await callWithSession(() => supabase.rpc('mark_ticket_messages_read', { p_ticket_id: ticketId }))
      scrollToBottom()
    } finally {
      clearTimeout(timeout)
      finished = true
      if (seq === threadLoadSeqRef.current) setLoadingMessages(false)
    }
  }

  function scheduleReloadTickets() {
    if (listReloadTimeoutRef.current) clearTimeout(listReloadTimeoutRef.current)
    listReloadTimeoutRef.current = setTimeout(() => {
      loadTickets(undefined, { silent: true })
    }, 250)
  }

  function upsertTicketFromPayload(row: any) {
    if (!row || row.ticket_id == null) return

    const normalized: Partial<InboxRow> = {
      ...(row as any),
      status: normalizeTicketStatus(row.status ?? row.owner_status),
    }

    setTickets(prev => {
      const idx = prev.findIndex(t => t.ticket_id === row.ticket_id)
      if (idx === -1) return [normalized as InboxRow, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...normalized }
      return next
    })
  }

  function cleanupThreadChannel() {
    try {
      if (threadChannelRef.current) {
        supabase.removeChannel(threadChannelRef.current)
      }
    } catch {
      // ignore
    }
    threadChannelRef.current = null
  }

  function resetTypingFlag(ticketId: number) {
    typingSetRef.current = false
    if (!ticketId) return
    callWithSession(() => supabase.from('support_tickets').update({ superadmin_is_typing: false }).eq('ticket_id', ticketId))
  }

  function scheduleTypingReset(ticketId: number) {
    if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current)
    typingResetTimeoutRef.current = setTimeout(() => {
      resetTypingFlag(ticketId)
    }, 3000)
  }

  async function setTyping(ticketId: number, on: boolean) {
    await callWithSession(() => supabase.from('support_tickets').update({ superadmin_is_typing: on }).eq('ticket_id', ticketId))
  }

  async function handleReplyKeyDown() {
    if (!selectedTicketId) return

    if (!typingSetRef.current) {
      typingSetRef.current = true
      await setTyping(selectedTicketId, true)
    }
    scheduleTypingReset(selectedTicketId)
  }

  async function sendMessage() {
    if (!selectedTicketId) return
    const body = replyText.trim()
    if (!body) return

    setSending(true)
    try {
      await setTyping(selectedTicketId, false)
      typingSetRef.current = false

      const res = await callWithSession(() => supabase.from('support_messages').insert({
        ticket_id: selectedTicketId,
        sender_id: superadminUserId,
        sender_role: 'superadmin',
        body,
      }))

      if (!res) {
        setSending(false)
        return
      }

      const { error } = res

      if (error) {
        toast.error(error.message)
        setSending(false)
        return
      }

      setReplyText('')
      setSending(false)
    } catch {
      toast.error('Erreur lors de l\'envoi')
      setSending(false)
    }
  }

  async function resolveTicket() {
    if (!selectedTicketId) return

    setResolving(true)
    const res = await callWithSession(() => supabase.rpc('resolve_ticket', {
      p_ticket_id: selectedTicketId,
      p_resolution: resolutionNote.trim() ? resolutionNote.trim() : null,
    }))

    if (!res) {
      setResolving(false)
      return
    }

    const { error } = res

    if (error) {
      toast.error(error.message)
      setResolving(false)
      return
    }

    setResolving(false)
    setResolveModalOpen(false)
    setResolutionNote('')

    // If you were viewing a filtered list (open / in-progress), resolving changes the ticket status
    // and it can disappear from the list. Switch to the Resolved tab to keep it visible.
    if (tab === 'in_progress') {
      setTab('resolved')
      await loadTickets('resolved')
    } else {
      await loadTickets()
    }
  }

  async function updatePriority(next: string) {
    if (!selectedTicketId) return
    setPriorityUpdating(true)

    const res = await callWithSession(() => supabase
      .from('support_tickets')
      .update({ priority: next })
      .eq('ticket_id', selectedTicketId))

    if (!res) {
      setPriorityUpdating(false)
      setPriorityOpen(false)
      return
    }

    const { error } = res

    if (error) toast.error(error.message)

    setPriorityUpdating(false)
    setPriorityOpen(false)
    await loadTickets()
  }

  useEffect(() => {
    checkSupportAccess()
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login')
        return
      }
      if (event === 'SIGNED_IN') {
        setSuperadminUserId(session.user.id)
        await loadTickets(undefined, { initial: true })
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 980)
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (authLoading || authError) return
    loadTickets(undefined, { initial: true })
  }, [authLoading, authError, tab])

  useEffect(() => {
    if (!selectedGymKey) return
    if (selectedGymTickets.length === 0) {
      setSelectedTicketId(null)
      return
    }
    if (selectedTicketId == null || !selectedGymTickets.some(t => t.ticket_id === selectedTicketId)) {
      setSelectedTicketId(selectedGymTickets[0].ticket_id)
    }
  }, [selectedGymKey, selectedGymTickets, selectedTicketId])

  useEffect(() => {
    if (authLoading || authError) return

    if (inboxChannelRef.current) {
      try {
        supabase.removeChannel(inboxChannelRef.current)
      } catch {
        // ignore
      }
      inboxChannelRef.current = null
    }

    const ch = supabase
      .channel('admin_inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        payload => {
          // Avoid periodic refetch loops: update local state from payload instead of refetching.
          if (payload.eventType === 'DELETE') {
            const oldRow: any = payload.old
            if (oldRow?.ticket_id != null) {
              setTickets(prev => prev.filter(t => t.ticket_id !== oldRow.ticket_id))
            }
            return
          }

          const nextRow: any = payload.new
          const prevRow: any = payload.old

          if (payload.eventType === 'UPDATE' && nextRow && prevRow) {
            const keys = new Set<string>([...Object.keys(nextRow), ...Object.keys(prevRow)])
            const changed: string[] = []
            keys.forEach(k => {
              if (k === 'updated_at') return
              if (nextRow[k] !== prevRow[k]) changed.push(k)
            })

            const allowed = new Set(['superadmin_is_typing', 'owner_is_typing'])
            if (changed.length > 0 && changed.every(k => allowed.has(k))) {
              return
            }
          }

          upsertTicketFromPayload(nextRow)
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          setIsReconnecting(false)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsReconnecting(true)
        }
      })

    inboxChannelRef.current = ch

    return () => {
      try {
        supabase.removeChannel(ch)
      } catch {
        // ignore
      }
      inboxChannelRef.current = null
    }
  }, [authLoading, authError])

  useEffect(() => {
    cleanupThreadChannel()

    if (!selectedTicketId || authLoading || authError) return

    loadThread(selectedTicketId)

    const ch = supabase
      .channel(`admin_thread_${selectedTicketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        payload => {
          const next = payload.new as SupportMessage
          setMessages(prev => [...prev, next])
          scrollToBottom()
          supabase.rpc('mark_ticket_messages_read', { p_ticket_id: selectedTicketId })

          // Update the selected ticket row so list order / last activity stays fresh without refetch.
          setTickets(prev => prev.map(t => {
            if (t.ticket_id !== selectedTicketId) return t
            return {
              ...t,
              last_message_at: next.created_at ?? t.last_message_at,
              unread_by_admin: 0,
            }
          }))
        }
      )
      .subscribe()

    threadChannelRef.current = ch

    return () => {
      cleanupThreadChannel()
    }
  }, [selectedTicketId, authLoading, authError])

  useEffect(() => {
    return () => {
      if (listReloadTimeoutRef.current) clearTimeout(listReloadTimeoutRef.current)
      if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current)

      if (selectedTicketId) {
        resetTypingFlag(selectedTicketId)
      }

      try {
        if (inboxChannelRef.current) supabase.removeChannel(inboxChannelRef.current)
      } catch {
        // ignore
      }

      cleanupThreadChannel()
    }
  }, [selectedTicketId])

  if (authLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Spinner />
      </div>
    )
  }

  if (authError) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <EmptyState icon="⛔" message={`Access unavailable — ${authError}`} />
        </Card>
      </div>
    )
  }

  const showThread = !isMobile || selectedTicketId != null
  const showList = !isMobile || selectedTicketId == null

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 20px)' }}>
      <PageHeader
        title="Support"
        crumb="Support"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
              <Bell size={14} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unreadTotal} unread</span>
            </div>
          </div>
        }
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, overflow: 'hidden' }}>
        {showList && (
          <div className="og-card" style={{ width: isMobile ? '100%' : 380, minWidth: isMobile ? '100%' : 380, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>Support Inbox</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <Bell size={14} />
                <span>{unreadTotal}</span>
              </div>
            </div>

            {isReconnecting && (
              <div style={{ fontSize: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.10)', color: '#FBBF24', fontWeight: 700 }}>
                Reconnecting...
              </div>
            )}

            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <input
                value={gymSearch}
                onChange={e => setGymSearch(e.target.value)}
                placeholder="Search a gym..."
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  padding: '0 12px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <Tabs
                tabs={[
                  { key: 'all', label: 'All' },
                  { key: 'in_progress', label: 'In progress' },
                  { key: 'resolved', label: 'Resolved' },
                  { key: 'closed', label: 'Closed' },
                ]}
                active={tab}
                onChange={(k: string) => setTab(k as TabKey)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingTickets ? (
                <div style={{ padding: 14 }}>
                  <Spinner />
                </div>
              ) : (selectedGymKey ? selectedGymTickets.length === 0 : groupedGyms.length === 0) ? (
                <div style={{ padding: 18 }}>
                  <EmptyState icon="📭" message="No tickets for this filter" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {selectedGymKey ? (
                    <>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <button
                          onClick={() => {
                            setSelectedGymKey(null)
                            setSelectedTicketId(null)
                          }}
                          style={{
                            height: 30,
                            padding: '0 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          ← Gyms
                        </button>

                        <div style={{ fontWeight: 900, fontSize: 12, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedGymName}
                        </div>
                      </div>

                      {selectedGymTickets.map(t => {
                        const active = t.ticket_id === selectedTicketId
                        const tb = typeBadge(t.ticket_type)
                        const pri = priorityDot(t.priority)
                        const unread = t.unread_by_admin ?? 0

                        return (
                          <div
                            key={t.ticket_id}
                            onClick={() => setSelectedTicketId(t.ticket_id)}
                            style={{
                              padding: '12px 14px',
                              cursor: 'pointer',
                              background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                              borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                <span style={{
                                  fontSize: 10,
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background: 'rgba(148,163,184,0.14)',
                                  border: '1px solid var(--border)',
                                  color: tb.color,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}>{tb.label.toUpperCase()}</span>

                                <span style={{ width: 8, height: 8, borderRadius: 999, background: pri, flexShrink: 0 }} />

                                <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.subject ?? '—'}
                                </div>
                              </div>

                              {unread > 0 && (
                                <div style={{
                                  minWidth: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  background: 'rgba(59,130,246,0.18)',
                                  border: '1px solid rgba(59,130,246,0.35)',
                                  color: '#60A5FA',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0 7px',
                                }}>{unread}</div>
                              )}
                            </div>

                            {t.status === 'closed' && (t.rating ?? null) != null && (
                              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {'⭐'.repeat(Math.max(0, Math.min(5, Number(t.rating) || 0)))}
                                {t.rating_comment ? ` — ${t.rating_comment}` : ''}
                              </div>
                            )}

                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{STATUS_LABEL[(t.status ?? 'open') as TicketStatus]?.label ?? '—'}</span>
                              <span>·</span>
                              <span>{fmtRelEn(t.last_message_at ?? t.created_at)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    groupedGyms.map(g => {
                      const t = g.latestTicket
                      const active = t.ticket_id === selectedTicketId
                      const tb = typeBadge(t.ticket_type)
                      const pri = priorityDot(t.priority)
                      const unread = g.unreadTotal

                      return (
                        <div
                          key={g.key}
                          onClick={() => {
                            setSelectedGymKey(g.key)
                            setSelectedTicketId(g.latestTicket.ticket_id)
                          }}
                          style={{
                            padding: '12px 14px',
                            cursor: 'pointer',
                            background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                            borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: 10,
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: 'rgba(148,163,184,0.14)',
                                border: '1px solid var(--border)',
                                color: tb.color,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}>{tb.label.toUpperCase()}</span>

                              <span style={{ width: 8, height: 8, borderRadius: 999, background: pri, flexShrink: 0 }} />

                              <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {g.gym_name}
                              </div>
                            </div>

                            {unread > 0 && (
                              <div style={{
                                minWidth: 20,
                                height: 20,
                                borderRadius: 999,
                                background: 'rgba(59,130,246,0.18)',
                                border: '1px solid rgba(59,130,246,0.35)',
                                color: '#60A5FA',
                                fontSize: 12,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 7px',
                              }}>{unread}</div>
                            )}
                          </div>

                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.subject ?? '—'}
                          </div>

                          {t.status === 'closed' && (t.rating ?? null) != null && (
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {'⭐'.repeat(Math.max(0, Math.min(5, Number(t.rating) || 0)))}
                              {t.rating_comment ? ` — ${t.rating_comment}` : ''}
                            </div>
                          )}

                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.opener_name ?? '—'}</span>
                            <span>·</span>
                            <span>{fmtRelEn(t.last_message_at ?? t.created_at)}</span>
                            <span>·</span>
                            <span>{g.ticketCount} ticket{g.ticketCount > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showThread && (
          <div className="og-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!selectedTicket ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <EmptyState icon="💬" message="Select a ticket to view the conversation" />
              </div>
            ) : (
              <>
                <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {isMobile && (
                      <button
                        onClick={() => setSelectedTicketId(null)}
                        style={{
                          height: 34,
                          width: 34,
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <ArrowLeft size={16} />
                      </button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{
                          fontSize: 10,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: 'rgba(148,163,184,0.14)',
                          border: '1px solid var(--border)',
                          color: typeBadge(selectedTicket.ticket_type).color,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}>{typeBadge(selectedTicket.ticket_type).label.toUpperCase()}</span>

                        <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedTicket.subject ?? '—'}
                        </div>
                      </div>

                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedTicket.gym_name ?? `Gym #${selectedTicket.gym_id ?? '—'}`} · {selectedTicket.opener_name ?? '—'} · Opened {fmtRelEn(selectedTicket.created_at)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge
                      label={STATUS_LABEL[(selectedTicket.status ?? 'open') as TicketStatus]?.label ?? '—'}
                      variant={(selectedTicket.status === 'resolved') ? 'green' : (selectedTicket.status === 'closed') ? 'grey' : (selectedTicket.status === 'waiting') ? 'amber' : (selectedTicket.status === 'in_progress') ? 'blue' : 'amber'}
                    />

                    {selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? (
                      <div style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(16,185,129,0.40)',
                        background: 'rgba(16,185,129,0.12)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 900,
                        color: '#10B981',
                      }}>
                        <CheckCircle2 size={16} />
                        Solved
                      </div>
                    ) : (
                      <button
                        onClick={() => setResolveModalOpen(true)}
                        style={{
                          height: 34,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 800,
                        }}
                      >
                        <CheckCircle2 size={16} />
                        Resolve
                      </button>
                    )}

                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setPriorityOpen(v => !v)}
                        disabled={priorityUpdating}
                        style={{
                          height: 34,
                          padding: '0 10px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 800,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: priorityDot(selectedTicket.priority) }} />
                        Priority
                        <MoreVertical size={16} style={{ opacity: 0.65 }} />
                      </button>

                      {priorityOpen && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: 40,
                          width: 160,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          overflow: 'hidden',
                          zIndex: 10,
                        }}>
                          {['urgent', 'high', 'normal', 'low'].map(p => (
                            <div
                              key={p}
                              onClick={() => updatePriority(p)}
                              style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: priorityDot(p) }} />
                              {p === 'urgent' ? 'Urgent' : p === 'high' ? 'High' : p === 'normal' ? 'Normal' : 'Low'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loadingMessages ? (
                    <Spinner />
                  ) : (
                    <>
                      {messages.map(m => {
                        const role = (m.sender_role ?? '').toLowerCase()
                        const isOwner = role === 'owner'
                        const isSuperadmin = role === 'superadmin'
                        const isSystem = !isOwner && !isSuperadmin

                        if (isSystem) {
                          return (
                            <div key={m.message_id} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                              {m.body ?? '—'}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={m.message_id}
                            style={{
                              display: 'flex',
                              justifyContent: isSuperadmin ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <div style={{
                              maxWidth: '76%',
                              padding: '10px 12px',
                              borderRadius: 14,
                              background: isSuperadmin ? 'rgba(99,102,241,0.18)' : 'rgba(148,163,184,0.16)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-primary)',
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                            }}>
                              <div style={{ fontSize: 13, lineHeight: 1.35 }}>{m.body ?? '—'}</div>
                              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: isSuperadmin ? 'right' : 'left' }}>
                                {fmtRelEn(m.created_at)}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {selectedTicket.owner_is_typing && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: 'rgba(148,163,184,0.16)',
                            border: '1px solid var(--border)',
                            width: 60,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-muted)', opacity: 0.6 }} />
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-muted)', opacity: 0.6 }} />
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-muted)', opacity: 0.6 }} />
                          </div>
                        </div>
                      )}
                      <div ref={threadEndRef} />
                    </>
                  )}
                </div>

                {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => toast.info('Attachments not implemented')}
                      style={{
                        height: 38,
                        width: 38,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Paperclip size={16} />
                    </button>

                    <input
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={() => handleReplyKeyDown()}
                      onBlur={() => {
                        if (selectedTicketId) resetTypingFlag(selectedTicketId)
                      }}
                      placeholder="Your reply..."
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 12,
                        border: '1px solid var(--border-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        padding: '0 12px',
                        outline: 'none',
                      }}
                    />

                    <button
                      onClick={sendMessage}
                      disabled={sending || !replyText.trim()}
                      style={{
                        height: 38,
                        width: 44,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer',
                        opacity: sending || !replyText.trim() ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Modal
        open={resolveModalOpen}
        title="Resolve this ticket"
        onClose={() => {
          if (!resolving) setResolveModalOpen(false)
        }}
      >
        <FormGroup label="Resolution note (optional)">
          <textarea
            value={resolutionNote}
            onChange={e => setResolutionNote(e.target.value)}
            placeholder="E.g. Fixed in v1.2.3..."
            style={{
              width: '100%',
              minHeight: 90,
              borderRadius: 12,
              border: '1px solid var(--border-input)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              padding: 12,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </FormGroup>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          A rating will be requested from the gym owner.
        </div>

        <ModalActions>
          <button
            onClick={() => setResolveModalOpen(false)}
            disabled={resolving}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              cursor: resolving ? 'not-allowed' : 'pointer',
              opacity: resolving ? 0.6 : 1,
              fontWeight: 800,
            }}
          >
            Cancel
          </button>

          <button
            onClick={resolveTicket}
            disabled={resolving}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'rgba(16,185,129,0.15)',
              cursor: resolving ? 'not-allowed' : 'pointer',
              opacity: resolving ? 0.6 : 1,
              fontWeight: 900,
              color: '#10B981',
            }}
          >
            {resolving ? '...' : 'Mark as resolved'}
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}
