import './Badge.css'

/**
 * Semantic status badge. `tone` maps 1:1 to the app's color
 * semantics — resist adding new tones for decoration.
 *
 *  - verified → green   (verified / successful / healthy)
 *  - critical → red     (critical / suspicious / failed)
 *  - warning  → amber   (warning / uncertain / processing)
 *  - info     → cyan    (information / active / selected)
 *  - neutral  → gray    (inactive / not-yet-processed)
 */
export default function Badge({ tone = 'neutral', children, dot = true, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}
