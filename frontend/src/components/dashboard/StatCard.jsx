import Badge from '../ui/Badge'
import './StatCard.css'

const INTEGRITY_TONE = {
  verified: { tone: 'verified', label: 'Verified' },
  warning: { tone: 'warning', label: 'Anomaly' },
  failed: { tone: 'critical', label: 'Failed' },
}

/**
 * A single dashboard stat tile. Pass either `value` (a number/string
 * stat) or `integrityStatus` (renders a Badge instead — the
 * "VERIFIED ✓" tile is a status, not a count, so it gets its own
 * visual treatment rather than being forced into the number pattern).
 */
export default function StatCard({ icon: Icon, label, value, integrityStatus }) {
  const integrity = integrityStatus ? INTEGRITY_TONE[integrityStatus] : null

  return (
    <div className="stat-card">
      <div className="stat-card__icon">
        <Icon size={16} strokeWidth={2} />
      </div>

      {integrity ? (
        <Badge tone={integrity.tone} className="stat-card__badge">
          {integrity.label}
        </Badge>
      ) : (
        <div className="stat-card__value mono">{value}</div>
      )}

      <div className="stat-card__label eyebrow">{label}</div>
    </div>
  )
}
