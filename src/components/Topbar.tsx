'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Search, Bell, Sun, Moon, Inbox } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Dropdown, DropdownItem } from './ui'
import { useRouter } from 'next/navigation'
import { timeAgo } from '@/lib/utils'
import { fetchJson } from '@/lib/fetchJson'

const TITLES: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { title: 'Overview', crumb: 'Dashboard' },
  '/gyms': { title: 'Gym Management', crumb: 'Gyms' },
  '/sessions': { title: 'Sessions', crumb: 'Sessions' },
  '/users': { title: 'Users', crumb: 'Users' },
  '/subscriptions': { title: 'Subscriptions', crumb: 'Subscriptions' },
  '/payments': { title: 'Payments', crumb: 'Payments' },
  '/tokens': { title: 'Token Economy', crumb: 'Tokens' },
  '/corporate': { title: 'Corporate', crumb: 'Corporate' },
  '/analytics': { title: 'Analytics', crumb: 'Analytics' },
  '/monitoring': { title: 'Monitoring', crumb: 'Monitoring' },
  '/women-only-requests': { title: 'Women-Only Requests', crumb: 'Women-Only Requests' },
}

export function Topbar() {
  const path = usePathname()
  const { theme, toggle } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [lastCheck, setLastCheck] = useState<number>(Date.now())

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true)
    loadNotifs()
    const timer = setInterval(loadNotifs, 60000)
    return () => clearInterval(timer)
  }, [])

  async function loadNotifs() {
    try {
      const res = await fetchJson('/api/notifications')
      setNotifs(res.notifications || [])
      setCount(res.count || 0)
    } catch (err) { console.error('Failed to load notifs', err) }
  }

  const hasNew = count > 0

  const match = Object.entries(TITLES).find(([k]) => path === k || path.startsWith(k + '/'))
  const info = match?.[1] ?? { title: 'Admin', crumb: 'Page' }

  return (
    <header style={{
      height: 56,
      background: 'var(--bg-topbar)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16, flexShrink: 0,
      transition: 'all 0.25s',
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '7px 12px',
        flex: 1, maxWidth: 320,
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          placeholder="Search..."
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 13, width: '100%',
          }}
        />
      </div>

      {/* Page breadcrumb */}
      <div style={{ flex: 1 }}>
        <div className="breadcrumb">
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Home / </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{info.crumb}</span>
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <div className="live-dot" />
          Live
        </div>

        {/* Theme toggle */}
        <button className="theme-toggle" onClick={toggle} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {mounted ? (
            theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />
          ) : (
            <div style={{ width: 16, height: 16 }} />
          )}
        </button>

        {/* Notification Bell */}
        <Dropdown trigger={
          <div style={{ position: 'relative', padding: 6 }}>
            <Bell size={16} style={{ color: count > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)' }} />
            {count > 0 && (
              <div
                className="notification-pulse"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8,
                  background: '#EF4444', borderRadius: '50%',
                  border: '2px solid var(--bg-topbar)'
                }}
              />
            )}
          </div>
        }>
          {(close) => (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notifications</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{count} pending</span>
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Inbox size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div style={{ fontSize: 12 }}>All caught up!</div>
                </div>
              ) : (
                notifs.map(n => (
                  <DropdownItem
                    key={n.id}
                    title={n.title}
                    desc={n.message}
                    time={timeAgo(n.time)}
                    onClick={() => {
                      router.push(n.link)
                      close()
                    }}
                  />
                ))
              )}
            </div>
          )}
        </Dropdown>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--sa-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
            border: '1px solid var(--border-input)',
          }}>SA</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Super Admin</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>admin@fitnessers.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}
