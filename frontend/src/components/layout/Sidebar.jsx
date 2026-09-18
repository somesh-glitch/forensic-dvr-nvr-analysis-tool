import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  FolderOpen,
  FileSearch,
  ScanSearch,
  History,
  ShieldCheck,
  FileText,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { pingBackend, getSystemHealth } from '../../api/apiClient'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
  { to: '/cases', label: 'Evidence', icon: FileSearch },
  { to: '/analysis', label: 'Analysis', icon: ScanSearch },
  { to: '/timeline', label: 'Timeline', icon: History },
  { to: '/custody', label: 'Chain of Custody', icon: ShieldCheck },
  { to: '/reports', label: 'Reports', icon: FileText },
]

const PING_INTERVAL_MS = 15000

export default function Sidebar({ collapsed, onToggleCollapse }) {
  const [backendUp, setBackendUp] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const ok = await pingBackend()
        let health = null
        if (ok) {
          health = await getSystemHealth()
        }
        if (!cancelled) {
          setBackendUp(ok)
          setSystemHealth(health)
        }
      } catch (err) {
        if (!cancelled) {
          setBackendUp(false)
          setSystemHealth(null)
        }
      }
    }
    check()
    const interval = setInterval(check, PING_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const statusRows = [
    {
      label: 'Forensic Engine',
      state: systemHealth ? (systemHealth.adapters_loaded > 0 ? 'up' : 'down') : (backendUp === null ? 'checking' : 'down')
    },
    {
      label: 'Database',
      state: systemHealth ? (systemHealth.database === 'Healthy' ? 'up' : 'down') : (backendUp === null ? 'checking' : 'down')
    },
    {
      label: 'Backend',
      state: backendUp === null ? 'checking' : backendUp ? 'up' : 'down',
    },
  ]


  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">CF</div>
        {!collapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-title">CASEFILE</span>
            <span className="sidebar__brand-sub eyebrow">Forensic Analysis</span>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={17} strokeWidth={2} className="sidebar__icon" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__status">
        {!collapsed && <div className="eyebrow sidebar__status-title">System Status</div>}
        <div className="sidebar__status-rows">
          {statusRows.map((row) => (
            <div
              key={row.label}
              className={`sidebar__status-row sidebar__status-row--${row.state}`}
              title={collapsed ? row.label : undefined}
            >
              <span className="sidebar__status-dot" />
              {!collapsed && <span>{row.label}</span>}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="sidebar__collapse-btn"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}

