import { Loader2 } from 'lucide-react'
import './Button.css'

/**
 * Shared button primitive.
 *
 * variant:
 *  - primary   → cyan, the one "do the main thing" action per screen
 *  - secondary → glass/outlined, neutral actions
 *  - ghost     → no border, quiet actions (e.g. inside tables)
 *  - danger    → red, irreversible/critical forensic actions only
 */
export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="btn__spinner" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} />
      )}
      {children && <span>{children}</span>}
    </button>
  )
}
