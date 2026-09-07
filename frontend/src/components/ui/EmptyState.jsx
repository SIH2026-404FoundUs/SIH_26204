// A container is never just blank. This always says why there's nothing and,
// where there's something to do about it, what that is.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      {Icon && <Icon size={28} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
