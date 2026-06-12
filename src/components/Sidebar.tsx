'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Building2, Users, CreditCard, Coins,
  Building, BarChart3, Monitor, LogOut, Dumbbell, CalendarDays, Receipt, ShieldCheck, PlusCircle, LifeBuoy, Radio, Ticket
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabaseBrowser'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/gyms', icon: Building2, label: 'Gyms', badge: 'pending' },
  { href: '/support', icon: LifeBuoy, label: 'Support' },
  { href: '/sessions', icon: CalendarDays, label: 'Sessions' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/corporate', icon: Building, label: 'Corporate' },
  { href: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { href: '/superadmin/plan-codes', icon: Ticket, label: 'Plan Codes' },
  { href: '/payments', icon: Receipt, label: 'Payments' },
  { href: '/tokens', icon: Coins, label: 'Token Economy' },
  { href: '/community', icon: Radio, label: 'Community' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/monitoring', icon: Monitor, label: 'Monitoring' },
]

export function Sidebar() {
  const path = usePathname()
  const router = useRouter()

  async function logout() {
    try {
      const sb = createBrowserClient()
      await sb.auth.signOut()
    } catch {
      // ignore
    }
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <aside style={{
      width: 240, minWidth: 240,
      background: 'var(--bg-topbar)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      transition: 'all 0.25s',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <img
          src="/assets/logo 1.png"
          alt="Fitnessers Logo"
          style={{ height: 36, objectFit: 'contain' }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.03em', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Fitnessers
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Admin Panel
          </div>
        </div>
      </div>

      {/* Admin info */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--sa-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff',
          border: '1px solid var(--border-input)', flexShrink: 0,
        }}>SA</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Super Admin</div>
          <div style={{ fontSize: 10, color: '#10B981', fontFamily: 'var(--font-mono)' }}>● Connected</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', padding: '4px 8px 8px', fontWeight: 600 }}>
          Menu
        </div>
        {NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div className={`nav-item${active ? ' active' : ''}`}>
                <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                <span style={{ flex: 1, fontWeight: active ? 600 : 500, fontSize: 13 }}>{label}</span>
                {badge === 'pending' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div className="nav-item" style={{ color: '#EF4444' }} onClick={logout}>
          <LogOut size={15} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Logout</span>
        </div>
      </div>
    </aside>
  )
}
