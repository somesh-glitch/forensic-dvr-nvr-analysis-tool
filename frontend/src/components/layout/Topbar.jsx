import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio, FolderOpen, UserCircle2 } from 'lucide-react'
import { pingBackend } from '../../api/apiClient'
import { useCurrentCase } from '../../context/CaseContext'
import './Topbar.css'

const PING_INTERVAL_MS = 15000

export default function Topbar() {
  const { currentCase } = useCurrentCase()
  const [connected, setConnected] = useState(null) // null = checking

  useEffect(() => {
    let cancelled = false

    async function check() {
      const ok = await pingBackend()
      if (!cancelled) setConnected(ok)
    }

    check()
    const interval = setInterval(check, PING_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <header className="topbar">
      <div className="topbar__left">
        {currentCase ? (
          <Link to={`/cases/${currentCase.id}`} className="topbar__case-pill">
            <FolderOpen size={13} />
            <span className="mono">{currentCase.case_number}</span>
            <span className="topbar__case-title">{currentCase.title}</span>
          </Link>
        ) : (
          <span className="topbar__case-pill topbar__case-pill--empty">
            <FolderOpen size={13} />
            <span>No active case</span>
          </span>
        )}
      </div>

      <div className="topbar__right">
        <div
          className={`topbar__status topbar__status--${
            connected === null ? 'checking' : connected ? 'up' : 'down'
          }`}
          title="FastAPI backend connection status"
        >
          <Radio size={13} />
          <span>
            {connected === null ? 'CHECKING…' : connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        <div className="topbar__divider" />

        <div className="topbar__user">
          <UserCircle2 size={20} strokeWidth={1.6} />
          <span>Investigator</span>
        </div>
      </div>
    </header>
  )
}
