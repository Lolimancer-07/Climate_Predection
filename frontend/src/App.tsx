import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'admin'>('dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px',
        background: '#0d131f',
        borderBottom: '1px solid #1e293b',
        fontSize: 13,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#38bdf8' }}>
          <span>🌀</span>
          <span style={{ letterSpacing: '0.02em' }}>Cyclone Anticipatory Action</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 20 }}>
          <button
            id="nav-btn-dashboard"
            onClick={() => setActivePage('dashboard')}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              background: activePage === 'dashboard' ? '#1e293b' : 'transparent',
              color: activePage === 'dashboard' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
              transition: 'all 0.15s ease',
            }}
          >
            🗺️ Operational Dashboard
          </button>
          <button
            id="nav-btn-admin"
            onClick={() => setActivePage('admin')}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              background: activePage === 'admin' ? '#1e293b' : 'transparent',
              color: activePage === 'admin' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
              transition: 'all 0.15s ease',
            }}
          >
            ⚙️ Admin &amp; RBAC Panel
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Bay of Bengal &amp; Coastal APAC</span>
        </div>
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activePage === 'dashboard' ? <Dashboard /> : <AdminPanel />}
      </div>
    </div>
  )
}
