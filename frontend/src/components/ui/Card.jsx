import './Card.css'

/**
 * Glass panel primitive.
 *
 * density:
 *  - default  → standard panel, used for most content blocks
 *  - elevated → slightly brighter surface + cyan-tinted glow border,
 *               reserved for the element the investigator is actively
 *               focused on (selected evidence, active video, etc.)
 *  - outlined → flat, border-only, for dense nested content (rows
 *               inside a table-like list) where a full panel would
 *               be too heavy
 */
export default function Card({
  children,
  density = 'default',
  padding = 'md',
  className = '',
  ...rest
}) {
  return (
    <div
      className={`card card--${density} card--pad-${padding} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`card-header ${className}`}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h3 className="card-header__title">{title}</h3>}
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </div>
  )
}
