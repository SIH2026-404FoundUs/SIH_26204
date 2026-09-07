// One confirmation-dialog shape for the whole app.
export default function Modal({ open, onClose, title, children, titleId = 'modal-title' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        {title && <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>}
        <div className={title ? 'mt-2' : ''}>{children}</div>
      </div>
    </div>
  )
}
