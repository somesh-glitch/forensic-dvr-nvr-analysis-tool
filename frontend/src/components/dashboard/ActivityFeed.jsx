import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import './ActivityFeed.css'

const TONE_ICON = {
  verified: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
}

function formatRelativeTime(isoString) {
  const then = new Date(isoString).getTime()
  const now = Date.now()
  const diffMin = Math.round((now - then) / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export default function ActivityFeed({ items }) {
  if (!items || items.length === 0) {
    return <p className="activity-feed__empty text-muted">No recent activity for this case.</p>
  }

  return (
    <ul className="activity-feed">
      {items.map((item) => {
        const Icon = TONE_ICON[item.tone] || Info
        return (
          <li key={item.id} className="activity-feed__row">
            <span className={`activity-feed__icon activity-feed__icon--${item.tone}`}>
              <Icon size={15} strokeWidth={2} />
            </span>
            <div className="activity-feed__body">
              <div className="activity-feed__message">{item.message}</div>
              {item.detail && (
                <div className="activity-feed__detail text-secondary">{item.detail}</div>
              )}
            </div>
            <span className="activity-feed__time eyebrow">
              {formatRelativeTime(item.timestamp)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
