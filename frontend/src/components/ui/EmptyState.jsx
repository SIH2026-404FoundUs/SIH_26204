// A container is never just blank. This always says why there's nothing and,
// where there's something to do about it, what that is -- matching the
// backend's own null-score honesty convention (§8): never fabricate a value,
// state plainly that one is unavailable.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-lg border border-dashed border-paper-dim bg-white px-6 py-10 text-center">
      {Icon && <Icon size={28} className="mx-auto mb-3 text-ash" aria-hidden="true" />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
