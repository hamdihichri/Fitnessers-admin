'use client'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

// ── Badge ──────────────────────────────────────────────
type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'grey'
const BADGE_MAP: Record<string, BadgeVariant> = {
    active: 'green', confirmed: 'green', paid: 'green', healthy: 'green', clean: 'green', assigned: 'green', success: 'green', ok: 'green',
    pending: 'amber', requested: 'amber', locked: 'amber', warn: 'amber', paused: 'amber', started: 'blue',
    expired: 'red', rejected: 'red', error: 'red', canceled: 'red', deleted: 'red',
  corporate: 'purple', hotel_pool: 'purple',
  unassigned: 'grey', none: 'grey', gym: 'blue',
}
export function Badge({ label, variant }: { label: string; variant?: BadgeVariant }) {
  const v = variant ?? BADGE_MAP[label.toLowerCase()] ?? 'grey'
  return <span className={`badge badge-${v}`}>{label}</span>
}
export function statusBadge(s: string | null | undefined) {
  if (!s) return <Badge label="—" variant="grey" />
  return <Badge label={s} />
}
export function providerBadge(p: string | null | undefined) {
  const map: Record<string, BadgeVariant> = { konnect: 'amber', flouci: 'blue', paymee: 'purple', cash: 'grey', virement: 'blue' }
  if (!p) return <Badge label="—" variant="grey" />
  return <Badge label={p} variant={map[p] ?? 'grey'} />
}

