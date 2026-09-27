import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'
import { HardeningPriorityPage } from './pages/HardeningPriorityPage'
import { DamageAssessmentPage } from './pages/DamageAssessmentPage'
import { InsurerDashboard } from './pages/InsurerDashboard'
import { HistoricalTrendsPage } from './pages/HistoricalTrendsPage'
import { RoleProvider, useRole, UserRole } from './components/RoleGate'
import { LiveUpdateBanner } from './components/LiveUpdateBanner'

type Page = 'dashboard' | 'admin' | 'hardening' | 'damage' | 'insurer' | 'trends'

const NAV_ITEMS: Array<{ id: Page; label: string; icon: string; roles: UserRole[] }> = [
  { id: 'dashboard',  label: 'Operational Dashboard', icon: '🗺️', roles: ['ddma_operator', 'admin'] },
  { id: 'hardening',  label: 'Hardening Priority',    icon: '🛡️', roles: ['ddma_operator', 'admin'] },
  { id: 'damage',     label: 'Damage Assessment',     icon: '📡', roles: ['ddma_operator', 'admin'] },
  { id: 'trends',     label: 'Historical Trends',     icon: '📈', roles: ['ddma_operator', 'admin', 'insurer_viewer'] },
  { id: 'insurer',    label: 'Insurer Dashboard',     icon: '💰', roles: ['insurer_viewer', 'admin'] },
  { id: 'admin',      label: 'Admin & RBAC',          icon: '⚙️', roles: ['admin'] },
]

const ROLE_OPTIONS: UserRole[] = ['ddma_operator', 'insurer_viewer', 'admin', 'public']

function AppContent() {
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const { role, setRole } = useRole()

  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(role))

  // If current page becomes inaccessible after role switch, go to first visible
  const safeActivePage = visibleNav.find((n) => n.id === activePage) ? activePage : visibleNav[0]?.id ?? 'dashboard'

  const renderPage = () => {
    switch (safeActivePage) {
      case 'dashboard':  return <Dashboard />
      case 'admin':      return <AdminPanel />
      case 'hardening':  return <HardeningPriorityPage />
      case 'damage':     return <DamageAssessmentPage />
      case 'insurer':    return <InsurerDashboard />
      case 'trends':     return <HistoricalTrendsPage />
      default:           return <Dashboard />
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
      overflow: 'hidden', background: 'var(--bg-base)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Top navigation bar */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 var(--space-4)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        height: 52, flexShrink: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 800, fontSize: 'var(--text-base)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginRight: 12, flexShrink: 0,
        }}>
          🌀 <span>Cyclone AAP</span>
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActivePage(item.id)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                transition: 'all var(--transition-fast)',
                background: safeActivePage === item.id
                  ? 'var(--bg-elevated)'
                  : 'transparent',
                color: safeActivePage === item.id
                  ? 'var(--color-primary)'
                  : 'var(--text-muted)',
                boxShadow: safeActivePage === item.id
                  ? 'inset 0 0 0 1px var(--border-default)'
                  : 'none',
              }}
            >
              <span style={{ marginRight: 4 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Role switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Role</span>
          <select
            id="role-switcher"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              padding: '4px 8px', fontSize: 'var(--text-xs)', cursor: 'pointer',
            }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bay of Bengal · APAC</span>
        </div>
      </nav>

      {/* Live status bar */}
      <LiveUpdateBanner districtId="IN-OD-PURI" />

      {/* Page content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-base)' }}>
        {renderPage()}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  )
}
