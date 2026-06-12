import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { ToastContainer } from "@/components/ui"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg-base)' }}>
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
