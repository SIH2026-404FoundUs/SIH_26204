// One confirmation-dialog shape for the whole app. Modal surfaces are one of
// the few places the doc calls for glassmorphism (§60).
export default function Modal({ open, onClose, title, children, titleId = 'modal-title' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-surface w-full max-w-md rounded-xl p-6 shadow-xl"
      >
        {title && <h2 id={titleId} className="font-display text-lg text-ink">{title}</h2>}
        <div className={title ? 'mt-2' : ''}>{children}</div>
      </div>
    </div>
  )
}
