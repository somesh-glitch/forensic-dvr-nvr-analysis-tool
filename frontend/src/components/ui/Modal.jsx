import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Modal.css'

export default function Modal({ open, onClose, title, eyebrow, children, width = 480 }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-panel__header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h3 className="modal-panel__title">{title}</h3>}
          </div>
          <button
            type="button"
            className="modal-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
