import { Loader2 } from 'lucide-react'
import './LoadingSpinner.css'

/**
 * Inline spinner for panel-level loading states, with an optional
 * label (e.g. "Loading cases…", "Analyzing video…").
 */
export function LoadingSpinner({ label, size = 20 }) {
  return (
    <div className="loading-spinner">
      <Loader2 size={size} className="loading-spinner__icon" />
      {label && <span className="loading-spinner__label">{label}</span>}
    </div>
  )
}

/**
 * A single skeleton line/block. Compose several to mimic the shape
 * of the content that will load in (e.g. a card's title + two lines).
 */
export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  )
}

export default LoadingSpinner