// ── KPI Card ───────────────────────────────────────────
type KpiAccent = 'blue' | 'green' | 'amber' | 'red' | 'purple'
export function KpiCard({ label, value, sub, subColor, accent }: {
  label: string; value: string | number; sub?: string; subColor?: string; accent?: KpiAccent
}) {
  return (
    <div className={`og-card kpi-${accent ?? 'blue'}`} style={{ padding: 24, flex: 1 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 12, color: subColor ?? 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Spinner / Loading ──────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
      <div className="spin" />
      Loading...
    </div>
  )
}

// ── Empty State ────────────────────────────────────────
export function EmptyState({ icon = '📭', message = 'No data found' }: { icon?: string; message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      {message}
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────
export function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'
  return (
    <div className="avatar" style={{ 
      width: size, 
      height: size, 
      minWidth: size, 
      fontSize: Math.max(10, size / 2.5),
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #4F6BF4, #6D5BFE)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700
    }}>
      {initials}
    </div>
  )
}

// ── User Cell ──────────────────────────────────────────
export function UserCell({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <div className="user-cell">
      <Avatar name={name} />
      <div>
        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{name ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{email ?? ''}</div>
      </div>
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

// ── Form Group ─────────────────────────────────────────
export function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Modal Actions ──────────────────────────────────────
export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>{children}</div>
}

// ── Confirm Modal ──────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'blue' }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmText?: string; variant?: KpiAccent
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
      <ModalActions>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn btn-${variant}`} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
      </ModalActions>
    </Modal>
  )
}

// ── Info Box ───────────────────────────────────────────
export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-base)', borderRadius: 12, padding: '14px 16px', fontSize: 12, lineHeight: 1.9, marginBottom: 16, border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
      {children}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────
export function Card({ children, title, action, glass = false }: { children: React.ReactNode; title?: string; action?: React.ReactNode; glass?: boolean }) {
  return (
    <div className={cn("og-card", glass && "glass-surface")} style={{
      marginBottom: 20,
      transition: 'all 0.4s var(--ease-out-expo)',
    }}>
      {title && (
        <div className="og-card-header" style={{ padding: '20px 24px' }}>
          <span className="og-card-title" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: title ? '0 24px 24px' : '24px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────
export function PageHeader({ title, crumb, actions }: { title: string; crumb?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div>
        {crumb && <div className="breadcrumb"><span>Home</span><span className="sep">/</span><span style={{ color: 'var(--text-primary)' }}>{crumb}</span></div>}
        <h1 style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{title}</h1>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (k: string) => void
}) {
  return (
    <div className="og-tabs" style={{ marginBottom: 20 }}>
      {tabs.map(t => (
        <div key={t.key} className={`og-tab${active === t.key ? ' active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && (
            <span style={{
              background: active === t.key ? 'rgba(79,107,244,0.2)' : 'var(--border)',
              color: active === t.key ? '#4F6BF4' : 'var(--text-secondary)',
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
            }}>{t.count}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Filters bar ───────────────────────────────────────
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="filter-bar">
      {children}
    </div>
  )
}

// ── Stat pills row ────────────────────────────────────
export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-pill">
      {label} <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

// ── Alert Banner ──────────────────────────────────────
type AlertVariant = 'amber' | 'red' | 'green'
export function AlertBanner({ variant = 'amber', children, action }: {
  variant?: AlertVariant; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className={`alert-banner alert-${variant}`} style={{ justifyContent: action ? 'space-between' : undefined }}>
      <span>{children}</span>
      {action}
    </div>
  )
}
// ── Dropdown ──────────────────────────────────────────
export function Dropdown({ trigger, children, align = 'right' }: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open && (
        <div className="dropdown-menu" style={{ [align]: 0 }}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({ title, desc, time, onClick, active = false, variant }: {
  title: string;
  desc?: string;
  time?: string;
  onClick?: () => void;
  active?: boolean;
  variant?: 'danger' | 'success'
}) {
  return (
    <button
      className={cn(
        "dropdown-item",
        active && "dropdown-item-active",
        variant === 'danger' && "text-red-500",
        variant === 'success' && "text-green-500"
      )}
      style={{
        color: variant === 'danger' ? '#EF4444' : variant === 'success' ? '#10B981' : undefined
      }}
      onClick={onClick}
    >
      <div className="dropdown-item-title">{title}</div>
      {desc && <div className="dropdown-item-desc">{desc}</div>}
      {time && <div className="dropdown-item-time">{time}</div>}
    </button>
  )
}

export function CustomSelect({ value, onChange, options, style }: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}) {
  const selected = options.find(o => o.value === value) || options[0]

  return (
    <Dropdown
      align="left"
      trigger={
        <div className="og-select" style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120, height: 34 }}>
          <span style={{ fontSize: 13 }}>{selected?.label}</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
        </div>
      }
    >
      {(close) => (
        <div style={{ minWidth: 180 }}>
          {options.map(o => (
            <DropdownItem
              key={o.value}
              title={o.label}
              active={o.value === value}
              onClick={() => {
                onChange(o.value)
                close()
              }}
            />
          ))}
        </div>
      )}
    </Dropdown>
  )
}
// ── Toast System ──────────────────────────────────────
type ToastType = 'success' | 'error' | 'info'
interface ToastInfo {
  id: string
  title: string
  message: string
  type: ToastType
  duration?: number
}

let toastListeners: ((t: ToastInfo[]) => void)[] = []
let toasts: ToastInfo[] = []

export const toast = {
  success: (message: string, title = 'Success') => addToast(title, message, 'success'),
  error: (message: string, title = 'Error') => addToast(title, message, 'error'),
  info: (message: string, title = 'Info') => addToast(title, message, 'info'),
}

function addToast(title: string, message: string, type: ToastType) {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast = { id, title, message, type }
  toasts = [...toasts, newToast]
  notify()
  setTimeout(() => removeToast(id), 5000)
}

function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

function notify() {
  toastListeners.forEach(l => l(toasts))
}

export function ToastContainer() {
  const [activeToasts, setActiveToasts] = useState<ToastInfo[]>([])

  useEffect(() => {
    toastListeners.push(setActiveToasts)
    return () => {
      toastListeners = toastListeners.filter(l => l !== setActiveToasts)
    }
  }, [])

  return (
    <div className="toast-container">
      {activeToasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
          <div className="toast-icon">
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '✕'}
            {t.type === 'info' && 'ℹ'}
          </div>
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            <div className="toast-message">{t.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
