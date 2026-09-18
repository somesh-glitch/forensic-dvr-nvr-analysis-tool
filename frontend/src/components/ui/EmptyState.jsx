import './EmptyState.css'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state__icon">
          <Icon size={22} strokeWidth={1.6} />
        </div>
      )}
      <h4 className="empty-state__title">{title}</h4>
      {description && <p className="empty-state__description text-secondary">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
